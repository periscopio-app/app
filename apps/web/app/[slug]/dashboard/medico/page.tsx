"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type CaseItem,
  type CaseSection,
  type ReAssessment,
  type TimelineEvent,
  type Professional,
  type Me,
} from "@/lib/api";
import { ProfileHero } from "@/components/ui/ProfileHero";
import { AuditTrail } from "@/components/ui/AuditTrail";
import { ProntuarioHeaderCard } from "@/components/dashboard/ProntuarioHeaderCard";
import { sumarioComPadroes } from "@periscopio/shared";
import { useNomeDoAluno } from "@/lib/nome-aluno";
import { ProntuarioHorizontalTabs, type ProntuarioTabKey } from "@/components/dashboard/ProntuarioHorizontalTabs";
import { MedicoFormsPanel } from "@/components/medico/MedicoFormsPanel";
import { EspecialidadesDevolutiva } from "@/components/medico/EspecialidadesDevolutiva";
import { ConsentCard } from "@/components/dashboard/ConsentCard";
import { StudentIdentityVaultCard } from "@/components/dashboard/StudentIdentityVaultCard";
import { CaseAttachmentsCard } from "@/components/dashboard/CaseAttachmentsCard";
import { TeaScreeningPanel } from "@/components/dashboard/TeaScreeningPanel";
import { FogapViewer } from "@/components/dashboard/FogapViewer";
import { ReJourneyPanel } from "@/components/re/ReJourneyPanel";
import { Button } from "@/components/ui";
import {
  ClipboardList,
  Users,
  FileSearch,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Lock,
  RotateCcw,
} from "lucide-react";

const JOURNEY_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_re: "Aguardando RE",
  revisao_medica: "Revisão Médica",
  delegado: "Delegado",
  retornado: "Retornado",
  encerrado: "Encerrado",
};

const JOURNEY_COLORS: Record<string, string> = {
  rascunho: "bg-ouro-100 text-black",
  enviado_re: "bg-ceu-100 text-black",
  revisao_medica: "bg-roxo-100 text-black",
  delegado: "bg-comunidade-100 text-black",
  retornado: "bg-ouro-100 text-black",
  encerrado: "bg-linha text-neutral-800",
};

const CLOSE_LABELS: Record<string, string> = {
  encaminhamento: "Encaminhamento",
  acompanhamento: "Acompanhamento",
  alta: "Alta",
  abandono: "Abandono",
  interrupcao_justificada: "Interrupção justificada",
};

const SPECIALTIES = [
  { id: "neuropsicologia", label: "Neuropsicólogo(a) — Avaliação Neuropsicológica" },
  { id: "fonoaudiologia", label: "Fonoaudiólogo(a)" },
  { id: "psicologia", label: "Psicoterapeuta / Psicólogo(a) Clínico(a)" },
  { id: "psicomotricidade", label: "Psicomotricista" },
  { id: "psicopedagogia", label: "Psicopedagogo(a) Clínico(a)" },
  { id: "servico_social", label: "Serviço Social (AS) — Diagnóstico Social e Acompanhamento Familiar" },
];


type ActiveView = "queue" | "re" | "delegate" | "consolidated" | "close" | "trail" | "return";

