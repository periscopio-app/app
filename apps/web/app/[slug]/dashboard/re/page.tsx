"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type CaseItem,
  type ReAssessment,
  type Me,
  type Student,
} from "@/lib/api";
import {
  type FogapPayload,
  type GrupoId,
  type OpcaoDesenvolvimento,
  type OpcaoComportamento,
  makeFogapPayloadVazio,
  rotearPorIdade,
  alternarResposta,
  prontoParaRevisao,
  G3_ITENS,
  FOGAP_COMPORTAMENTOS,
  DIFICULDADES_PERSISTENTES_OPCOES,
  GRUPOS_META,
  SNAP4_FORM_CODE,
  SNAP4_ITENS,
  SNAP4_OPCOES,
  SNAP4_RODAPE,
  makeSnap4PayloadVazio,
  calcularContagem,
  type Snap4Payload,
  type OpcaoSnap4,
} from "@periscopio/shared";
import { RoleBanner } from "@/components/ui/RoleBanner";
import {
  FileText,
  Plus,
  Lock,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Send,
  RotateCcw,
  Clock,
  BookOpen,
  Brain,
  ClipboardList,
  MapPin,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

const JOURNEY_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_re: "Enviado",
  revisao_medica: "Em revisão médica",
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

type FogapSection = "idade" | "desenvolvimento" | "comportamentos" | "sumario" | "encaminhamento" | "revisao";

function parseFogapPayload(raw: unknown): FogapPayload {
  if (raw && typeof raw === "object" && "fogap_state" in raw) {
    return raw as FogapPayload;
  }
  return makeFogapPayloadVazio();
}

function calcularIdadePorNascimento(birthYear: number, birthMonth: number): { anos: number; meses: number } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1–12
  let anos = currentYear - birthYear;
  let meses = currentMonth - birthMonth;
  if (meses < 0) { anos -= 1; meses += 12; }
  return { anos: Math.max(0, anos), meses: Math.max(0, meses) };
}

const MESES_NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ── SNAP-IV 4-option selector component ──────────────────────────────────

const SNAP4_OPTION_STYLES: Record<OpcaoSnap4, { selected: string; hover: string }> = {
  nem_um_pouco: { selected: "bg-tinta-200 text-tinta-800 border-tinta-300", hover: "hover:bg-tinta-100" },
  so_um_pouco: { selected: "bg-ouro text-black border-ouro", hover: "hover:bg-ouro/10" },
  bastante: { selected: "bg-ouro-700 text-black border-ouro-700", hover: "hover:bg-ouro-700/10" },
  demais: { selected: "bg-[#FDECEA] border border-erro text-black border-erro", hover: "hover:bg-erro/10" },
};

