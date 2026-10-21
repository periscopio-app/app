/**
 * Catálogo de capacidades (privilégios) do Periscópio — fonte única do que cada perfil pode fazer ou ver.
 *
 * Como funciona a decisão (do mais específico ao mais geral):
 *   1. Capacidade "travada" (locked): só o Administrador Master; nunca configurável.
 *   2. Exceção do USUÁRIO (privilege_user_grants): permitir ou negar só para aquela pessoa.
 *   3. Regra do PERFIL na rede (privilege_role_grants, escopo do tenant), depois a regra GLOBAL.
 *   4. Padrão do catálogo abaixo (espelha a matriz documentada do PM, de 09/out/2026).
 *
 * O Administrador Master (admin_platform) marca/desmarca caixinhas em /admin/privileges;
 * o servidor aplica a decisão em cada rota por requireCapability(). Isolamento por tenant/escola
 * continua valendo SEMPRE, independentemente de qualquer caixinha.
 */
import {
  BOARD_MANAGER_ROLES,
  BOARD_REQUESTER_ROLES,
  CASE_LIST_ROLES,
  MANAGEMENT_VIEW_ROLES,
  NUCLEO_DIRECTORY_ROLES,
  NUCLEO_SECTION_ROLES,
  REGISTRY_ROLES,
  STAFF_DIRECTORY_ROLES,
} from "./permissions";
import { CLINICAL_ROLES, SPECIALIST_CLINICAL_ROLES, TRIAGEM_ROLES, hasRole, type Role } from "./roles";

/** Perfis exibidos como colunas da matriz (apelidos como "re", "medico" são normalizados para estes). */
export const CONFIGURABLE_ROLES = [
  "admin_platform",
  "board",
  "municipal_manager",
  "school_manager",
  "teacher",
  "ppi",
  "md1",
  "specialist",
  "researcher",
] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export const CONFIGURABLE_ROLE_LABELS: Record<ConfigurableRole, string> = {
  admin_platform: "Administrador Master",
  board: "Board de Especialistas",
  municipal_manager: "Gestor(a) Municipal",
  school_manager: "Gestor(a) Escolar / Diretor(a)",
  teacher: "Professor(a)",
  ppi: "Responsável Escolar (RE)",
  md1: "Médico(a)",
  specialist: "Especialista do Núcleo",
  researcher: "Pesquisador(a)",
};

const ALIAS_TO_CANONICAL: Record<string, ConfigurableRole> = {
  admin_platform: "admin_platform",
  adm_master: "admin_platform",
  board: "board",
  board_especialistas: "board",
  municipal_manager: "municipal_manager",
  gestor_municipal: "municipal_manager",
  school_manager: "school_manager",
  diretor: "school_manager",
  teacher: "teacher",
  ppi: "ppi",
  re: "ppi",
  responsavel_escolar: "ppi",
  md1: "md1",
  medico: "md1",
  md: "md1",
  researcher: "researcher",
};

export function canonicalRole(role: string): ConfigurableRole {
  return ALIAS_TO_CANONICAL[role] ?? "specialist";
}

export type CapabilityGroup =
  | "plataforma"
  | "cadastro"
  | "avaliacao_re"
  | "medico"
  | "especialista"
  | "triagem_tea"
  | "dados_sensiveis"
  | "gestao"
  | "board";

export const CAPABILITY_GROUP_LABELS: Record<CapabilityGroup, string> = {
  plataforma: "Plataforma e privilégios",
  cadastro: "Cadastro e fila de casos",
  avaliacao_re: "Avaliação da escola (FOGAP)",
  medico: "Médico: prontuário e decisão",
  especialista: "Especialistas do núcleo",
  triagem_tea: "Triagem TEA (5 instrumentos)",
  dados_sensiveis: "Dados sensíveis (cofre, anexos, consentimento)",
  gestao: "Gestão, indicadores e rede",
  board: "Board de especialistas",
};

export interface CapabilityDef {
  key: string;
  group: CapabilityGroup;
  label: string;
  description: string;
  /** Perfis que têm a capacidade quando ninguém configurou nada. */
  defaultRoles: readonly (Role | string)[];
  /** Para o perfil "specialist": limita o padrão a estas especialidades (a exceção do admin vale para todas). */
  defaultSpecialties?: readonly string[];
  /** Dado sensível: a tela pede confirmação extra e a mudança vai para a trilha de auditoria destacada. */
  sensitive?: boolean;
  /** Só o Administrador Master; não aparece como caixinha editável. */
  locked?: boolean;
}