export default function MedicoDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCase, setActiveCase] = useState<CaseItem | null>(null);
  const nomeAluno = useNomeDoAluno(activeCase?.id);
  const [view, setView] = useState<ActiveView>("queue");
  const [aba, setAba] = useState<ProntuarioTabKey>("overview");
  // Especialidades já designadas neste caso (para acrescentar outras sem repetir).
  const [designadas, setDesignadas] = useState<CaseSection[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // RE assessment view
  const [reAssessment, setReAssessment] = useState<ReAssessment | null>(null);
  const [reLoading, setReLoading] = useState(false);
  // Lista de casos recolhível: com um caso aberto, o prontuário pode usar a largura toda.
  const [filaRecolhida, setFilaRecolhidaEstado] = useState(false);
  // Cabeçalho do prontuário recolhível: deixa a ficha ocupar a tela. As duas escolhas ficam lembradas neste navegador.
  const [cabecalhoRecolhido, setCabecalhoRecolhidoEstado] = useState(false);
  const lembrar = (chave: string, v: boolean) => {
    try { window.localStorage.setItem(chave, v ? "1" : "0"); } catch { /* sem armazenamento: vale só nesta sessão */ }
  };
  const setFilaRecolhida = (v: boolean) => { setFilaRecolhidaEstado(v); lembrar("periscopio:medico:fila", v); };
  const setCabecalhoRecolhido = (v: boolean) => { setCabecalhoRecolhidoEstado(v); lembrar("periscopio:medico:cabecalho", v); };
  useEffect(() => {
    try {
      setFilaRecolhidaEstado(window.localStorage.getItem("periscopio:medico:fila") === "1");
      setCabecalhoRecolhidoEstado(window.localStorage.getItem("periscopio:medico:cabecalho") === "1");
    } catch { /* segue expandido */ }
  }, []);

  // Delegation form
  const [delegations, setDelegations] = useState<Record<string, string>>({});
  const [delegating, setDelegating] = useState(false);

  // Consolidated view
  const [sections, setSections] = useState<CaseSection[]>([]);
  const [consolidatedLoading, setConsolidatedLoading] = useState(false);

  // Close case form
  type CloseDecision = "encaminhamento" | "acompanhamento" | "alta" | "abandono" | "interrupcao_justificada";
  const [closeDecision, setCloseDecision] = useState<CloseDecision>("acompanhamento");
  const [followUp, setFollowUp] = useState<"semestral" | "anual">("semestral");
  // 1 = precisa de avaliação neuropsicológica; 0 = não. Decisão do médico, sem ordem automática.
  const [needsNeuropsych, setNeedsNeuropsych] = useState<"" | "0" | "1">("");
  const [closeReason, setCloseReason] = useState("");
  const [closing, setClosing] = useState(false);

  // Return to RE form
  const [returnReason, setReturnReason] = useState("");
  const [returning, setReturning] = useState(false);

  // Audit trail
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);

  useEffect(() => {
    async function boot() {
      try {
        const meData = await api.get<{ user: Me }>("/api/me");
        setMe(meData.user);

        const [casesData, profsData] = await Promise.all([
          api.get<{ cases: CaseItem[] }>("/api/cases?states=revisao_medica,delegado,retornado"),
          api.get<{ professionals: Professional[] }>("/api/nucleo/professionals"),
        ]);
        setCases(casesData.cases ?? []);
        setProfessionals(profsData.professionals ?? []);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("Sessão")) {
          router.push(`/${slug}/login`);
        } else {
          setError("Erro ao carregar dados.");
        }
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, [slug, router]);

  async function carregarFogap(caseId: string) {
    setReLoading(true);
    try {
      const data = await api.get<{ assessment: ReAssessment | null }>(`/api/cases/${caseId}/re-assessment?completo=1`);
      setReAssessment(data.assessment);
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Erro ao carregar a avaliação do RE.");
    } finally {
      setReLoading(false);
    }
  }

  async function carregarDesignadas(caseId: string) {
    try {
      const data = await api.get<{ sections: CaseSection[] }>(`/api/cases/${caseId}/consolidated`);
      setDesignadas(data.sections ?? []);
    } catch {
      setDesignadas([]);
    }
  }

  async function openCase(c: CaseItem) {
    setActiveCase(c);
    setView("queue");
    setAba("overview");
    setActionMsg(null);
    setReAssessment(null);
    setSections([]);
    setDesignadas([]);
    setEvents([]);
    setDelegations({});
    setCloseReason("");
    setReturnReason("");
    // O médico recebe o FOGAP e os formulários do RE abertos, sem precisar clicar em nada.
    void carregarFogap(c.id);
    if (c.journeyState === "delegado" || c.journeyState === "retornado" || c.journeyState === "encerrado") void carregarDesignadas(c.id);
  }

  /** Atalho dos botões "Encaminhar a especialistas" / "Devolver ao RE": abre a aba de ações já na ação certa. */
  function irParaAcao(v: ActiveView) {
    setAba("clinical_actions");
    setView(v);
    setActionMsg(null);
    if (v === "delegate" && activeCase) void carregarDesignadas(activeCase.id);
  }

  async function loadReAssessment() {
    if (!activeCase) return;
    setView("re");
    setActionMsg(null);
    setReLoading(true);
    try {
      const data = await api.get<{ assessment: ReAssessment | null }>(
        `/api/cases/${activeCase.id}/re-assessment?completo=1`
      );
      setReAssessment(data.assessment);
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Erro ao carregar avaliação.");
    } finally {
      setReLoading(false);
    }
  }

  async function handleReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCase || !returnReason.trim()) return;
    const confirmed = window.confirm(
      "Devolver ao RE? O profissional poderá editar e reenviar a avaliação."
    );
    if (!confirmed) return;
    setReturning(true);
    setActionMsg(null);
    try {
      await api.post(`/api/cases/${activeCase.id}/return`, { reason: returnReason });
      const updated = cases.map((c) =>
        c.id === activeCase.id ? { ...c, journeyState: "rascunho" as const } : c
      );
      setCases(updated);
      setActiveCase((prev) => (prev ? { ...prev, journeyState: "rascunho" } : prev));
      setActionMsg("Caso devolvido ao RE para revisão.");
      setReturnReason("");
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Erro ao devolver caso.");
    } finally {
      setReturning(false);
    }
  }

  async function handleDelegate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCase) return;
    setDelegating(true);
    setActionMsg(null);
    const delegationList = Object.entries(delegations)
      .filter(([, profId]) => Boolean(profId))
      .map(([specialty, professionalId]) => ({ specialty, professionalId }));

    if (delegationList.length === 0) {
      setActionMsg("Selecione ao menos uma especialidade.");
      setDelegating(false);
      return;
    }

    try {
      await api.post(`/api/cases/${activeCase.id}/delegate`, {
        delegations: delegationList,
        reason: activeCase.journeyState === "delegado" ? "Acréscimo de especialista pelo médico" : "Delegação médica após revisão da avaliação da RE",
        needsNeuropsych: needsNeuropsych === "" ? undefined : needsNeuropsych === "1",
      });
      const updated = cases.map((c) =>
        c.id === activeCase.id ? { ...c, journeyState: "delegado" as const } : c
      );
      setCases(updated);
      setActiveCase((prev) => (prev ? { ...prev, journeyState: "delegado" } : prev));
      setActionMsg(`Caso delegado com sucesso para ${delegationList.length} especialidade(s).`);
      setDelegations({});
      void carregarDesignadas(activeCase.id);
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Erro ao delegar.");
    } finally {
      setDelegating(false);
    }
  }

  async function loadConsolidated() {
    if (!activeCase) return;
    setView("consolidated");
    setActionMsg(null);
    setConsolidatedLoading(true);
    try {
      const data = await api.get<{ sections: CaseSection[]; reAssessment: ReAssessment | null }>(
        `/api/cases/${activeCase.id}/consolidated`
      );
      setSections(data.sections ?? []);
      setReAssessment(data.reAssessment);
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Erro ao carregar consolidado.");
    } finally {
      setConsolidatedLoading(false);
    }
  }

  async function handleCloseCase(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCase || !closeReason.trim()) return;
    const confirmed = window.confirm(
      "Encerrar o caso é irreversível. Confirmar o encerramento?"
    );
    if (!confirmed) return;
    setClosing(true);
    setActionMsg(null);
    try {
      await api.post(`/api/cases/${activeCase.id}/close`, {
        decision: closeDecision,
        followUp: closeDecision === "acompanhamento" ? followUp : undefined,
        reason: closeReason,
      });
      const updated = cases.map((c) =>
        c.id === activeCase.id ? { ...c, journeyState: "encerrado" as const } : c
      );
      setCases(updated);
      setActiveCase((prev) => (prev ? { ...prev, journeyState: "encerrado" } : prev));
      setActionMsg("Caso encerrado com sucesso.");
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Erro ao encerrar caso.");
    } finally {
      setClosing(false);
    }
  }

  async function loadTrail() {
    if (!activeCase) return;
    setView("trail");
    setTrailLoading(true);
    setActionMsg(null);
    try {
      const data = await api.get<{ events: TimelineEvent[] }>(
        `/api/cases/${activeCase.id}/events`
      );
      setEvents(data.events ?? []);
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Erro ao carregar trilha.");
    } finally {
      setTrailLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-neutral-800 text-sm">
        Carregando painel médico...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {me && <ProfileHero me={me} slug={slug} />}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-erro/20 bg-erro/5 px-4 py-3 text-sm text-black">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-black">Painel Médico</h1>
        <p className="text-sm text-neutral-800 mt-0.5">
          Revisão clínica, delegação e encerramento de casos.
        </p>
      </div>

      {filaRecolhida && (
        <Button
          type="button"
          onClick={() => setFilaRecolhida(false)}
          data-testid="mostrar-fila"
          variant="outline" size="sm" className="mb-3"
        >
          <ClipboardList className="h-4 w-4" aria-hidden /> Mostrar fila de casos ({cases.length})
        </Button>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: case queue */}
        <div className={`rounded-2xl bg-white border border-linha p-4 shadow-suave ${filaRecolhida ? "hidden" : ""}`}>
          <h2 className="text-sm font-bold text-black mb-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-black" />
              Fila de casos ({cases.length})
            </span>
            {activeCase && (
              <Button
                type="button"
                onClick={() => setFilaRecolhida(true)}
                data-testid="recolher-fila"
                variant="outline" size="sm"
                title="Esconde a lista e abre o prontuário na largura toda"
              >
                Recolher lista
              </Button>
            )}
          </h2>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {cases.length === 0 && (
              <p className="text-xs text-neutral-800 text-center py-6">
                Nenhum caso aguardando revisão médica.
              </p>
            )}
            {cases.map((c) => {
              const currentYear = new Date().getFullYear();
              const idade = c.birthYear ? currentYear - c.birthYear : null;
              return (
                <button
                  key={c.id}
                  onClick={() => openCase(c)}
                  className={`w-full text-left rounded-xl border p-3 transition space-y-1.5 ${
                    activeCase?.id === c.id
                      ? "border-roxo bg-roxo-50 ring-1 ring-roxo/40"
                      : "border-linha hover:bg-fundo"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-black">{c.studentCode}</span>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        JOURNEY_COLORS[c.journeyState] ?? "bg-linha text-neutral-800"
                      }`}
                    >
                      {JOURNEY_LABELS[c.journeyState] ?? c.journeyState}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-700 flex flex-wrap gap-x-2">
                    <span><strong>Nome:</strong> {c.studentLabel || `Aluno (${c.studentCode.slice(-4)})`}</span>
                    <span>•</span>
                    <span><strong>Idade:</strong> {idade ? `${idade} anos` : "—"}</span>
                    {c.grade && (<><span>•</span><span><strong>Série:</strong> {c.grade}</span></>)}
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">
                    <strong>Escola:</strong> {c.schoolName || slug} · <strong>Profissional:</strong> {c.assignedToName || "Responsável Escolar"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: action panel */}
        <div className={filaRecolhida ? "lg:col-span-3" : "lg:col-span-2"}>
          {!activeCase ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linha bg-white py-20 text-center">
              <ClipboardList className="h-10 w-10 text-neutral-800/40 mb-3" />
              <p className="text-sm font-semibold text-black">
                Selecione um caso para revisar
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-linha shadow-suave overflow-hidden">
              {/* Prontuário Oficial - 5 Colunas Padronizadas */}
              <div className="p-4 sm:p-5 border-b border-linha bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-800">
                    {cabecalhoRecolhido ? `${activeCase.studentCode} · ${activeCase.grade ?? "série não informada"} · ${JOURNEY_LABELS[activeCase.journeyState] ?? activeCase.journeyState}` : "Prontuário do aluno"}
                  </span>
                  <Button
                    type="button"
                    onClick={() => setCabecalhoRecolhido(!cabecalhoRecolhido)}
                    aria-expanded={!cabecalhoRecolhido}
                    data-testid="recolher-cabecalho"
                    variant="outline" size="sm"
                  >
                    {cabecalhoRecolhido ? "Mostrar cabeçalho" : "Recolher cabeçalho"}
                  </Button>
                </div>
                <div className={cabecalhoRecolhido ? "hidden" : ""}>
                <ProntuarioHeaderCard
                  studentCode={activeCase.studentCode}
                  studentName={`Aluno (${activeCase.studentCode.slice(-6)})`}
                  nomeCompleto={nomeAluno.fullName}
                  schoolName={activeCase.schoolName || slug}
                  grade={activeCase.grade}
                  ageText={activeCase.birthYear ? `${new Date().getFullYear() - activeCase.birthYear} anos` : "7–9 anos (Piloto)"}
                  professionalName={activeCase.assignedToName || me?.name || "Médico(a) Avaliador(a)"}
                  professionalRole={me?.role || "md1"}
                  journeyState={activeCase.journeyState}
                  queixaEscola={
                    reLoading && !reAssessment
                      ? undefined
                      : sumarioComPadroes(((reAssessment?.payload ?? {}) as Record<string, unknown>)["secao_sumario"] as never).queixa_professor ?? ""
                  }
                />
                </div>

                {/* Navegação Horizontal do Prontuário Clínico */}
                <div className="pt-2">
                  <ProntuarioHorizontalTabs
                    caseId={activeCase.id}
                    studentId={activeCase.studentId}
                    studentCode={activeCase.studentCode}
                    isDoctorOrMaster={true}
                    activeTab={aba}
                    onTabChange={(t) => {
                      setAba(t);
                      if (t === "clinical_actions" && view === "queue") irParaAcao("delegate");
                    }}
                    childrenMedical={
                      <MedicoFormsPanel
                        caseId={activeCase.id}
                        schoolName={activeCase.schoolName || slug}
                        studentCode={activeCase.studentCode}
                        queixaEscola={
                          reAssessment
                            ? sumarioComPadroes(((reAssessment.payload ?? {}) as Record<string, unknown>)["secao_sumario"] as never).queixa_professor ?? ""
                            : undefined
                        }
                      />
                    }
                    childrenOverview={
                      <div className="space-y-4">
                        {/* Próximos passos do médico: o que fazer com este caso, sempre à vista */}
                        <section aria-label="Próximos passos do médico" className="rounded-2xl border border-roxo/30 bg-roxo-50 p-4 space-y-3">
                          <div>
                            <h3 className="text-sm font-bold text-black">O que você pode fazer com este caso</h3>
                            <p className="text-xs text-neutral-800">
                              Abaixo está o sumário do RE (FOGAP / Formulário I). Depois de ler, escolha o próximo passo.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={() => irParaAcao("delegate")}
                              disabled={activeCase.journeyState !== "revisao_medica" && activeCase.journeyState !== "delegado"}
                              variant="primary" size="md"
                            >
                              <Users className="h-4 w-4" aria-hidden />
                              {activeCase.journeyState === "delegado" ? "Acrescentar especialista" : "Encaminhar a especialistas"}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => setAba("medical")}
                              variant="outline" size="md"
                            >
                              <ClipboardList className="h-4 w-4" aria-hidden /> Abrir formulário do médico
                            </Button>
                            <Button
                              type="button"
                              onClick={() => irParaAcao("return")}
                              disabled={activeCase.journeyState !== "revisao_medica"}
                              variant="outline" size="md"
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden /> Devolver ao RE
                            </Button>
                          </div>
                          {activeCase.journeyState !== "revisao_medica" && activeCase.journeyState !== "delegado" && (
                            <p className="text-[11px] text-neutral-800">
                              Encaminhar e devolver só ficam disponíveis com o caso em revisão médica (este caso está: {JOURNEY_LABELS[activeCase.journeyState] ?? activeCase.journeyState}).
                            </p>
                          )}
                        </section>

                        <div className="flex items-center justify-between border-b border-linha pb-3">
                          <h3 className="font-semibold text-black flex items-center gap-2">
                            <FileSearch className="h-4 w-4 text-black" />
                            Sumário do RE (Formulário I)
                          </h3>
                          <button
                            type="button"
                            onClick={() => activeCase && void carregarFogap(activeCase.id)}
                            className="text-xs text-roxo font-bold hover:underline"
                          >
                            Atualizar
                          </button>
                        </div>
                        {reLoading ? (
                          <p className="text-sm text-neutral-800">Carregando avaliação...</p>
                        ) : !reAssessment ? (
                          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
                            <p className="text-sm text-neutral-800">
                              Nenhuma avaliação FOGAP enviada para este caso ainda.
                            </p>
                          </div>
                        ) : (
                          <FogapViewer
                            payload={reAssessment.payload}
                            status={reAssessment.status}
                            submittedAt={reAssessment.submittedAt}
                            studentCode={activeCase.studentCode}
                            birthYear={activeCase.birthYear}
                            birthMonth={activeCase.birthMonth}
                            grade={activeCase.grade}
                            schoolName={activeCase.schoolName}
                          />
                        )}

                        {/* O médico vê tudo o que a escola registrou sobre a criança encaminhada (somente leitura) */}
                        <details className="rounded-2xl border border-linha bg-white p-4" data-testid="registro-completo-escola">
                          <summary className="cursor-pointer text-sm font-bold text-black">Tudo o que a escola registrou (formulários A a I, escalas e ATA)</summary>
                          <div className="mt-4">
                            <ReJourneyPanel caseId={activeCase.id} somenteLeitura />
                          </div>
                        </details>

                        {/* Devolutiva dos especialistas: só o sumário executivo, direto no painel do médico */}
                        {["delegado", "retornado", "encerrado"].includes(activeCase.journeyState) && (
                          <div className="border-t border-linha pt-4">
                            <EspecialidadesDevolutiva caseId={activeCase.id} />
                          </div>
                        )}
                      </div>
                    }
                    childrenActions={
                      <div className="space-y-4">
                        {/* Case action tabs header */}
                        <div className="flex items-center justify-between px-2 py-2 border-b border-linha">
                          <div>
                            <h3 className="text-sm font-bold text-black">Encaminhar, devolver e encerrar</h3>
                            <p className="text-[11px] text-neutral-500">Encaminhamento ao núcleo, devolução ao RE, consolidado e encerramento (decisões do médico)</p>
                          </div>
                          <nav className="flex flex-wrap gap-1">
                            {[
                              { id: "re" as ActiveView, label: "Sumário do RE", icon: FileSearch, action: loadReAssessment },
                              { id: "delegate" as ActiveView, label: "Encaminhar", icon: Users, action: () => irParaAcao("delegate") },
                              { id: "return" as ActiveView, label: "Devolver", icon: RotateCcw, action: () => { setView("return"); setActionMsg(null); } },
                              { id: "consolidated" as ActiveView, label: "Consolidado", icon: ClipboardList, action: loadConsolidated },
                              { id: "close" as ActiveView, label: "Encerrar", icon: CheckCircle, action: () => { setView("close"); setActionMsg(null); } },
                              { id: "trail" as ActiveView, label: "Trilha", icon: Lock, action: loadTrail },
                            ].map(({ id, label, icon: Icon, action }) => (
                              <button
                                key={id}
                                onClick={action}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                  view === id
                                    ? "bg-roxo-100 border border-roxo text-black"
                                    : "text-neutral-800 hover:bg-fundo hover:text-black"
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                              </button>
                            ))}
                          </nav>
                        </div>

              <div className="p-6">
                {actionMsg && (
                  <div
                    className={`mb-4 rounded-xl px-4 py-3 text-sm ${
                      actionMsg.includes("sucesso") || actionMsg.includes("delegado") || actionMsg.includes("encerrado")
                        ? "bg-sucesso/10 text-black"
                        : "bg-erro/10 text-black"
                    }`}
                  >
                    {actionMsg}
                  </div>
                )}

                {/* RE Assessment view */}
                {view === "re" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-black flex items-center gap-2">
                      <FileSearch className="h-4 w-4 text-black" />
                      Sumário do RE (Formulário I / FOGAP)
                    </h3>
                    {reLoading ? (
                      <p className="text-sm text-neutral-800">Carregando avaliação...</p>
                    ) : !reAssessment ? (
                      <p className="text-sm text-neutral-800">
                        Nenhuma avaliação enviada para este caso ainda.
                      </p>
                    ) : (
                      <FogapViewer
                        payload={reAssessment.payload}
                        status={reAssessment.status}
                        submittedAt={reAssessment.submittedAt}
                        studentCode={activeCase.studentCode}
                        birthYear={activeCase.birthYear}
                        birthMonth={activeCase.birthMonth}
                        grade={activeCase.grade}
                        schoolName={activeCase.schoolName}
                      />
                    )}
                    <p className="text-[11px] text-neutral-700">Você lê o sumário do RE (Formulário I) e as respostas do FOGAP item a item. Os formulários A a H estão em “Tudo o que a escola registrou”.</p>
                  </div>
                )}

                {/* Encaminhar a especialistas (delegação) */}
                {view === "delegate" && (
                  <form onSubmit={handleDelegate} className="space-y-4">
                    <h3 className="font-semibold text-black flex items-center gap-2">
                      <Users className="h-4 w-4 text-black" />
                      Encaminhar a especialistas
                    </h3>
                    {activeCase.journeyState !== "revisao_medica" && activeCase.journeyState !== "delegado" && (
                      <div className="flex items-center gap-2 rounded-xl border border-ceu-300 bg-ceu-50 px-4 py-3 text-sm text-black">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        O encaminhamento fica disponível quando o caso está em revisão médica (ou já delegado, para acrescentar outro especialista).
                      </div>
                    )}
                    {activeCase.journeyState === "delegado" && (
                      <p className="rounded-xl border border-linha bg-fundo px-4 py-3 text-xs text-black">
                        Este caso já tem especialistas designados. Você pode <strong>acrescentar</strong> outras especialidades; as já designadas aparecem marcadas.
                      </p>
                    )}
                    <p className="text-xs text-neutral-800">
                      Escolha, para cada especialidade que o caso precisar, o profissional do núcleo. Quem você escolher preenche só o próprio formulário e recebe apenas o seu sumário executivo (o Sumário médico, depois de concluído). As anotações de cada profissional ficam com ele, e ele as traz para a discussão.
                    </p>
                    <label className="block text-xs font-semibold text-black">
                      Precisa de avaliação neuropsicológica? (decisão do médico; sem ordem automática)
                      <select
                        value={needsNeuropsych}
                        onChange={(e) => setNeedsNeuropsych(e.target.value as "" | "0" | "1")}
                        className="mt-1 w-full rounded-xl border border-linha bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Não registrar</option>
                        <option value="0">Não (0)</option>
                        <option value="1">Sim (1)</option>
                      </select>
                    </label>
                    <div className="space-y-3">
                      {SPECIALTIES.map((spec) => {
                        const jaDesignada = designadas.find((d) => d.specialty === spec.id);
                        const opcoes = professionals
                          .filter((p) => p.role === "specialist" || p.specialty === spec.id || p.role === spec.id)
                          .sort((a, b) => Number(b.specialty === spec.id) - Number(a.specialty === spec.id));
                        const podeEscolher = (activeCase.journeyState === "revisao_medica" || activeCase.journeyState === "delegado") && !jaDesignada;
                        return (
                          <div key={spec.id} className="grid grid-cols-1 sm:grid-cols-5 items-center gap-2 sm:gap-3">
                            <span className="sm:col-span-2 text-sm font-semibold text-black">{spec.label}</span>
                            {jaDesignada ? (
                              <span className="sm:col-span-3 rounded-xl border border-sucesso/40 bg-sucesso/10 px-3 py-2 text-sm text-black">
                                Já designada{jaDesignada.professionalName ? ` · ${jaDesignada.professionalName}` : ""} ({jaDesignada.status})
                              </span>
                            ) : (
                              <div className="sm:col-span-3 space-y-1">
                                <select
                                  aria-label={`Profissional para ${spec.label}`}
                                  className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black bg-white outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                                  value={delegations[spec.id] ?? ""}
                                  onChange={(e) => setDelegations((prev) => ({ ...prev, [spec.id]: e.target.value }))}
                                  disabled={!podeEscolher}
                                >
                                  <option value="">Não encaminhar</option>
                                  {opcoes.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                      {p.specialty && p.specialty !== spec.id ? ` — ${p.specialty}` : ""}
                                      {p.classCode ? ` · ${p.classCode}` : ""}
                                    </option>
                                  ))}
                                </select>
                                {opcoes.length === 0 && (
                                  <p className="text-[11px] text-neutral-800">
                                    Nenhum especialista cadastrado neste município. Peça ao Administrador para convidar o profissional (Usuários e perfis).
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={delegating || (activeCase.journeyState !== "revisao_medica" && activeCase.journeyState !== "delegado")}
                        variant="primary" size="md"
                      >
                        <ChevronRight className="h-4 w-4" />
                        {delegating ? "Encaminhando..." : activeCase.journeyState === "delegado" ? "Acrescentar especialistas" : "Confirmar encaminhamento"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Consolidated view */}
                {view === "consolidated" && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-black flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-black" />
                      Prontuário consolidado
                    </h3>
                    {consolidatedLoading ? (
                      <p className="text-sm text-neutral-800">Carregando...</p>
                    ) : sections.length === 0 ? (
                      <p className="text-sm text-neutral-800">
                        Nenhuma seção disponível ainda.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {sections.map((sec) => (
                          <div key={sec.id} className="rounded-xl border border-linha p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-black capitalize">
                                {sec.specialty}
                              </span>
                              <span
                                className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                                  sec.status === "concluido"
                                    ? "bg-sucesso/10 text-black"
                                    : "bg-ouro-100 text-black"
                                }`}
                              >
                                {sec.status}
                              </span>
                            </div>
                            {sec.notes && (
                              <p className="text-xs text-black whitespace-pre-wrap">{sec.notes}</p>
                            )}
                            {sec.professionalName && (
                              <p className="text-[11px] text-neutral-800 mt-2">
                                {sec.professionalName}
                                {sec.professionalClassCode
                                  ? ` · ${sec.professionalClassCode}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <EspecialidadesDevolutiva caseId={activeCase.id} />
                  </div>
                )}

                {/* Return to RE form */}
                {view === "return" && (
                  <form onSubmit={handleReturn} className="space-y-4">
                    <h3 className="font-semibold text-black flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-black" />
                      Devolver ao RE
                    </h3>
                    {activeCase.journeyState !== "revisao_medica" ? (
                      <div className="flex items-center gap-2 rounded-xl border border-linha bg-fundo px-4 py-3 text-sm text-black">
                        <AlertCircle className="h-4 w-4 shrink-0 text-neutral-800" />
                        Devolução disponível apenas quando o caso está em revisão médica.
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-neutral-800">
                          O profissional RE receberá o caso de volta com o motivo informado e poderá editar e reenviar a avaliação.
                        </p>
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">
                            Motivo da devolução <span className="text-black">*</span>
                          </label>
                          <textarea
                            rows={4}
                            required
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            placeholder="Descreva o que deve ser revisado ou complementado na avaliação..."
                            className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black resize-none outline-none focus:ring-2 focus:ring-roxo/40"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            disabled={returning || !returnReason.trim()}
                            variant="warning" size="md"
                          >
                            <RotateCcw className="h-4 w-4" />
                            {returning ? "Devolvendo..." : "Devolver ao RE"}
                          </Button>
                        </div>
                      </>
                    )}
                  </form>
                )}

                {/* Close case form */}
                {view === "close" && (
                  <form onSubmit={handleCloseCase} className="space-y-4">
                    <h3 className="font-semibold text-black flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-black" />
                      Encerrar caso
                    </h3>
                    {activeCase.journeyState === "encerrado" ? (
                      <div className="flex items-center gap-2 rounded-xl border border-linha bg-fundo px-4 py-3 text-sm text-black">
                        <Lock className="h-4 w-4 shrink-0 text-neutral-800" />
                        Este caso já foi encerrado.
                      </div>
                    ) : activeCase.journeyState !== "retornado" ? (
                      <div className="flex items-start gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm text-black">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          Encerramento disponível apenas após todos os especialistas concluírem seus pareceres (estado: <strong>retornado</strong>).
                        </span>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">
                            Decisão de conduta
                          </label>
                          <div className="flex gap-2">
                            {(["encaminhamento", "acompanhamento", "alta", "abandono", "interrupcao_justificada"] as const).map((d) => (
                              <label
                                key={d}
                                className={`flex-1 flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition ${
                                  closeDecision === d
                                    ? "border-roxo bg-roxo-100 text-black"
                                    : "border-linha text-black hover:bg-fundo"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="decision"
                                  value={d}
                                  checked={closeDecision === d}
                                  onChange={() => setCloseDecision(d)}
                                  className="sr-only"
                                />
                                {CLOSE_LABELS[d]}
                              </label>
                            ))}
                          </div>
                          {closeDecision === "acompanhamento" && (
                            <label className="mt-3 block text-xs font-semibold text-black">
                              Periodicidade do acompanhamento (até a alta)
                              <select
                                value={followUp}
                                onChange={(e) => setFollowUp(e.target.value as "semestral" | "anual")}
                                className="mt-1 w-full rounded-xl border border-linha bg-white px-3 py-2 text-sm"
                              >
                                <option value="semestral">Semestral</option>
                                <option value="anual">Anual</option>
                              </select>
                            </label>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">
                            Justificativa clínica <span className="text-black">*</span>
                          </label>
                          <textarea
                            rows={4}
                            required
                            value={closeReason}
                            onChange={(e) => setCloseReason(e.target.value)}
                            placeholder="Descreva a conduta clínica adotada e a justificativa para o encerramento..."
                            className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black resize-none outline-none focus:ring-2 focus:ring-roxo/40"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            disabled={closing || !closeReason.trim()}
                            variant="primary" size="md"
                          >
                            {closing ? "Encerrando..." : "Encerrar caso"}
                          </Button>
                        </div>
                      </>
                    )}
                  </form>
                )}

                {/* Audit trail */}
                {view === "trail" && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-black flex items-center gap-2">
                      <Lock className="h-4 w-4 text-black" />
                      Trilha de auditoria
                    </h3>
                    {trailLoading ? (
                      <p className="text-sm text-neutral-800">Carregando trilha...</p>
                    ) : (
                      <AuditTrail events={events} />
                    )}
                  </div>
                )}

                {/* Default queue view */}
                {view === "queue" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-800">
                    <p className="text-sm">
                      Caso selecionado. Use as abas acima para revisar a avaliação, delegar,
                      consultar o consolidado ou encerrar o caso.
                    </p>
                  </div>
                )}
              </div>
            </div>
          }
        />
      </div>
    </div>
  </div>
)}
        </div>
      </div>
    </div>
  );
}