function SnapOpcoes({
  itemId,
  value,
  onChange,
  disabled,
}: {
  itemId: string;
  value: OpcaoSnap4 | null;
  onChange: (v: OpcaoSnap4 | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1 shrink-0 flex-wrap">
      {SNAP4_OPCOES.map(({ valor, rotulo }) => {
        const sel = value === valor;
        const styles = SNAP4_OPTION_STYLES[valor];
        return (
          <button
            key={`${itemId}-${valor}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(sel ? null : valor)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition disabled:opacity-50 ${
              sel
                ? styles.selected
                : `border-linha text-black ${styles.hover}`
            }`}
            aria-pressed={sel}
          >
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

// ── Exclusive checkbox component ──────────────────────────────────────────

function ExclusiveCheck<T extends string>({
  value,
  opcaoA,
  labelA,
  opcaoB,
  labelB,
  onChange,
  disabled,
  colorA = "sucesso",
  colorB = "erro",
}: {
  value: T | null;
  opcaoA: T;
  labelA: string;
  opcaoB: T;
  labelB: string;
  onChange: (v: T | null) => void;
  disabled?: boolean;
  colorA?: string;
  colorB?: string;
}) {
  const selA = value === opcaoA;
  const selB = value === opcaoB;
  return (
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(alternarResposta(value, opcaoA))}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
          selA
            ? `bg-sucesso text-black border-sucesso`
            : "border-linha text-black hover:bg-sucesso/10"
        }`}
        aria-pressed={selA}
      >
        {labelA}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(alternarResposta(value, opcaoB))}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
          selB
            ? `bg-[#FDECEA] border border-erro text-black border-erro`
            : "border-linha text-black hover:bg-erro/10"
        }`}
        aria-pressed={selB}
      >
        {labelB}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function REDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Student registration
  const [birthYear, setBirthYear] = useState(2016);
  const [birthMonth, setBirthMonth] = useState(1); // 1–12
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [studentMsg, setStudentMsg] = useState<string | null>(null);
  const [studentMsgOk, setStudentMsgOk] = useState(true);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Active case & assessment
  const [activeCase, setActiveCase] = useState<CaseItem | null>(null);
  const [reAssessment, setReAssessment] = useState<ReAssessment | null>(null);
  const [fogapPayload, setFogapPayload] = useState<FogapPayload>(makeFogapPayloadVazio());

  // SNAP-IV state
  const [snap4Assessment, setSnap4Assessment] = useState<ReAssessment | null>(null);
  const [snap4Payload, setSnap4Payload] = useState<Snap4Payload>(makeSnap4PayloadVazio());
  const [snap4Saving, setSnap4Saving] = useState(false);

  // Instrument selector
  const [activeInstrument, setActiveInstrument] = useState<"fogap" | "snap4">("fogap");

  // FOGAP form navigation
  const [activeSection, setActiveSection] = useState<FogapSection>("idade");

  // Age routing local state (synced to payload on confirm)
  const [idadeAnos, setIdadeAnos] = useState(7);
  const [idadeMeses, setIdadeMeses] = useState(0);

  // Actions
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [caseMsg, setCaseMsg] = useState<string | null>(null);

  // ── Boot ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      try {
        const [meData, schoolData] = await Promise.all([
          api.get<{ user: Me }>("/api/me"),
          api.get<{ school: { id: string } }>(`/api/schools/by-slug/${encodeURIComponent(slug)}`),
        ]);
        setMe(meData.user);
        setSchoolId(schoolData.school.id);

        const [casesData, studentsData] = await Promise.all([
          api.get<{ cases: CaseItem[] }>("/api/cases?states=rascunho,enviado_re,revisao_medica,delegado,retornado,encerrado"),
          api.get<{ students: Student[] }>(`/api/schools/${schoolData.school.id}/students`),
        ]);
        setCases(casesData.cases ?? []);
        setStudents(studentsData.students ?? []);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("Sessão")) {
          router.push(`/${slug}/login`);
        } else {
          setError("Erro ao carregar dados. Tente novamente.");
        }
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, [slug, router]);

  // ── Student + case handlers ──────────────────────────────────────────────

  async function handleRegisterStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setStudentMsg(null);
    try {
      const data = await api.post<{ student: Student }>("/api/students", {
        schoolId,
        birthYear: Number(birthYear),
        birthMonth: Number(birthMonth),
      });
      setStudents((prev) => [...prev, data.student]);
      setStudentMsgOk(true);
      setStudentMsg(`Aluno cadastrado. Código LGPD: ${data.student.studentCode}`);
    } catch (err: unknown) {
      setStudentMsgOk(false);
      setStudentMsg(err instanceof Error ? err.message : "Erro ao cadastrar aluno.");
    }
  }

  // Importação em lote: uma linha por aluno, "ano;mês" (ex.: 2016;5). Nenhum outro dado é aceito.
  async function handleBulkImport() {
    if (!schoolId) return;
    setStudentMsg(null);
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = lines.map((l) => {
      const [y, m] = l.split(/[;,\t ]+/);
      return { birthYear: Number(y), birthMonth: Number(m) };
    });
    if (rows.length === 0) {
      setStudentMsgOk(false);
      setStudentMsg("Cole ao menos uma linha no formato ano;mês (ex.: 2016;5).");
      return;
    }
    setBulkBusy(true);
    try {
      const data = await api.post<{ imported: number; students: Student[] }>(`/api/schools/${schoolId}/students/bulk`, { students: rows });
      setStudents((prev) => [...prev, ...data.students]);
      setBulkText("");
      setStudentMsgOk(true);
      setStudentMsg(`${data.imported} alunos importados com código pseudonimizado.`);
    } catch (err: unknown) {
      setStudentMsgOk(false);
      setStudentMsg(err instanceof Error ? err.message : "Erro ao importar alunos.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleOpenCase(studentId: string) {
    setCaseMsg(null);
    try {
      const { case: newCase } = await api.post<{ case: CaseItem }>("/api/cases", { studentId });
      setCases((prev) => [newCase, ...prev]);
      await selectCase(newCase);
    } catch (err: unknown) {
      setCaseMsg(err instanceof Error ? err.message : "Erro ao abrir caso.");
    }
  }

  async function selectCase(c: CaseItem) {
    setActiveCase(c);
    setCaseMsg(null);
    setActiveSection("idade");
    setActiveInstrument("fogap");
    try {
      const [fogapData, snap4Data] = await Promise.all([
        api.get<{ assessment: ReAssessment | null }>(
          `/api/cases/${c.id}/re-assessment`
        ),
        api.get<{ assessment: ReAssessment | null }>(
          `/api/cases/${c.id}/re-assessment?formCode=${SNAP4_FORM_CODE}`
        ),
      ]);

      if (fogapData.assessment) {
        setReAssessment(fogapData.assessment);
        const p = parseFogapPayload(fogapData.assessment.payload);
        setFogapPayload(p);
        if (p.fogap_state === "rascunho" || p.fogap_state === "em_revisao") {
          setActiveSection("desenvolvimento");
          if (p.idade_anos != null) setIdadeAnos(p.idade_anos);
          if (p.idade_meses != null) setIdadeMeses(p.idade_meses);
        }
      } else {
        setReAssessment(null);
        setFogapPayload(makeFogapPayloadVazio());
        // Auto-fill age from student's birth date if available
        if (c.birthYear && c.birthMonth) {
          const { anos, meses } = calcularIdadePorNascimento(c.birthYear, c.birthMonth);
          setIdadeAnos(anos);
          setIdadeMeses(meses);
        }
      }

      if (snap4Data.assessment) {
        setSnap4Assessment(snap4Data.assessment);
        const p = snap4Data.assessment.payload;
        if (p && typeof p === "object" && "respostas" in p) setSnap4Payload(p as unknown as Snap4Payload);
      } else {
        setSnap4Assessment(null);
        setSnap4Payload(makeSnap4PayloadVazio());
      }
    } catch {
      setReAssessment(null);
      setFogapPayload(makeFogapPayloadVazio());
      setSnap4Assessment(null);
      setSnap4Payload(makeSnap4PayloadVazio());
    }
  }

  // ── FOGAP age routing ────────────────────────────────────────────────────

  function handleConfirmarIdade() {
    const result = rotearPorIdade(idadeAnos, idadeMeses);
    const grupo =
      result.estado === "rascunho" || result.estado === "faixa_fora_do_piloto"
        ? result.grupo
        : null;
    const total = result.estado !== "aguardando_idade" ? result.total_meses : null;

    setFogapPayload((prev) => {
      const grupoChanged = grupo !== prev.grupo;
      return {
        ...prev,
        fogap_state: result.estado === "rascunho" ? "rascunho" : result.estado,
        grupo: grupo as GrupoId | null,
        idade_anos: idadeAnos,
        idade_meses: idadeMeses,
        total_meses: total,
        respostas_desenvolvimento: grupoChanged ? {} : prev.respostas_desenvolvimento,
      };
    });

    if (result.estado === "rascunho") setActiveSection("desenvolvimento");
  }

  // ── FOGAP field setters ──────────────────────────────────────────────────

  function setRespostaDesenvolvimento(id: string, opcao: OpcaoDesenvolvimento | null) {
    setFogapPayload((prev) => ({
      ...prev,
      respostas_desenvolvimento: { ...prev.respostas_desenvolvimento, [id]: opcao },
    }));
  }

  function setRespostaComportamento(id: string, opcao: OpcaoComportamento | null) {
    setFogapPayload((prev) => ({
      ...prev,
      respostas_comportamentos: { ...prev.respostas_comportamentos, [id]: opcao },
    }));
  }

  function setHistoricoInsuficiente(patch: Partial<FogapPayload["historico_insuficiente"]>) {
    setFogapPayload((prev) => ({
      ...prev,
      historico_insuficiente: { ...prev.historico_insuficiente, ...patch },
    }));
  }

  function setSumario(patch: Partial<FogapPayload["secao_sumario"]>) {
    setFogapPayload((prev) => ({
      ...prev,
      secao_sumario: { ...prev.secao_sumario, ...patch },
    }));
  }

  function setEncaminhamento(patch: Partial<FogapPayload["secao_encaminhamento"]>) {
    setFogapPayload((prev) => ({
      ...prev,
      secao_encaminhamento: { ...prev.secao_encaminhamento, ...patch },
    }));
  }

  function toggleDificuldade(opcao: string) {
    setFogapPayload((prev) => {
      const atual = prev.secao_sumario.dificuldades_persistentes;
      const next = atual.includes(opcao) ? atual.filter((d) => d !== opcao) : [...atual, opcao];
      return { ...prev, secao_sumario: { ...prev.secao_sumario, dificuldades_persistentes: next } };
    });
  }

  // ── Save / Submit ────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!activeCase) return;
    setSaving(true);
    setCaseMsg(null);
    try {
      if (!reAssessment) {
        const data = await api.post<{ assessment: ReAssessment }>(
          `/api/cases/${activeCase.id}/re-assessment`,
          { payload: fogapPayload }
        );
        setReAssessment(data.assessment);
      } else {
        const data = await api.put<{ assessment: ReAssessment }>(
          `/api/cases/${activeCase.id}/re-assessment`,
          { payload: fogapPayload }
        );
        setReAssessment(data.assessment);
      }
      setCaseMsg("Rascunho salvo.");
    } catch (err: unknown) {
      setCaseMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!activeCase) return;
    const { pronto, pendencias } = prontoParaRevisao(fogapPayload);
    if (!pronto) {
      setCaseMsg(`Formulário incompleto:\n• ${pendencias.join("\n• ")}`);
      setActiveSection("revisao");
      return;
    }
    const confirmed = window.confirm(
      "Ao enviar, a avaliação ficará bloqueada para edição e será encaminhada ao médico. Confirmar?"
    );
    if (!confirmed) return;
    setSubmitting(true);
    setCaseMsg(null);
    try {
      const payloadComEstado: FogapPayload = { ...fogapPayload, fogap_state: "em_revisao" };
      if (!reAssessment) {
        await api.post(`/api/cases/${activeCase.id}/re-assessment`, { payload: payloadComEstado });
      } else {
        await api.put(`/api/cases/${activeCase.id}/re-assessment`, { payload: payloadComEstado });
      }
      const data = await api.post<{ assessment: ReAssessment }>(
        `/api/cases/${activeCase.id}/re-assessment/submit`,
        {}
      );
      setReAssessment(data.assessment);
      setFogapPayload((prev) => ({ ...prev, fogap_state: "em_revisao" }));
      setCases((prev) =>
        prev.map((c) => (c.id === activeCase.id ? { ...c, journeyState: "revisao_medica" } : c))
      );
      setActiveCase((prev) => (prev ? { ...prev, journeyState: "revisao_medica" } : prev));
      setCaseMsg("Avaliação enviada com sucesso! Caso encaminhado para revisão médica.");
    } catch (err: unknown) {
      setCaseMsg(err instanceof Error ? err.message : "Erro ao enviar avaliação.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── SNAP-IV Save ─────────────────────────────────────────────────────────

  async function handleSnap4Save() {
    if (!activeCase) return;
    setSnap4Saving(true);
    try {
      if (!snap4Assessment) {
        const data = await api.post<{ assessment: ReAssessment }>(
          `/api/cases/${activeCase.id}/re-assessment?formCode=${SNAP4_FORM_CODE}`,
          { payload: snap4Payload }
        );
        setSnap4Assessment(data.assessment);
      } else {
        const data = await api.put<{ assessment: ReAssessment }>(
          `/api/cases/${activeCase.id}/re-assessment?formCode=${SNAP4_FORM_CODE}`,
          { payload: snap4Payload }
        );
        setSnap4Assessment(data.assessment);
      }
      setCaseMsg("Rascunho SNAP-IV salvo.");
    } catch (err: unknown) {
      setCaseMsg(err instanceof Error ? err.message : "Erro ao salvar SNAP-IV.");
    } finally {
      setSnap4Saving(false);
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const isReadOnly =
    reAssessment?.status === "enviado" ||
    (activeCase != null &&
      activeCase.journeyState !== "rascunho" &&
      activeCase.journeyState !== "enviado_re");

  const itensGrupo = fogapPayload.grupo === "G3" ? G3_ITENS : [];

  const devRespondidos = itensGrupo.filter(
    (i) => fogapPayload.respostas_desenvolvimento[i.id] != null
  ).length;

  const compRespondidos = FOGAP_COMPORTAMENTOS.filter(
    (c) => fogapPayload.respostas_comportamentos[c.id] != null
  ).length;

  // ── Section tabs config ───────────────────────────────────────────────────

  const SECTIONS: { id: FogapSection; label: string; icon: React.ElementType; disabled?: boolean }[] = [
    { id: "idade", label: "Identificação", icon: Clock },
    { id: "desenvolvimento", label: "Desenvolvimento", icon: Brain, disabled: fogapPayload.fogap_state === "aguardando_idade" || fogapPayload.fogap_state === "fora_da_faixa" },
    { id: "comportamentos", label: "Comportamentos", icon: BookOpen, disabled: fogapPayload.fogap_state === "aguardando_idade" || fogapPayload.fogap_state === "fora_da_faixa" },
    { id: "sumario", label: "Sumário", icon: ClipboardList, disabled: fogapPayload.fogap_state === "aguardando_idade" || fogapPayload.fogap_state === "fora_da_faixa" },
    { id: "encaminhamento", label: "Encaminhamento", icon: MapPin, disabled: fogapPayload.fogap_state === "aguardando_idade" || fogapPayload.fogap_state === "fora_da_faixa" },
    { id: "revisao", label: "Revisão", icon: Send, disabled: fogapPayload.fogap_state === "aguardando_idade" || fogapPayload.fogap_state === "fora_da_faixa" },
  ];

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-neutral-800 text-sm">
        Carregando painel da RE...
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        <h1 className="text-2xl font-bold text-black">Avaliação RE — FOGAP</h1>
        <p className="text-sm text-neutral-800 mt-0.5">
          Formulário de Observação Geral do Aluno pelo Professor · G3 ativo no piloto (6 a 9 anos e 11 meses).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Register student */}
          <div className="rounded-2xl bg-white border border-linha p-4 shadow-suave">
            <h2 className="text-sm font-bold text-black mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-black" />
              Cadastrar Aluno (LGPD)
            </h2>
            {studentMsg && (
              <p role="status" className={`text-xs rounded-lg px-3 py-2 mb-3 text-black border ${studentMsgOk ? "bg-[#EAF6F0] border-[#CFE8DB]" : "bg-[#FDECEA] border-erro"}`}>
                {studentMsg}
              </p>
            )}
            <form onSubmit={handleRegisterStudent} className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-black mb-1">Ano de nasc.</label>
                  <input
                    type="number"
                    min={2005}
                    max={2024}
                    value={birthYear}
                    onChange={(e) => setBirthYear(Number(e.target.value))}
                    className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40"
                    required
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-semibold text-black mb-1">Mês de nasc.</label>
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(Number(e.target.value))}
                    className="w-full rounded-xl border border-linha px-2 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 bg-white"
                  >
                    {MESES_NOMES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-roxo-100 border border-roxo px-4 py-2 text-sm font-semibold text-black hover:bg-roxo-200 transition"
              >
                Gerar código pseudonimizado
              </button>
            </form>
            <details className="mt-3 rounded-xl border border-linha p-3">
              <summary className="cursor-pointer text-xs font-semibold text-black">Importar vários alunos (colar lista)</summary>
              <p className="text-xs text-neutral-800 mt-2">Uma linha por aluno: <strong>ano;mês</strong> (ex.: 2016;5). Não cole nomes nem outros dados — só ano e mês de nascimento.</p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={5}
                placeholder={"2016;5\n2015;11\n2017;2"}
                className="mt-2 w-full rounded-xl border border-linha px-3 py-2 text-sm text-black font-mono outline-none focus:ring-2 focus:ring-roxo/40"
              />
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={bulkBusy}
                className="mt-2 w-full rounded-xl bg-roxo-100 border border-roxo px-4 py-2 text-sm font-semibold text-black hover:bg-roxo-200 disabled:opacity-60 transition"
              >
                {bulkBusy ? "Importando..." : "Importar lista"}
              </button>
            </details>
          </div>

          {/* Student list */}
          <div className="rounded-2xl bg-white border border-linha p-4 shadow-suave">
            <h2 className="text-sm font-bold text-black mb-3">
              Alunos cadastrados ({students.length})
            </h2>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {students.length === 0 && (
                <p className="text-xs text-neutral-800 text-center py-4">Nenhum aluno cadastrado.</p>
              )}
              {students.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between rounded-xl border border-linha px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-semibold text-black">{st.studentCode}</span>
                    <span className="ml-2 text-xs text-neutral-800">
                      nasc. {st.birthYear}{st.birthMonth ? `/${String(st.birthMonth).padStart(2,"0")}` : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenCase(st.id)}
                    className="flex items-center gap-1 rounded-lg bg-ceu-100 px-2 py-1 text-xs font-semibold text-black hover:bg-ceu-300 transition"
                  >
                    Abrir <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cases list */}
          <div className="rounded-2xl bg-white border border-linha p-4 shadow-suave">
            <h2 className="text-sm font-bold text-black mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-black" />
              Casos ({cases.length})
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {cases.length === 0 && (
                <p className="text-xs text-neutral-800 text-center py-4">Nenhum caso ativo.</p>
              )}
              {cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCase(c)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                    activeCase?.id === c.id
                      ? "border-roxo bg-roxo-100"
                      : "border-linha hover:bg-fundo"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-black">{c.studentCode}</span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${JOURNEY_COLORS[c.journeyState] ?? "bg-linha text-neutral-800"}`}>
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
        </div>

        {/* ── Right column: FOGAP form ─────────────────────────────────── */}
        <div className="lg:col-span-2">
          {!activeCase ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linha bg-white py-20 text-center">
              <FileText className="h-10 w-10 text-neutral-800/40 mb-3" />
              <p className="text-sm font-semibold text-black">
                Selecione ou abra um caso para iniciar a avaliação
              </p>
              <p className="text-xs text-neutral-800 mt-1">
                Escolha um aluno à esquerda e clique em &quot;Abrir&quot;
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-linha shadow-suave overflow-hidden">

              {/* Case header */}
              <div className="px-6 py-4 border-b border-linha flex items-start justify-between">
                <div>
                  {/* Instrument selector */}
                  <div className="flex gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => { setActiveInstrument("fogap"); setCaseMsg(null); }}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                        activeInstrument === "fogap"
                          ? "bg-roxo-100 border border-roxo text-black border-roxo"
                          : "bg-roxo-100 text-black border-roxo-200 hover:bg-roxo-200"
                      }`}
                    >
                      FOGAP
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveInstrument("snap4"); setCaseMsg(null); }}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
                        activeInstrument === "snap4"
                          ? "bg-roxo-100 border border-roxo text-black border-roxo"
                          : "bg-roxo-100 text-black border-roxo-200 hover:bg-roxo-200"
                      }`}
                    >
                      SNAP-IV
                    </button>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-black">
                    {activeCase.studentCode}
                  </h2>
                  <p className="text-xs text-neutral-800">
                    Aberto em {new Date(activeCase.createdAt).toLocaleDateString("pt-BR")}
                    {activeInstrument === "fogap" && fogapPayload.grupo && fogapPayload.idade_anos != null
                      ? ` · ${fogapPayload.idade_anos}a ${fogapPayload.idade_meses ?? 0}m · ${GRUPOS_META[fogapPayload.grupo].titulo}`
                      : ""}
                  </p>
                </div>
                <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${JOURNEY_COLORS[activeCase.journeyState] ?? "bg-linha text-neutral-800"}`}>
                  {JOURNEY_LABELS[activeCase.journeyState] ?? activeCase.journeyState}
                </span>
              </div>

              {/* Banners */}
              <div className="px-6 pt-4 space-y-2">
                {reAssessment?.status === "devolvido" && (
                  <div className="flex items-start gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm text-black">
                    <RotateCcw className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Avaliação devolvida pelo médico.</strong> Revise e reenvie o formulário para continuar o fluxo.
                    </span>
                  </div>
                )}
                {isReadOnly && reAssessment?.status === "enviado" && (
                  <div className="flex items-center gap-2 rounded-xl border border-ceu-300 bg-ceu-50 px-4 py-3 text-sm text-black">
                    <Lock className="h-4 w-4 shrink-0" />
                    Avaliação enviada — somente leitura.
                  </div>
                )}
                {caseMsg && (
                  <div className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    caseMsg.includes("sucesso") || caseMsg.includes("salvo")
                      ? "bg-sucesso/10 text-black"
                      : "bg-erro/10 text-black"
                  }`}>
                    {caseMsg}
                  </div>
                )}
              </div>

              {/* FOGAP: Section tabs */}
              {activeInstrument === "fogap" && (
                <div className="px-6 pt-4">
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {SECTIONS.map(({ id, label, icon: Icon, disabled }) => (
                      <button
                        key={id}
                        disabled={disabled}
                        onClick={() => { setActiveSection(id); setCaseMsg(null); }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition disabled:opacity-40 disabled:cursor-not-allowed ${
                          activeSection === id
                            ? "bg-roxo-100 border border-roxo text-black"
                            : "text-neutral-800 hover:bg-fundo hover:text-black"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                        {id === "desenvolvimento" && itensGrupo.length > 0 && (
                          <span className={`ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                            activeSection === id ? "bg-white/20 text-black" : "bg-fundo text-neutral-800"
                          }`}>
                            {devRespondidos}/{itensGrupo.length}
                          </span>
                        )}
                        {id === "comportamentos" && (
                          <span className={`ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                            activeSection === id ? "bg-white/20 text-black" : "bg-fundo text-neutral-800"
                          }`}>
                            {fogapPayload.historico_insuficiente.marcado ? "H.I." : `${compRespondidos}/15`}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* FOGAP: Section content */}
              {activeInstrument === "fogap" && (
              <div className="p-6 space-y-5">

                {/* ── Seção Identificação (Idade) ─────────────────────── */}
                {activeSection === "idade" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="font-semibold text-black">Identificação — Idade do Aluno</h3>
                      <p className="text-xs text-neutral-800 mt-0.5">
                        A idade determina o grupo do FOGAP (G1, G2 ou G3). Somente G3 está ativo no piloto.
                      </p>
                    </div>

                    <fieldset disabled={isReadOnly ?? false} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">Anos *</label>
                          <input
                            type="number" min={0} max={15} value={idadeAnos}
                            onChange={(e) => setIdadeAnos(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">Meses (0–11) *</label>
                          <input
                            type="number" min={0} max={11} value={idadeMeses}
                            onChange={(e) => setIdadeMeses(Math.min(11, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                          />
                        </div>
                      </div>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={handleConfirmarIdade}
                          className="flex items-center gap-2 rounded-xl bg-roxo-100 border border-roxo px-5 py-2 text-sm font-semibold text-black hover:bg-roxo-200 transition"
                        >
                          <ChevronRight className="h-4 w-4" />
                          Confirmar idade e carregar formulário
                        </button>
                      )}
                    </fieldset>

                    {fogapPayload.fogap_state === "fora_da_faixa" && (
                      <div className="flex items-start gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm text-black">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>O FOGAP cobre de 3 meses a 9 anos e 11 meses. Esta faixa etária está fora do instrumento.</span>
                      </div>
                    )}
                    {fogapPayload.fogap_state === "faixa_fora_do_piloto" && fogapPayload.grupo && (
                      <div className="flex items-start gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm text-black">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          Grupo <strong>{fogapPayload.grupo}</strong> ({GRUPOS_META[fogapPayload.grupo].titulo}) existe no catálogo, mas não está ativo neste piloto. Apenas G3 está disponível.
                        </span>
                      </div>
                    )}
                    {fogapPayload.fogap_state === "rascunho" && fogapPayload.grupo && (
                      <div className="flex items-center gap-2 rounded-xl border border-sucesso/20 bg-sucesso/5 px-4 py-3 text-sm text-black">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        Grupo <strong>{fogapPayload.grupo}</strong> carregado — {fogapPayload.idade_anos}a {fogapPayload.idade_meses ?? 0}m · {itensGrupo.length} itens de desenvolvimento.
                      </div>
                    )}
                  </div>
                )}

                {/* ── Seção Desenvolvimento (G3, 15 itens) ───────────── */}
                {activeSection === "desenvolvimento" && (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-black">
                          Seção 1–3 — Desenvolvimento
                        </h3>
                        <p className="text-xs text-neutral-800 mt-0.5">
                          {fogapPayload.grupo ? GRUPOS_META[fogapPayload.grupo].titulo : "Grupo não definido"} · 2ª Infância · Fase: Operacional-concreto Corpo representado
                        </p>
                      </div>
                      <span className="text-xs font-bold text-neutral-800 bg-fundo rounded-full px-2.5 py-1">
                        {devRespondidos}/{itensGrupo.length}
                      </span>
                    </div>

                    {itensGrupo.length === 0 ? (
                      <div className="flex items-start gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm text-black">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        {fogapPayload.fogap_state === "faixa_fora_do_piloto" && fogapPayload.grupo
                          ? `Grupo ${fogapPayload.grupo} (${GRUPOS_META[fogapPayload.grupo].titulo}) não está ativo neste piloto — itens não disponíveis.`
                          : `Confirme a idade na aba "Identificação" para carregar os itens.`}
                      </div>
                    ) : (
                      <div className="divide-y divide-linha">
                        {itensGrupo.map((item) => {
                          const val = fogapPayload.respostas_desenvolvimento[item.id] ?? null;
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-bold text-neutral-800 mr-2">{item.n}</span>
                                <span className="text-sm text-black">{item.texto}</span>
                              </div>
                              <ExclusiveCheck<OpcaoDesenvolvimento>
                                value={val}
                                opcaoA="adequada"
                                labelA="Adequada"
                                opcaoB="inadequada"
                                labelB="Inadequada"
                                onChange={(v) => setRespostaDesenvolvimento(item.id, v)}
                                disabled={isReadOnly ?? false}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Seção Comportamentos (Seção 4) ─────────────────── */}
                {activeSection === "comportamentos" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-black">
                        Seção 4 — Comportamentos Disfuncionais por 6 Meses
                      </h3>
                      <p className="text-xs text-neutral-800 mt-0.5">
                        Informe a fonte e o período observado antes de responder. Se não houver histórico suficiente, marque a opção abaixo.
                      </p>
                    </div>

                    {/* Historico insuficiente */}
                    <fieldset disabled={isReadOnly ?? false} className="rounded-xl border border-linha p-4 space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fogapPayload.historico_insuficiente.marcado}
                          onChange={(e) => setHistoricoInsuficiente({ marcado: e.target.checked })}
                          disabled={isReadOnly ?? false}
                          className="w-4 h-4 rounded accent-roxo"
                        />
                        <span className="text-sm font-semibold text-black">
                          Histórico insuficiente / pendente de informação
                        </span>
                      </label>
                      {fogapPayload.historico_insuficiente.marcado && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-xs font-semibold text-black mb-1">Fonte *</label>
                            <input
                              type="text"
                              value={fogapPayload.historico_insuficiente.fonte ?? ""}
                              onChange={(e) => setHistoricoInsuficiente({ fonte: e.target.value })}
                              disabled={isReadOnly ?? false}
                              placeholder="Ex: professora atual"
                              className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-black mb-1">Período observado *</label>
                            <input
                              type="text"
                              value={fogapPayload.historico_insuficiente.periodo_observado ?? ""}
                              onChange={(e) => setHistoricoInsuficiente({ periodo_observado: e.target.value })}
                              disabled={isReadOnly ?? false}
                              placeholder="Ex: 15 dias letivos"
                              className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                            />
                          </div>
                        </div>
                      )}
                    </fieldset>

                    {/* Behavior items */}
                    {!fogapPayload.historico_insuficiente.marcado && (
                      <div className="divide-y divide-linha">
                        {FOGAP_COMPORTAMENTOS.map((comp) => {
                          const val = fogapPayload.respostas_comportamentos[comp.id] ?? null;
                          return (
                            <div key={comp.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-bold text-neutral-800 mr-2">{comp.n}</span>
                                <span className="text-sm text-black">{comp.texto}</span>
                              </div>
                              <ExclusiveCheck<OpcaoComportamento>
                                value={val}
                                opcaoA="sim"
                                labelA="Sim"
                                opcaoB="nao"
                                labelB="Não"
                                onChange={(v) => setRespostaComportamento(comp.id, v)}
                                disabled={isReadOnly ?? false}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Seção Sumário (Seção 5) ─────────────────────────── */}
                {activeSection === "sumario" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="font-semibold text-black">Seção 5 — Sumário do FOGAP</h3>
                      <p className="text-xs text-neutral-800 mt-0.5">
                        Registros da observação do professor. Não configuram diagnóstico.
                      </p>
                    </div>

                    <fieldset disabled={isReadOnly ?? false} className="space-y-5">
                      {/* Dificuldades persistentes */}
                      <div>
                        <label className="block text-xs font-semibold text-black mb-2">
                          Dificuldades persistentes (múltipla escolha)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {DIFICULDADES_PERSISTENTES_OPCOES.map((opt) => {
                            const sel = fogapPayload.secao_sumario.dificuldades_persistentes.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                disabled={isReadOnly ?? false}
                                onClick={() => toggleDificuldade(opt)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
                                  sel
                                    ? "bg-roxo-100 border border-roxo text-black border-roxo"
                                    : "border-linha text-black hover:bg-roxo/10"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Intervenção do professor */}
                      <div className="rounded-xl border border-linha p-4 space-y-3">
                        <p className="text-xs font-bold text-black">Intervenção do Professor</p>
                        <div className="flex gap-3 items-center">
                          <span className="text-sm text-black">Houve conduta?</span>
                          <ExclusiveCheck<"sim" | "nao">
                            value={fogapPayload.secao_sumario.conduta}
                            opcaoA="sim" labelA="Sim"
                            opcaoB="nao" labelB="Não"
                            onChange={(v) => setSumario({ conduta: v })}
                            disabled={isReadOnly ?? false}
                          />
                        </div>
                        {fogapPayload.secao_sumario.conduta === "sim" && (
                          <div className="space-y-3 pt-1">
                            {(
                              [
                                { key: "qual" as const, label: "Qual?" },
                                { key: "tempo" as const, label: "Por quanto tempo?" },
                                { key: "resultado" as const, label: "Resultado" },
                              ] as const
                            ).map(({ key, label }) => (
                              <div key={key}>
                                <label className="block text-xs font-semibold text-black mb-1">{label}</label>
                                <input
                                  type="text"
                                  value={fogapPayload.secao_sumario[key]}
                                  onChange={(e) => setSumario({ [key]: e.target.value })}
                                  disabled={isReadOnly ?? false}
                                  className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </fieldset>
                  </div>
                )}

                {/* ── Seção Encaminhamento (Seção 6) ─────────────────── */}
                {activeSection === "encaminhamento" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="font-semibold text-black">Seção 6 — Encaminhamento para a RE</h3>
                    </div>
                    <fieldset disabled={isReadOnly ?? false} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-black mb-1">Observações</label>
                        <textarea
                          rows={5}
                          value={fogapPayload.secao_encaminhamento.observacoes}
                          onChange={(e) => setEncaminhamento({ observacoes: e.target.value })}
                          disabled={isReadOnly ?? false}
                          placeholder="Observações gerais para o profissional responsável na escola..."
                          className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black resize-y outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo disabled:text-neutral-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">Data do encaminhamento</label>
                          <input
                            type="date"
                            value={fogapPayload.secao_encaminhamento.data ?? ""}
                            onChange={(e) => setEncaminhamento({ data: e.target.value || null })}
                            disabled={isReadOnly ?? false}
                            className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-black mb-1">Profissional</label>
                          <input
                            type="text"
                            value={me?.name ?? ""}
                            disabled
                            className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-neutral-800 bg-fundo"
                          />
                        </div>
                      </div>
                    </fieldset>
                  </div>
                )}

                {/* ── Seção Revisão e Envio ───────────────────────────── */}
                {activeSection === "revisao" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-black">Revisão e Envio</h3>
                      <p className="text-xs text-neutral-800 mt-0.5">
                        Confira o preenchimento antes de enviar ao médico.
                      </p>
                    </div>

                    {(() => {
                      const { pronto, pendencias, avisos } = prontoParaRevisao(fogapPayload);
                      return (
                        <div className={`rounded-xl border px-4 py-3 text-sm ${
                          pronto ? "border-sucesso/20 bg-sucesso/5 text-black" : "border-ouro-300 bg-ouro-50 text-black"
                        }`}>
                          {pronto ? (
                            <div>
                              <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 shrink-0" />
                              {avisos.length === 0 ? "Formulário completo. Pronto para envio ao médico." : "Pode ser enviado ao médico. Itens em branco serão enviados como estão:"}
                              </div>
                              {avisos.length > 0 && (
                                <ul className="mt-1.5 list-disc list-inside text-xs space-y-0.5 pl-1">
                                  {avisos.map((a) => <li key={a}>{a}</li>)}
                                </ul>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 font-semibold">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                Pendências antes de enviar:
                              </div>
                              <ul className="list-disc list-inside text-xs space-y-0.5 pl-1">
                                {pendencias.map((p) => <li key={p}>{p}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Summary cards */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl border border-linha p-3">
                        <p className="font-bold text-black mb-1">Desenvolvimento</p>
                        <p className="text-neutral-800">{devRespondidos}/{itensGrupo.length} respondidos</p>
                      </div>
                      <div className="rounded-xl border border-linha p-3">
                        <p className="font-bold text-black mb-1">Comportamentos</p>
                        <p className="text-neutral-800">
                          {fogapPayload.historico_insuficiente.marcado
                            ? "Histórico insuficiente"
                            : `${compRespondidos}/15 respondidos`}
                        </p>
                      </div>
                      <div className="rounded-xl border border-linha p-3">
                        <p className="font-bold text-black mb-1">Dificuldades</p>
                        <p className="text-neutral-800">
                          {fogapPayload.secao_sumario.dificuldades_persistentes.length > 0
                            ? fogapPayload.secao_sumario.dificuldades_persistentes.join(", ")
                            : "Nenhuma marcada"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-linha p-3">
                        <p className="font-bold text-black mb-1">Encaminhamento</p>
                        <p className="text-neutral-800">
                          {fogapPayload.secao_encaminhamento.data
                            ? `Data: ${new Date(fogapPayload.secao_encaminhamento.data).toLocaleDateString("pt-BR")}`
                            : "Data não informada"}
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-800 border-t border-linha pt-3">
                      🔒 O FOGAP é um instrumento de observação. Não configura diagnóstico clínico.
                      Após o envio, somente o médico pode reabrir a avaliação por devolução formal.
                    </p>
                  </div>
                )}

                {/* ── Save / Submit buttons ──────────────────────────── */}
                {!isReadOnly && (
                  <div className="flex items-center justify-between border-t border-linha pt-4">
                    <button
                      type="button"
                      disabled={saving || submitting}
                      onClick={handleSaveDraft}
                      className="rounded-xl border border-linha px-4 py-2 text-sm font-semibold text-black hover:bg-fundo transition disabled:opacity-60"
                    >
                      {saving ? "Salvando..." : "Salvar rascunho"}
                    </button>
                    <button
                      type="button"
                      disabled={saving || submitting || fogapPayload.fogap_state === "aguardando_idade" || fogapPayload.fogap_state === "fora_da_faixa"}
                      onClick={handleSubmit}
                      className="flex items-center gap-2 rounded-xl bg-roxo-100 border border-roxo px-5 py-2 text-sm font-semibold text-black hover:bg-roxo-200 disabled:opacity-60 transition"
                    >
                      <Send className="h-4 w-4" />
                      {submitting ? "Enviando..." : "Enviar ao médico"}
                    </button>
                  </div>
                )}
              </div>
              )}

              {/* ── SNAP-IV panel ────────────────────────────────────── */}
              {activeInstrument === "snap4" && (
                <div className="p-6 space-y-6">

                  {/* Header */}
                  <div>
                    <h3 className="font-semibold text-black">SNAP-IV — Escala Snap de Avaliação</h3>
                    <p className="text-xs text-neutral-800 mt-0.5">
                      Fontes: ANEXOS cap MD 2109.pdf · Cap RE ESCOLAR Plataforma 1809.pdf · Versão 0.1.0-rascunho (aprovação clínica pendente)
                    </p>
                  </div>

                  {/* Warning banner: itens 12–18 ausentes */}
                  <div className="flex items-start gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm text-black">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Instrumento incompleto (11 de 18 itens).</strong> Itens 12–18 ausentes na fonte — aguardando validação clínica.
                    </span>
                  </div>

                  {/* Bloco 1: Itens 1–9 */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-black">Itens 1 a 9</h4>
                    <div className="divide-y divide-linha">
                      {SNAP4_ITENS.filter((i) => i.bloco === "itens_1_a_9").map((item) => {
                        const val = (snap4Payload.respostas[item.id] as OpcaoSnap4 | undefined) ?? null;
                        return (
                          <div key={item.id} className="flex items-start gap-4 py-3 first:pt-0">
                            <div className="flex-1 min-w-0 pt-0.5">
                              <span className="text-[10px] font-bold text-neutral-800 mr-1.5">{item.n}.</span>
                              <span className="text-sm text-black">{item.texto}</span>
                            </div>
                            <SnapOpcoes
                              itemId={item.id}
                              value={val}
                              onChange={(v) =>
                                setSnap4Payload((prev) => ({
                                  ...prev,
                                  respostas: { ...prev.respostas, [item.id]: v },
                                }))
                              }
                              disabled={isReadOnly ?? false}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Contagem bloco 1 */}
                    {(() => {
                      const { c1 } = calcularContagem(snap4Payload);
                      return (
                        <div className="flex items-center gap-2 rounded-xl border border-linha bg-fundo px-4 py-2 text-xs text-black">
                          <span className="font-bold">{c1.contagem} de {c1.total}</span>
                          <span className="text-neutral-800">marcados Bastante ou Demais · referência da fonte: {c1.limiar}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Bloco 2: Itens 10–11 (bloco 10–18, incompleto) */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-black">Itens 10 e 11</h4>
                    <div className="divide-y divide-linha">
                      {SNAP4_ITENS.filter((i) => i.bloco === "itens_10_a_18").map((item) => {
                        const val = (snap4Payload.respostas[item.id] as OpcaoSnap4 | undefined) ?? null;
                        return (
                          <div key={item.id} className="flex items-start gap-4 py-3 first:pt-0">
                            <div className="flex-1 min-w-0 pt-0.5">
                              <span className="text-[10px] font-bold text-neutral-800 mr-1.5">{item.n}.</span>
                              <span className="text-sm text-black">{item.texto}</span>
                            </div>
                            <SnapOpcoes
                              itemId={item.id}
                              value={val}
                              onChange={(v) =>
                                setSnap4Payload((prev) => ({
                                  ...prev,
                                  respostas: { ...prev.respostas, [item.id]: v },
                                }))
                              }
                              disabled={isReadOnly ?? false}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-2 text-xs text-black">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Bloco incompleto — itens 12 a 18 aguardando validação.
                    </div>
                  </div>

                  {/* Rodapé */}
                  <fieldset disabled={isReadOnly ?? false} className="space-y-4">
                    <h4 className="text-sm font-bold text-black">Rodapé</h4>

                    {/* distribuido: Sim / Não */}
                    {(() => {
                      const rodapeItem = SNAP4_RODAPE.find((r) => r.id === "distribuido");
                      const val = snap4Payload.rodape["distribuido"] ?? null;
                      return (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-black">
                            {rodapeItem?.rotulo}
                          </label>
                          <div className="flex gap-2">
                            {(["nao", "sim"] as const).map((opcao) => (
                              <button
                                key={opcao}
                                type="button"
                                disabled={isReadOnly ?? false}
                                onClick={() =>
                                  setSnap4Payload((prev) => ({
                                    ...prev,
                                    rodape: {
                                      ...prev.rodape,
                                      distribuido: val === opcao ? null : opcao,
                                      // reset quem_respondeu when unsetting sim
                                      ...(val === "sim" && opcao === "sim" ? { quem_respondeu: null } : {}),
                                    },
                                  }))
                                }
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
                                  val === opcao
                                    ? "bg-roxo-100 border border-roxo text-black border-roxo"
                                    : "border-linha text-black hover:bg-fundo"
                                }`}
                                aria-pressed={val === opcao}
                              >
                                {opcao === "sim" ? "Sim" : "Não"}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* quem_respondeu: visible when distribuido === "sim" */}
                    {snap4Payload.rodape["distribuido"] === "sim" && (
                      <div>
                        <label className="block text-xs font-semibold text-black mb-1">
                          {SNAP4_RODAPE.find((r) => r.id === "quem_respondeu")?.rotulo}
                        </label>
                        <input
                          type="text"
                          value={snap4Payload.rodape["quem_respondeu"] ?? ""}
                          onChange={(e) =>
                            setSnap4Payload((prev) => ({
                              ...prev,
                              rodape: { ...prev.rodape, quem_respondeu: e.target.value || null },
                            }))
                          }
                          disabled={isReadOnly ?? false}
                          placeholder="Ex: mãe, avó..."
                          className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo"
                        />
                      </div>
                    )}

                    {/* obs */}
                    <div>
                      <label className="block text-xs font-semibold text-black mb-1">
                        {SNAP4_RODAPE.find((r) => r.id === "obs")?.rotulo}
                      </label>
                      <textarea
                        rows={3}
                        value={snap4Payload.rodape["obs"] ?? ""}
                        onChange={(e) =>
                          setSnap4Payload((prev) => ({
                            ...prev,
                            rodape: { ...prev.rodape, obs: e.target.value || null },
                          }))
                        }
                        disabled={isReadOnly ?? false}
                        placeholder="Observações..."
                        className="w-full rounded-xl border border-linha px-3 py-2 text-sm text-black resize-y outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo disabled:text-neutral-800"
                      />
                    </div>
                  </fieldset>

                  {/* SNAP-IV Save button */}
                  {!isReadOnly && (
                    <div className="border-t border-linha pt-4">
                      <button
                        type="button"
                        disabled={snap4Saving}
                        onClick={handleSnap4Save}
                        className="rounded-xl border border-linha px-4 py-2 text-sm font-semibold text-black hover:bg-fundo transition disabled:opacity-60"
                      >
                        {snap4Saving ? "Salvando..." : "Salvar rascunho SNAP-IV"}
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
