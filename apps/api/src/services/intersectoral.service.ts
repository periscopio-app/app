/**
 * Serviço de Gestão e Monitoramento da Rede Intersetorial (CRAS, CAPS AJ/IJ, UBS)
 * Base Legal:
 * - Lei nº 13.509/2017 / ECA (Lei nº 8.069/1990, art. 19, § 2º): Prazo máximo de 90 dias
 *   para reavaliação periódica do acolhimento e garantia de proteção integral.
 * - Marco de Encaminhamento e Acolhimento Intersetorial 2025.
 */

export type IntersectoralDestination =
  | "UBS" // Unidade Básica de Saúde (Atenção Primária à Saúde)
  | "CAPS_IJ" // Centro de Atenção Psicossocial Infantojuvenil
  | "CAPS_AJ" // Centro de Atenção Psicossocial Álcool e Outras Drogas
  | "CRAS" // Centro de Referência de Assistência Social (Proteção Básica)
  | "CREAS" // Centro de Referência Especializado de Assistência Social (Proteção Especial)
  | "CONSELHO_TUTELAR"; // Garantia e tutela de direitos

export type ReferralStatus =
  | "solicitado"
  | "triado"
  | "acolhido"
  | "em_atendimento"
  | "contrarreferencia_concluida";

export type SlaAlert = "no_prazo" | "atencao" | "urgente" | "prazo_estourado_90d";

export interface IntersectoralReferral {
  id: string;
  caseId: string;
  studentCode: string; // Código pseudonimizado (ex: TAR-2026-0042)
  schoolName: string;
  destination: IntersectoralDestination;
  destinationName?: string; // ex: "UBS Central Tarumã", "CAPS IJ Vale do Paranapanema"
  reason: string;
  specialtyRequired: string; // ex: "Psiquiatria Infantil", "Acompanhamento Psicossocial", "Fonoaudiologia"
  priority: "rotina" | "prioritario" | "urgente";
  requestedBy: string; // Profissional ou papel (ex: "Psicopedagoga RE", "Neuropediatra")
  createdAt: string; // ISO 8601
  receivedAt?: string;
  completedAt?: string;
  status: ReferralStatus;
  feedbackNotes?: string; // Contrarreferência
  slaDeadlineDays: number; // 90 dias por padrão legal
}

export interface ReferralWithSla extends IntersectoralReferral {
  daysElapsed: number;
  daysRemaining: number;
  slaStatus: SlaAlert;
  isBreached: boolean;
}

// Repositório em memória com casos iniciais exemplares de Tarumã
const referralsStore: Map<string, IntersectoralReferral> = new Map([
  [
    "ref-taruma-001",
    {
      id: "ref-taruma-001",
      caseId: "caso-001",
      studentCode: "TAR-2026-0001",
      schoolName: "EMEF Gilberto Lex",
      destination: "CAPS_IJ",
      destinationName: "CAPS IJ Regional",
      reason: "Desatenção grave, impulsividade e sofrimento emocional em ambiente escolar",
      specialtyRequired: "Psiquiatria da Infância e Adolescência",
      priority: "urgente",
      requestedBy: "Equipe Multidisciplinar Periscópio",
      createdAt: new Date(Date.now() - 25 * 86400000).toISOString(), // 25 dias atrás
      status: "triado",
      slaDeadlineDays: 90,
    },
  ],
  [
    "ref-taruma-002",
    {
      id: "ref-taruma-002",
      caseId: "caso-002",
      studentCode: "TAR-2026-0018",
      schoolName: "EMEF Maria Magdalena",
      destination: "CRAS",
      destinationName: "CRAS Tarumã - Vila Dourada",
      reason: "Vulnerabilidade social extrema, evasão e necessidade de inclusão no Cadastro Único",
      specialtyRequired: "Assistência Social / Proteção Básica",
      priority: "prioritario",
      requestedBy: "Assistente Social Periscópio",
      createdAt: new Date(Date.now() - 48 * 86400000).toISOString(), // 48 dias atrás
      status: "acolhido",
      slaDeadlineDays: 90,
    },
  ],
  [
    "ref-taruma-003",
    {
      id: "ref-taruma-003",
      caseId: "caso-003",
      studentCode: "TAR-2026-0034",
      schoolName: "Creche Criança Feliz",
      destination: "UBS",
      destinationName: "UBS Vila dos Pássaros - Tarumã",
      reason: "Triagem fonoaudiológica com atraso severo na aquisição de linguagem",
      specialtyRequired: "Fonoaudiologia / Puericultura",
      priority: "rotina",
      requestedBy: "Fonoaudióloga Periscópio",
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), // 12 dias atrás
      status: "solicitado",
      slaDeadlineDays: 90,
    },
  ],
  [
    "ref-taruma-004",
    {
      id: "ref-taruma-004",
      caseId: "caso-004",
      studentCode: "TAR-2026-0055",
      schoolName: "EMEF Gilberto Lex",
      destination: "CAPS_AJ",
      destinationName: "CAPS Álcool e Drogas Assis/Tarumã",
      reason: "Situação de vulnerabilidade familiar complexa com impacto na permanência escolar",
      specialtyRequired: "Apoio Psicossocial Especializado",
      priority: "urgente",
      requestedBy: "Psicólogo Periscópio",
      createdAt: new Date(Date.now() - 72 * 86400000).toISOString(), // 72 dias atrás (Alerta Urgente)
      status: "acolhido",
      slaDeadlineDays: 90,
    },
  ],
]);

