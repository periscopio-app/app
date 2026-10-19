"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type CaseItem,
  type Me,
  type Student,
} from "@/lib/api";

import { RoleBanner } from "@/components/ui/RoleBanner";
import { ProntuarioHeaderCard } from "@/components/dashboard/ProntuarioHeaderCard";
import { ConsentCard } from "@/components/dashboard/ConsentCard";
import { StudentIdentityVaultCard } from "@/components/dashboard/StudentIdentityVaultCard";
import { CaseAttachmentsCard } from "@/components/dashboard/CaseAttachmentsCard";
import { useCapabilities } from "@/lib/capabilities";
import { ReJourneyPanel } from "@/components/re/ReJourneyPanel";

import {
  FileText,
  Plus,
  ChevronRight,
  AlertCircle,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";

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

function calcularIdadePorNascimento(birthYear: number, birthMonth: number): { anos: number; meses: number } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1–12
  let anos = currentYear - birthYear;
  let meses = currentMonth - birthMonth;
  if (meses < 0) { anos -= 1; meses += 12; }
  return { anos: Math.max(0, anos), meses: Math.max(0, meses) };
}

/** Faixa do piloto: 6 anos completos até 9 anos e 11 meses. A API aplica a mesma regra. */
function foraDaFaixaDoPiloto(birthYear: number, birthMonth: number): boolean {
  const hoje = new Date();
  const meses = hoje.getFullYear() * 12 + (hoje.getMonth() + 1) - (birthYear * 12 + birthMonth);
  return !Number.isFinite(meses) || meses < 72 || meses > 119;
}
const MSG_FAIXA_PILOTO = "Fora da faixa do piloto: o cadastro aceita alunos de 6 anos a 9 anos e 11 meses.";

function idadeTexto(birthYear?: number | null, birthMonth?: number | null): string {
  if (!birthYear) return "—";
  const { anos, meses } = calcularIdadePorNascimento(birthYear, birthMonth ?? 1);
  return `${anos} anos${meses ? ` e ${meses}m` : ""}`;
}