const ADMIN = ["admin_platform", "adm_master"] as const;
const RE_ROLES = ["ppi", "re", "responsavel_escolar"] as const;
const MD_ROLES = ["md1", "medico", "md"] as const;
/** Documentos clínicos anexados ao caso: só o núcleo (médico e especialistas). O RE e o professor não os veem. */
const ATTACHMENT_ROLES = [...MD_ROLES, ...SPECIALIST_CLINICAL_ROLES] as const;

export const CAPABILITIES = [
  // ── Plataforma ──────────────────────────────────────────────────────────
  { key: "privileges.manage", group: "plataforma", label: "Definir privilégios (esta tela)", description: "Marcar e desmarcar o que cada perfil e cada pessoa pode ver e fazer.", defaultRoles: ADMIN, locked: true },
  { key: "users.manage", group: "plataforma", label: "Gerir usuários e convites", description: "Criar, alterar perfil, desativar e reativar usuários.", defaultRoles: ADMIN, locked: true },
  { key: "schools.provision", group: "plataforma", label: "Provisionar escolas e redes", description: "Criar escola/rede e abrir a instância do município.", defaultRoles: ADMIN, locked: true },
  { key: "population.import", group: "plataforma", label: "Importar dados populacionais (Tarumã)", description: "Carga de dados agregados do município.", defaultRoles: ADMIN, locked: true },
  { key: "system.observability.view", group: "plataforma", label: "Ver a saúde do sistema", description: "Erros, lentidão, banco, e-mail e configuração da plataforma.", defaultRoles: ADMIN, locked: true },
  { key: "lgpd.manage", group: "plataforma", label: "Governança LGPD (DPO)", description: "Tratar pedidos de titulares e consultar a política de retenção.", defaultRoles: ADMIN, locked: true },

  // ── Cadastro e fila ─────────────────────────────────────────────────────
  { key: "student.register", group: "cadastro", label: "Cadastrar alunos (código pseudonimizado)", description: "Criar aluno por código, sem nome nem documento.", defaultRoles: REGISTRY_ROLES },
  { key: "student.list", group: "cadastro", label: "Listar alunos da escola", description: "Ver a lista de alunos (códigos) da escola.", defaultRoles: REGISTRY_ROLES },
  { key: "case.create", group: "cadastro", label: "Abrir caso", description: "Abrir caso para um aluno cadastrado.", defaultRoles: REGISTRY_ROLES },
  { key: "case.list", group: "cadastro", label: "Ver a fila de casos", description: "Listar casos (da escola, para o RE; da rede, para o médico).", defaultRoles: CASE_LIST_ROLES },
  { key: "directory.staff", group: "cadastro", label: "Ver profissionais da escola", description: "Diretório administrativo (nome, papel, especialidade).", defaultRoles: STAFF_DIRECTORY_ROLES },
  { key: "directory.nucleo", group: "cadastro", label: "Ver especialistas do núcleo", description: "Diretório que o médico usa para delegar.", defaultRoles: NUCLEO_DIRECTORY_ROLES },
  { key: "case.forward", group: "cadastro", label: "Encaminhar caso ao médico", description: "Passar o caso da escola para o núcleo assistencial.", defaultRoles: TRIAGEM_ROLES },

  // ── Avaliação da escola ─────────────────────────────────────────────────
  { key: "fogap.read", group: "avaliacao_re", label: "Ler a avaliação do RE (FOGAP)", description: "Abrir a avaliação enviada pelo Responsável Escolar.", defaultRoles: ["ppi", "md1"], sensitive: true },
  { key: "fogap.fill", group: "avaliacao_re", label: "Preencher e enviar o FOGAP", description: "Criar, editar rascunho e enviar a avaliação da escola.", defaultRoles: [...RE_ROLES, "teacher", ...ADMIN], sensitive: true },
  { key: "scales.fill", group: "avaliacao_re", label: "Registrar escalas (SNAP-IV, ABC, M-CHAT...)", description: "Salvar respostas de escalas clínicas.", defaultRoles: CLINICAL_ROLES, sensitive: true },
  { key: "scales.read", group: "avaliacao_re", label: "Ler escalas registradas", description: "Consultar escalas já registradas.", defaultRoles: CLINICAL_ROLES, sensitive: true },
  { key: "scales.score", group: "avaliacao_re", label: "Usar calculadoras de pontuação", description: "SNAP-IV e ABC (indicador de apoio, não é diagnóstico).", defaultRoles: CLINICAL_ROLES },

  // ── Médico ──────────────────────────────────────────────────────────────
  { key: "md.form.read", group: "medico", label: "Ler os formulários do médico", description: "Anamnese, exame, hipótese e conduta, encaminhamentos, seguimento e sumário médico.", defaultRoles: ["md1"], sensitive: true },
  { key: "md.form.fill", group: "medico", label: "Preencher os formulários do médico", description: "Salvar rascunho, concluir e reabrir (com motivo) as seções do médico.", defaultRoles: ["md1"], sensitive: true },
  { key: "case.delegate", group: "medico", label: "Delegar seções a especialistas", description: "Escolher especialidades e profissionais do núcleo.", defaultRoles: ["md1"] },
  { key: "case.return", group: "medico", label: "Devolver caso ao RE", description: "Reabrir a avaliação da escola com motivo formal.", defaultRoles: ["md1"] },
  { key: "prontuario.consolidado.read", group: "medico", label: "Ver o prontuário consolidado", description: "Todas as seções concluídas dos especialistas.", defaultRoles: ["md1"], sensitive: true },
  { key: "prontuario.full_summary.read", group: "medico", label: "Ver o sumário completo do caso", description: "Resumo executivo com a decisão médica.", defaultRoles: ["md1"], sensitive: true },
  { key: "case.events.read", group: "medico", label: "Ver a trilha do caso", description: "Linha do tempo e auditoria de eventos do caso.", defaultRoles: ["md1"] },
  { key: "case.close", group: "medico", label: "Encerrar caso (decisão final)", description: "Registrar encaminhamento, acompanhamento ou alta. Irreversível.", defaultRoles: ["md1"], sensitive: true },

  // ── Especialistas ───────────────────────────────────────────────────────
  { key: "section.read", group: "especialista", label: "Ver as seções delegadas", description: "Abrir a própria seção e os sumários concluídos dos colegas.", defaultRoles: SPECIALIST_CLINICAL_ROLES, sensitive: true },
  { key: "section.fill", group: "especialista", label: "Preencher e concluir a própria seção", description: "Salvar rascunho e concluir o parecer da especialidade.", defaultRoles: SPECIALIST_CLINICAL_ROLES, sensitive: true },

  // ── Triagem TEA ─────────────────────────────────────────────────────────
  { key: "tea.ata.fill", group: "triagem_tea", label: "ATA — preencher (RE)", description: "Escala de Traços Autísticos; o RE pede ao responsável.", defaultRoles: RE_ROLES, sensitive: true },
  { key: "tea.asq.fill", group: "triagem_tea", label: "ASQ/SCQ — preencher (Médico)", description: "Questionário de comunicação social (40 itens).", defaultRoles: MD_ROLES, sensitive: true },
  { key: "tea.mchat.fill", group: "triagem_tea", label: "M-CHAT — preencher (Assistente Social)", description: "Questionário para crianças de 16 a 30 meses.", defaultRoles: ["specialist"], defaultSpecialties: ["servico_social"], sensitive: true },
  { key: "tea.srs2.fill", group: "triagem_tea", label: "SRS-2 — preencher (Fonoaudiologia)", description: "Escala de responsividade social (65 itens). Direitos de uso a confirmar.", defaultRoles: ["specialist"], defaultSpecialties: ["fonoaudiologia"], sensitive: true },
  { key: "tea.abc.fill", group: "triagem_tea", label: "ABC — preencher (Psicologia)", description: "Checklist de comportamento (57 itens).", defaultRoles: ["specialist"], defaultSpecialties: ["psicologia", "neuropsicologia"], sensitive: true },
  { key: "tea.read_all", group: "triagem_tea", label: "Ver todos os instrumentos TEA do caso", description: "Ler as respostas dos 5 instrumentos, não só do próprio.", defaultRoles: ["md1"], sensitive: true },
  { key: "tea.score.view", group: "triagem_tea", label: "Ver totais e subtotais", description: "Pontos por instrumento e por domínio (indicador de apoio).", defaultRoles: ["md1", "specialist", "ppi"] },
  { key: "tea.reference.view", group: "triagem_tea", label: "Ver faixa de referência do formulário", description: "Mostra a faixa citada no formulário-fonte. Desligada até a validação clínica.", defaultRoles: [], sensitive: true },
  { key: "tea.ai_summary", group: "triagem_tea", label: "Gerar sumário organizado por IA", description: "Organiza as observações marcadas, sem diagnóstico e sem identificar o aluno.", defaultRoles: ["md1", "ppi"] },

  // ── Dados sensíveis ─────────────────────────────────────────────────────
  { key: "vault.register", group: "dados_sensiveis", label: "Cadastrar identidade no cofre", description: "Guardar nome civil cifrado do aluno.", defaultRoles: [...CLINICAL_ROLES, "admin_platform"], sensitive: true },
  { key: "vault.reveal", group: "dados_sensiveis", label: "Revelar identidade do cofre", description: "Exige justificativa e fica na auditoria.", defaultRoles: CLINICAL_ROLES, sensitive: true },
  { key: "student.name.view", group: "dados_sensiveis", label: "Ver o nome do aluno na tela do caso", description: "Mostra o nome direto no cabeçalho do caso, sem pedir justificativa; cada abertura fica na auditoria. Só vale para a equipe do caso (RE e professor da escola, médico da rede, especialista com seção delegada); gestão, Board, pesquisa e administração nunca recebem o nome. Desligada até a aprovação clínica e do DPO.", defaultRoles: [], sensitive: true },
  { key: "attachments.write", group: "dados_sensiveis", label: "Anexar documentos clínicos", description: "Enviar arquivos ao caso (núcleo: médico e especialistas; não aparece para o RE).", defaultRoles: ATTACHMENT_ROLES, sensitive: true },
  { key: "attachments.read", group: "dados_sensiveis", label: "Baixar documentos clínicos", description: "Abrir anexos por link assinado temporário (núcleo: médico e especialistas; não aparece para o RE).", defaultRoles: ATTACHMENT_ROLES, sensitive: true },
  { key: "consent.write", group: "dados_sensiveis", label: "Registrar consentimento (TCLE)", description: "Registrar o aceite do responsável legal.", defaultRoles: [...CLINICAL_ROLES] },
  { key: "consent.read", group: "dados_sensiveis", label: "Ver aceites de consentimento", description: "Consultar quem aceitou e quando (documento mascarado).", defaultRoles: [...CLINICAL_ROLES], sensitive: true },

  // ── Gestão e rede ───────────────────────────────────────────────────────
  { key: "management.view", group: "gestao", label: "Sumário do RE e lista de encaminhados", description: "Visão da gestão, sem conteúdo clínico.", defaultRoles: MANAGEMENT_VIEW_ROLES },
  { key: "management.observability.view", group: "gestao", label: "Observabilidade do fluxo do RE", description: "Tempo mediano de preenchimento por parte, tempo ganho, uso do passo opcional e andamento da triagem TEA, tudo agregado (grupos pequenos ocultos).", defaultRoles: MANAGEMENT_VIEW_ROLES },
  { key: "management.baselines.edit", group: "gestao", label: "Informar tempo de referência (papel)", description: "Quanto tempo cada parte leva no processo em papel; base do cálculo de tempo ganho.", defaultRoles: ["admin_platform", "municipal_manager"] },
  { key: "pilot.indicators.view", group: "gestao", label: "Indicadores do piloto (grupo)", description: "Os 5 indicadores de avaliação do piloto por escola e na rede. Grupos pequenos ficam ocultos (\"<5\").", defaultRoles: ["admin_platform", "municipal_manager", "school_manager", "ppi", "board", "researcher", "md1"] },
  { key: "pilot.indicators.case.view", group: "gestao", label: "Indicadores do piloto (aluno)", description: "Acompanhar o percurso de um aluno pelo código nos indicadores do piloto.", defaultRoles: ["md1", "ppi"], sensitive: true },
  { key: "pilot.symptoms.record", group: "gestao", label: "Registrar medida de sintomas (inicial e reavaliação)", description: "Gravar a medida do indicador 5. A escola registra a da escola; o núcleo, a do núcleo.", defaultRoles: [...RE_ROLES, ...MD_ROLES, ...SPECIALIST_CLINICAL_ROLES], sensitive: true },
  { key: "bi.view", group: "gestao", label: "BI do gestor", description: "Indicadores agregados (grupos pequenos ocultos).", defaultRoles: ["admin_platform", "municipal_manager", "school_manager", "ppi", "board", "researcher", "md1"] },
  { key: "bi.approve", group: "gestao", label: "Aprovar perguntas do assistente de BI", description: "Aprovar consultas para o catálogo.", defaultRoles: ["admin_platform", "municipal_manager", "board"] },
  { key: "population.view", group: "gestao", label: "Mapa de prevalência (Tarumã)", description: "Painel populacional agregado.", defaultRoles: ["admin_platform", "municipal_manager", "school_manager", "ppi", "board", "researcher", "md1"] },
  { key: "population.geo", group: "gestao", label: "Mapa: camadas geográficas", description: "Camadas de localização agregadas.", defaultRoles: ["admin_platform", "municipal_manager", "school_manager", "ppi"] },
  { key: "intersectoral.use", group: "gestao", label: "Rede intersetorial (CRAS, CAPS, UBS)", description: "Encaminhamentos e prazo de 90 dias.", defaultRoles: ["admin_platform", "adm_master", "municipal_manager", "gestor_municipal", ...MD_ROLES, ...RE_ROLES] },

  // ── Board ───────────────────────────────────────────────────────────────
  { key: "board.request", group: "board", label: "Pedir ajuda ao Board", description: "Solicitar reunião com especialistas em casos graves.", defaultRoles: BOARD_REQUESTER_ROLES },
  { key: "board.manage", group: "board", label: "Gerir agenda do Board", description: "Liberar horários e confirmar pedidos.", defaultRoles: BOARD_MANAGER_ROLES },
] as const satisfies readonly CapabilityDef[];