/**
 * Calcula os dias decorridos e o status de SLA com base na data de criação
 */
export function enrichWithSla(ref: IntersectoralReferral): ReferralWithSla {
  const created = new Date(ref.createdAt).getTime();
  const now = Date.now();
  const daysElapsed = Math.max(0, Math.floor((now - created) / 86400000));
  const deadline = ref.slaDeadlineDays || 90;
  const daysRemaining = Math.max(0, deadline - daysElapsed);
  const isBreached = daysElapsed >= deadline && ref.status !== "contrarreferencia_concluida";

  let slaStatus: SlaAlert = "no_prazo";
  if (isBreached) {
    slaStatus = "prazo_estourado_90d";
  } else if (daysElapsed >= 61) {
    slaStatus = "urgente";
  } else if (daysElapsed >= 31) {
    slaStatus = "atencao";
  } else {
    slaStatus = "no_prazo";
  }

  return {
    ...ref,
    daysElapsed,
    daysRemaining,
    slaStatus,
    isBreached,
  };
}

export function createReferral(data: Omit<IntersectoralReferral, "id" | "createdAt" | "status" | "slaDeadlineDays"> & { slaDeadlineDays?: number }): ReferralWithSla {
  const id = `ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const referral: IntersectoralReferral = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
    status: "solicitado",
    slaDeadlineDays: data.slaDeadlineDays || 90,
  };
  referralsStore.set(id, referral);
  return enrichWithSla(referral);
}

export function listReferrals(filters?: { destination?: IntersectoralDestination; status?: ReferralStatus }): ReferralWithSla[] {
  let list = Array.from(referralsStore.values()).map(enrichWithSla);

  if (filters?.destination) {
    list = list.filter((r) => r.destination === filters.destination);
  }
  if (filters?.status) {
    list = list.filter((r) => r.status === filters.status);
  }

  // Ordena por criticidade (dias decorridos decrescente)
  return list.sort((a, b) => b.daysElapsed - a.daysElapsed);
}

export function updateReferralStatus(
  id: string,
  newStatus: ReferralStatus,
  feedbackNotes?: string
): ReferralWithSla | null {
  const ref = referralsStore.get(id);
  if (!ref) return null;

  ref.status = newStatus;
  if (feedbackNotes) {
    ref.feedbackNotes = feedbackNotes;
  }
  if (newStatus === "acolhido" && !ref.receivedAt) {
    ref.receivedAt = new Date().toISOString();
  }
  if (newStatus === "contrarreferencia_concluida") {
    ref.completedAt = new Date().toISOString();
  }

  referralsStore.set(id, ref);
  return enrichWithSla(ref);
}

export function getIntersectoralMonitoringSummary() {
  const all = Array.from(referralsStore.values()).map(enrichWithSla);

  const byDestination = {
    UBS: all.filter((r) => r.destination === "UBS").length,
    CAPS_IJ: all.filter((r) => r.destination === "CAPS_IJ").length,
    CAPS_AJ: all.filter((r) => r.destination === "CAPS_AJ").length,
    CRAS: all.filter((r) => r.destination === "CRAS").length,
    CREAS: all.filter((r) => r.destination === "CREAS").length,
    CONSELHO_TUTELAR: all.filter((r) => r.destination === "CONSELHO_TUTELAR").length,
  };

  const bySlaAlert = {
    no_prazo: all.filter((r) => r.slaStatus === "no_prazo").length,
    atencao: all.filter((r) => r.slaStatus === "atencao").length,
    urgente: all.filter((r) => r.slaStatus === "urgente").length,
    prazo_estourado_90d: all.filter((r) => r.slaStatus === "prazo_estourado_90d").length,
  };

  const total = all.length;
  const noPrazoOuConcluido = all.filter((r) => !r.isBreached).length;
  const complianceRate = total > 0 ? Number(((noPrazoOuConcluido / total) * 100).toFixed(1)) : 100;

  return {
    totalCasosEncaminhados: total,
    taxaConformidadeLei90d: complianceRate,
    distribuicaoPorRede: byDestination,
    alertaPrazos90d: bySlaAlert,
    casosCriticos: all.filter((r) => r.slaStatus === "urgente" || r.slaStatus === "prazo_estourado_90d"),
  };
}
