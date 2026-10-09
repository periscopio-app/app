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
import { RoleBanner } from "@/components/ui/RoleBanner";
import { AuditTrail } from "@/components/ui/AuditTrail";
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
  { id: "fonoaudiologia", label: "Fonoaudiologia" },
  { id: "neuropsicologia", label: "Neuropsicologia" },
  { id: "psicologia", label: "Psicologia" },
  { id: "psicomotricidade", label: "Psicomotricidade" },
  { id: "servico_social", label: "Serviço Social" },
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
  const [view, setView] = useState<ActiveView>("queue");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // RE assessment view
  const [reAssessment, setReAssessment] = useState<ReAssessment | null>(null);
  const [reLoading, setReLoading] = useState(false);

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

  async function openCase(c: CaseItem) {
    setActiveCase(c);
    setView("queue");
    setActionMsg(null);
    setReAssessment(null);
    setSections([]);
    setEvents([]);
    setDelegations({});
    setCloseReason("");
    setReturnReason("");
  }

  async function loadReAssessment() {
    if (!activeCase) return;
    setView("re");
    setActionMsg(null);
    setReLoading(true);
    try {
      const data = await api.get<{ assessment: ReAssessment | null }>(
        `/api/cases/${activeCase.id}/re-assessment`
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
        reason: "Delegação médica após revisão da avaliação da RE",
        needsNeuropsych: needsNeuropsych === "" ? undefined : needsNeuropsych === "1",
      });
      const updated = cases.map((c) =>
        c.id === activeCase.id ? { ...c, journeyState: "delegado" as const } : c
      );
      setCases(updated);
      setActiveCase((prev) => (prev ? { ...prev, journeyState: "delegado" } : prev));
      setActionMsg(`Caso delegado com sucesso para ${delegationList.length} especialidade(s).`);
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
      {me && <RoleBanner me={me} />}

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: case queue */}
        <div className="rounded-2xl bg-white border border-linha p-4 shadow-suave">
          <h2 className="text-sm font-bold text-black mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-black" />
            Fila de casos ({cases.length})
          </h2>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {cases.length === 0 && (
              <p className="text-xs text-neutral-800 text-center py-6">
                Nenhum caso aguardando revisão médica.
              </p>
            )}
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => openCase(c)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                  activeCase?.id === c.id
                    ? "border-roxo bg-roxo-100"
                    : "border-linha hover:bg-fundo"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-black">{c.studentCode}</span>
                  <span
                    className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                      JOURNEY_COLORS[c.journeyState] ?? "bg-linha text-neutral-800"
                    }`}
                  >
                    {JOURNEY_LABELS[c.journeyState] ?? c.journeyState}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-800 mt-0.5">
                  {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: action panel */}
        <div className="lg:col-span-2">
          {!activeCase ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linha bg-white py-20 text-center">
              <ClipboardList className="h-10 w-10 text-neutral-800/40 mb-3" />
              <p className="text-sm font-semibold text-black">
                Selecione um caso para revisar
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-linha shadow-suave overflow-hidden">
              {/* Case header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-linha">
                <div>
                  <h2 className="text-base font-bold text-black">{activeCase.studentCode}</h2>
                  <span
                    className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                      JOURNEY_COLORS[activeCase.journeyState] ?? "bg-linha text-neutral-800"
                    }`}
                  >
                    {JOURNEY_LABELS[activeCase.journeyState] ?? activeCase.journeyState}
                  </span>
                </div>
                {/* Action tabs */}
                <nav className="flex flex-wrap gap-1">
                  {[
                    { id: "re" as ActiveView, label: "Avaliação RE", icon: FileSearch, action: loadReAssessment },
                    { id: "delegate" as ActiveView, label: "Delegar", icon: Users, action: () => { setView("delegate"); setActionMsg(null); } },
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
                      Avaliação da RE (FOGAP Demo)
                    </h3>
                    {reLoading ? (
                      <p className="text-sm text-neutral-800">Carregando avaliação...</p>
                    ) : !reAssessment ? (
                      <p className="text-sm text-neutral-800">
                        Nenhuma avaliação enviada para este caso ainda.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${
                              reAssessment.status === "enviado"
                                ? "bg-sucesso/10 text-black"
                                : reAssessment.status === "devolvido"
                                ? "bg-erro/10 text-black"
                                : "bg-ouro-100 text-black"
                            }`}
                          >
                            {reAssessment.status.toUpperCase()}
                          </span>
                          {reAssessment.submittedAt && (
                            <span className="text-xs text-neutral-800">
                              Enviado em{" "}
                              {new Date(reAssessment.submittedAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                        <div className="rounded-xl border border-linha divide-y divide-linha">
                          {Object.entries(reAssessment.payload as Record<string, string>)
                            .filter(([, v]) => Boolean(v))
                            .map(([key, value]) => (
                              <div key={key} className="px-4 py-2.5 grid grid-cols-2 gap-4">
                                <span className="text-xs font-semibold text-black">{key}</span>
                                <span className="text-xs text-neutral-800">{value}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Delegation form */}
                {view === "delegate" && (
                  <form onSubmit={handleDelegate} className="space-y-4">
                    <h3 className="font-semibold text-black flex items-center gap-2">
                      <Users className="h-4 w-4 text-black" />
                      Delegar especialistas
                    </h3>
                    {activeCase.journeyState !== "revisao_medica" && (
                      <div className="flex items-center gap-2 rounded-xl border border-ceu-300 bg-ceu-50 px-4 py-3 text-sm text-black">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Delegação disponível apenas quando o caso está em revisão médica.
                      </div>
                    )}
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
                      {SPECIALTIES.map((spec) => (
                        <div key={spec.id} className="grid grid-cols-5 items-center gap-3">
                          <span className="col-span-2 text-sm font-semibold text-black">
                            {spec.label}
                          </span>
                          <select
                            className="col-span-3 rounded-xl border border-linha px-3 py-2 text-sm text-black bg-white outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                            value={delegations[spec.id] ?? ""}
                            onChange={(e) =>
                              setDelegations((prev) => ({ ...prev, [spec.id]: e.target.value }))
                            }
                            disabled={activeCase.journeyState !== "revisao_medica"}
                          >
                            <option value="">Não delegar</option>
                            {professionals
                              .filter(
                                (p) =>
                                  p.role === "specialist" ||
                                  p.specialty === spec.id ||
                                  p.role === spec.id
                              )
                              .sort((a, b) => Number(b.specialty === spec.id) - Number(a.specialty === spec.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.specialty && p.specialty !== spec.id ? ` — ${p.specialty}` : ""}
                                  {p.classCode ? ` · ${p.classCode}` : ""}
                                </option>
                              ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={delegating || activeCase.journeyState !== "revisao_medica"}
                        className="flex items-center gap-2 rounded-xl bg-roxo-100 border border-roxo px-5 py-2 text-sm font-semibold text-black hover:bg-roxo-200 disabled:opacity-60 transition"
                      >
                        <ChevronRight className="h-4 w-4" />
                        {delegating ? "Delegando..." : "Confirmar delegação"}
                      </button>
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
                          <button
                            type="submit"
                            disabled={returning || !returnReason.trim()}
                            className="flex items-center gap-2 rounded-xl border border-ouro-400 bg-ouro-50 px-5 py-2 text-sm font-semibold text-black hover:bg-ouro-100 disabled:opacity-60 transition"
                          >
                            <RotateCcw className="h-4 w-4" />
                            {returning ? "Devolvendo..." : "Devolver ao RE"}
                          </button>
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
                          <button
                            type="submit"
                            disabled={closing || !closeReason.trim()}
                            className="rounded-xl bg-roxo-100 border border-roxo px-5 py-2 text-sm font-semibold text-black hover:bg-roxo-200 disabled:opacity-60 transition"
                          >
                            {closing ? "Encerrando..." : "Encerrar caso"}
                          </button>
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
          )}
        </div>
      </div>
    </div>
  );
}