export type CapabilityKey = (typeof CAPABILITIES)[number]["key"];
export const CAPABILITY_BY_KEY: Record<string, CapabilityDef> = Object.fromEntries(
  (CAPABILITIES as readonly CapabilityDef[]).map((c) => [c.key, c])
);

export function isCapabilityKey(key: string): key is CapabilityKey {
  return key in CAPABILITY_BY_KEY;
}

/** Quando o perfil já diz a especialidade (ex.: "fonoaudiologa"), usa isso se o cadastro não trouxe `specialty`. */
const ROLE_TO_SPECIALTY: Record<string, string> = {
  as: "servico_social",
  servico_social: "servico_social",
  neuropsicologo: "neuropsicologia",
  neuropsicologia: "neuropsicologia",
  psicomotricista: "psicomotricidade",
  psicomotricidade: "psicomotricidade",
  psicoterapeuta: "psicologia",
  psicologo: "psicologia",
  psicologa: "psicologia",
  psicologo_familiar: "psicologia",
  psicologa_familiar: "psicologia",
  fonoaudiologo: "fonoaudiologia",
  fonoaudiologa: "fonoaudiologia",
  psicopedagogo_clinico: "psicopedagogia",
  psicopedagoga_clinica: "psicopedagogia",
};

export function specialtyOf(role: string, specialty?: string | null): string | null {
  return specialty || ROLE_TO_SPECIALTY[role] || null;
}