const MESES_NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function REDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const caps = useCapabilities();

  const [me, setMe] = useState<Me | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Student registration
  const [birthYear, setBirthYear] = useState(new Date().getFullYear() - 7);
  const [birthMonth, setBirthMonth] = useState(1); // 1–12
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [studentMsg, setStudentMsg] = useState<string | null>(null);
  const [studentMsgOk, setStudentMsgOk] = useState(true);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Caso aberto
  const [activeCase, setActiveCase] = useState<CaseItem | null>(null);

  const [caseMsg, setCaseMsg] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");

  // ── Upload de arquivo (.csv, .xlsx, .txt) ──────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileName = file.name.toLowerCase();
      const parsedLines: string[] = [];

      if (fileName.endsWith(".xlsx")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        for (const row of rows) {
          if (!row || !Array.isArray(row)) continue;
          const nums = row
            .map((c) => Number(c))
            .filter((n) => !isNaN(n) && n > 0);
          const year = nums.find((n) => n >= 2000 && n <= 2026);
          const month = nums.find((n) => n >= 1 && n <= 12 && n !== year);
          if (year && month) {
            parsedLines.push(`${year};${month}`);
          }
        }
      } else {
        // .csv ou .txt
        const text = await file.text();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (/[a-zA-Z]/.test(line) && !line.includes(";")) continue;
          const parts = line.split(/[;,\t ]+/).map((p) => p.trim());
          const year = Number(parts[0]);
          const month = Number(parts[1]);
          if (!isNaN(year) && year >= 2000 && year <= 2026 && !isNaN(month) && month >= 1 && month <= 12) {
            parsedLines.push(`${year};${month}`);
          }
        }
      }

      if (parsedLines.length === 0) {
        setStudentMsgOk(false);
        setStudentMsg("Nenhum registro no formato ano;mês (ex: 2018;5) encontrado no arquivo.");
        return;
      }

      setBulkText(parsedLines.join("\n"));
      setStudentMsgOk(true);
      setStudentMsg(`Arquivo ${file.name} carregado: ${parsedLines.length} alunos identificados. Clique em "Importar lista" para confirmar.`);
    } catch {
      setStudentMsgOk(false);
      setStudentMsg("Erro ao processar arquivo. Verifique se é um arquivo .csv, .xlsx ou .txt válido.");
    } finally {
      e.target.value = "";
    }
  }

  // ── Boot ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      try {
        const [meData, schoolData] = await Promise.all([
          api.get<{ user: Me }>("/api/me"),
          api.get<{ school: { id: string; name?: string } }>(`/api/schools/by-slug/${encodeURIComponent(slug)}`),
        ]);
        setMe(meData.user);
        setSchoolId(schoolData.school.id);
        setSchoolName(schoolData.school.name ?? slug);


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
    if (foraDaFaixaDoPiloto(Number(birthYear), Number(birthMonth))) {
      setStudentMsgOk(false);
      setStudentMsg(MSG_FAIXA_PILOTO);
      return;
    }
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

  // Importação em lote: uma linha por aluno, "ano;mês" (ex.: 2018;5). Nenhum outro dado é aceito.
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
      setStudentMsg("Cole ao menos uma linha no formato ano;mês (ex.: 2018;5).");
      return;
    }
    const fora = rows.map((r, i) => ({ r, linha: i + 1 })).filter(({ r }) => foraDaFaixaDoPiloto(r.birthYear, r.birthMonth));
    if (fora.length > 0) {
      setStudentMsgOk(false);
      setStudentMsg(`${MSG_FAIXA_PILOTO} Nada foi importado. Linhas fora da faixa: ${fora.slice(0, 10).map((f) => f.linha).join(", ")}${fora.length > 10 ? "…" : ""}.`);
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
      // Se o aluno já tinha caso em andamento, a API devolve o mesmo caso: não duplica na lista.
      setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
      await selectCase(newCase);
    } catch (err: unknown) {
      setCaseMsg(err instanceof Error ? err.message : "Erro ao abrir caso.");
    }
  }

  async function selectCase(c: CaseItem) {
    setActiveCase(c);
    setCaseMsg(null);
  }

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
        <h1 className="text-2xl font-bold text-black">Avaliação do RE — formulários A a I</h1>
        <p className="text-sm text-neutral-800 mt-0.5">
          Preencha na ordem: A, B, C, D, E, F, G (opcional), H e I. Cada formulário concluído libera o próximo. Piloto: alunos de 6 anos a 9 anos e 11 meses.
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
            <form onSubmit={handleRegisterStudent} noValidate className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-black mb-1">Ano de nasc.</label>
                  <input
                    type="number"
                    min={new Date().getFullYear() - 10}
                    max={new Date().getFullYear() - 6}
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
            <details className="mt-3 rounded-xl border border-linha p-3 bg-white">
              <summary className="cursor-pointer text-xs font-semibold text-black">
                Importar vários alunos (Upload de arquivo ou colar lista)
              </summary>

              {/* Receptor de upload de arquivo .csv, .xlsx, .txt */}
              <div className="mt-2.5 p-3.5 border-2 border-dashed border-roxo/40 rounded-xl bg-roxo-50/60 hover:bg-roxo-50 transition text-center">
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload className="h-5 w-5 text-roxo" />
                    <span className="text-xs font-bold text-black">
                      Carregar arquivo (.csv, .xlsx ou .txt)
                    </span>
                    <span className="text-[11px] text-neutral-600">
                      Clique para selecionar ou arraste sua planilha de alunos
                    </span>
                  </div>
                </label>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-linha"></div>
                <span className="flex-shrink mx-2 text-[10px] text-neutral-500 uppercase font-bold tracking-wider">ou cole texto</span>
                <div className="flex-grow border-t border-linha"></div>
              </div>

              <p className="text-xs text-neutral-800">
                Uma linha por aluno: <strong>ano;mês</strong> (ex.: 2018;5). Só ano e mês de nascimento.
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={4}
                placeholder={"2018;5\n2019;11\n2020;2"}
                className="mt-2 w-full rounded-xl border border-linha px-3 py-2 text-sm text-black font-mono outline-none focus:ring-2 focus:ring-roxo/40 bg-white"
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
              {cases.map((c) => {
                const idadeCalculada = c.birthYear
                  ? calcularIdadePorNascimento(c.birthYear, c.birthMonth ?? 1)
                  : null;
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCase(c)}
                    className={`w-full text-left rounded-xl border p-3 transition space-y-1.5 ${
                      activeCase?.id === c.id
                        ? "border-roxo bg-roxo-50 ring-1 ring-roxo/40"
                        : "border-linha hover:bg-fundo"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-black">{c.studentCode ?? "—"}</span>
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${JOURNEY_COLORS[c.journeyState] ?? "bg-linha text-neutral-800"}`}>
                        {JOURNEY_LABELS[c.journeyState] ?? c.journeyState}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-700 flex flex-wrap gap-x-2">
                      <span><strong>Nome:</strong> Aluno ({(c.studentCode ?? "").slice(-4)})</span>
                      <span>•</span>
                      <span><strong>Idade:</strong> {idadeCalculada ? `${idadeCalculada.anos}a` : "—"}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate">
                      <strong>Escola:</strong> {c.schoolName || schoolName || slug} · <strong>Profissional:</strong> {c.assignedToName || me?.name || "RE"}
                    </div>
                  </button>
                );
              })}
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

              {/* Prontuário Oficial - 5 Colunas Padronizadas */}
              <div className="p-4 sm:p-5 border-b border-linha bg-slate-50/50 space-y-4">
                <ProntuarioHeaderCard
                  studentCode={activeCase.studentCode}
                  studentName={`Aluno (${(activeCase.studentCode ?? "").slice(-6)})`}
                  schoolName={activeCase.schoolName || schoolName || slug}
                  ageText={
                    idadeTexto(activeCase.birthYear, activeCase.birthMonth)
                  }
                  professionalName={me?.name || "Responsável Escolar"}
                  professionalRole={me?.role || "ppi"}
                  journeyState={activeCase.journeyState}
                />

                {/* Proteção de Dados, Consentimento e Anexos Clínicos (LGPD) */}
                <div className="grid grid-cols-1 gap-4 pt-1">
                  <ConsentCard caseId={activeCase.id} studentId={activeCase.studentId} studentCode={activeCase.studentCode} />
                  <StudentIdentityVaultCard studentId={activeCase.studentId} studentCode={activeCase.studentCode} />
                  {/* Documentos clínicos são do núcleo: não aparecem para o RE (a API também recusa). */}
                  {(caps.has("attachments.read") || caps.has("attachments.write")) && <CaseAttachmentsCard caseId={activeCase.id} />}
                </div>
              </div>

              {/* Jornada do RE: formulários A → I, um de cada vez, na ordem do capítulo do RE */}
              <div className="p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-neutral-800">
                    Aberto em {new Date(activeCase.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${JOURNEY_COLORS[activeCase.journeyState] ?? "bg-linha text-neutral-800"}`}>
                    {JOURNEY_LABELS[activeCase.journeyState] ?? activeCase.journeyState}
                  </span>
                </div>
                {caseMsg && (
                  <div role="alert" className="mb-3 rounded-xl bg-erro/10 px-4 py-3 text-sm text-black whitespace-pre-wrap">{caseMsg}</div>
                )}
                <ReJourneyPanel
                  key={activeCase.id}
                  caseId={activeCase.id}
                  studentCode={activeCase.studentCode ?? ""}
                  birthYear={activeCase.birthYear}
                  birthMonth={activeCase.birthMonth}
                  schoolName={activeCase.schoolName || schoolName || slug}
                  professionalName={me?.name}
                  onSent={() => {
                    setCases((prev) => prev.map((c) => (c.id === activeCase.id ? { ...c, journeyState: "revisao_medica" } : c)));
                    setActiveCase((prev) => (prev ? { ...prev, journeyState: "revisao_medica" } : prev));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