/** Padrão do catálogo para um perfil (e, no caso de especialista, para uma especialidade). */
export function defaultAllowed(cap: CapabilityDef, role: string, specialty?: string | null): boolean {
  if (cap.defaultSpecialties && canonicalRole(role) === "specialist") {
    const sp = specialtyOf(role, specialty);
    return !!sp && cap.defaultSpecialties.includes(sp) && hasRole(role as Role, cap.defaultRoles);
  }
  return hasRole(role as Role, cap.defaultRoles);
}

export interface GrantMaps {
  /** concedido/negado no perfil canônico, já resolvido entre escopo do tenant e global */
  role: Map<string, boolean>;
  /** exceções da pessoa */
  user: Map<string, boolean>;
}

export type DecisionSource = "locked" | "user" | "role" | "default";

export interface Decision {
  allowed: boolean;
  source: DecisionSource;
}

/** Decisão pura (sem banco): usada pelo servidor e pelos testes. */
export function decide(
  cap: CapabilityDef,
  who: { role: string; specialty?: string | null },
  grants: GrantMaps
): Decision {
  if (cap.locked) return { allowed: canonicalRole(who.role) === "admin_platform", source: "locked" };
  const u = grants.user.get(cap.key);
  if (u !== undefined) return { allowed: u, source: "user" };
  const r = grants.role.get(cap.key);
  if (r !== undefined) return { allowed: r, source: "role" };
  return { allowed: defaultAllowed(cap, who.role, who.specialty), source: "default" };
}
