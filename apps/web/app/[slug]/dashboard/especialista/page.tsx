"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, type CaseSection, type Me } from "@/lib/api";
import { ProfileHero } from "@/components/ui/ProfileHero";
import { ProntuarioHeaderCard } from "@/components/dashboard/ProntuarioHeaderCard";
import { ProntuarioHorizontalTabs } from "@/components/dashboard/ProntuarioHorizontalTabs";
import { Stethoscope, AlertCircle, Lock, CheckCircle, FileText, ChevronDown } from "lucide-react";
import { TeaScreeningPanel } from "@/components/dashboard/TeaScreeningPanel";
import { useNomeDoAluno } from "@/lib/nome-aluno";
import { EspecialidadeFormsPanel } from "@/components/especialista/EspecialidadeFormsPanel";
import { Button } from "@/components/ui";

const SPECIALTY_NAMES: Record<string, string> = {
  servico_social: "Assistente Social (AS)",
  as: "Assistente Social (AS)",
  neuropsicologia: "Neuropsicólogo(a)",
  neuropsicologo: "Neuropsicólogo(a)",
  psicomotricidade: "Psicomotricista",
  psicomotricista: "Psicomotricista",
  psicoterapia: "Psicoterapeuta / Psicólogo(a)",
  psicologia: "Psicoterapeuta / Psicólogo(a)",
  fonoaudiologia: "Fonoaudiólogo(a)",
  fonoaudiologa: "Fonoaudiólogo(a)",
  psicopedagogia: "Psicopedagogo(a) Clínico(a)",
  psicopedagogo_clinico: "Psicopedagogo(a) Clínico(a)",
};


interface AssignedSection extends CaseSection {
  caseId: string;
  studentCode: string;
  birthYear: number | null;
}

interface CaseContext {
  sumarioExecutivoMedico: {
    status: "concluido" | "pendente";
    registro: string | null;
    completedAt: string | null;
    campos: { id: string; rotulo: string; tipo: "texto" | "lista" | "data"; valor: string | null; itens?: string[] }[];
  };
}

function dataPuraPtBr(valor: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
}

function CaseContextPanel({ ctx, isReadOnly }: { ctx: CaseContext; isReadOnly: boolean }) {
  const s = ctx.sumarioExecutivoMedico;
  return (
    <details open={!isReadOnly} className="group min-w-0 overflow-hidden rounded-xl border border-linha bg-fundo p-4 text-sm text-black">
      <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-center justify-between gap-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roxo/50">
        <span className="flex min-h-[44px] items-center">Sumário executivo do médico</span>
        <span className="flex min-h-[44px] items-center gap-2">
          <span className="rounded-full border border-linha bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800">Somente leitura</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-700 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      {s.status === "concluido" ? (
        <dl className="mt-3 min-w-0 space-y-3">
          {s.campos.map((campo) => (
            <div key={campo.id} className="min-w-0">
              <dt className="break-words font-bold [overflow-wrap:anywhere]">{campo.rotulo}</dt>
              <dd className="mt-1 min-w-0 break-words [overflow-wrap:anywhere]">
                {campo.tipo === "lista" ? (
                  campo.itens?.length ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {campo.itens.map((item, index) => <li key={`${campo.id}:${index}`} className="break-words [overflow-wrap:anywhere]">{item}</li>)}
                    </ul>
                  ) : <span className="italic text-neutral-700">Nenhuma opção marcada</span>
                ) : campo.valor?.trim() ? (
                  <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {campo.tipo === "data" ? dataPuraPtBr(campo.valor) : campo.valor}
                  </span>
                ) : <span className="italic text-neutral-700">Não preenchido</span>}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p role="status" className="mt-3 rounded-lg border border-linha bg-white px-3 py-2 text-sm text-neutral-800">
          O médico ainda não concluiu o sumário executivo deste caso. Você já pode salvar rascunho do seu parecer.
        </p>
      )}
      <p className="mt-3 break-words text-neutral-800 [overflow-wrap:anywhere]">
        Você vê apenas este sumário e a sua própria seção. O FOGAP, as seções dos colegas e a decisão final ficam com o médico.
      </p>
    </details>
  );
}

export default function EspecialistaDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [sections, setSections] = useState<AssignedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<AssignedSection | null>(null);
  const nomeAluno = useNomeDoAluno(activeSection?.caseId);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CaseContext | null>(null);

  const activeCaseId = activeSection?.caseId;
  useEffect(() => {
    setCtx(null);
    if (!activeCaseId) return;
    api
      .get<CaseContext>(`/api/cases/${activeCaseId}/specialist-view`)
      .then(setCtx)
      .catch(() => setCtx(null));
  }, [activeCaseId]);

  useEffect(() => {
    async function boot() {
      try {
        const meData = await api.get<{ user: Me }>("/api/me");
        setMe(meData.user);

        const data = await api.get<{ assignedSections: AssignedSection[] }>(
          "/api/cases/my-delegated-sections"
        );
        const secs = data.assignedSections ?? [];
        setSections(secs);
        if (secs.length > 0) selectSection(secs[0]);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("Sessão")) {
          router.push(`/${slug}/login`);
        } else {
          setError("Erro ao carregar seções. Verifique sua sessão e tente novamente.");
        }
      } finally {
        setLoading(false);
      }
    }
    boot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function selectSection(sec: AssignedSection) {
    setActiveSection(sec);
    setNotes(
      typeof sec.summary === "object" && sec.summary !== null
        ? String((sec.summary as Record<string, unknown>).clinicalNotes ?? sec.notes ?? "")
        : sec.notes ?? ""
    );
    setSaveMsg(null);
  }

  async function handleSave(markAsCompleted: boolean) {
    if (!activeSection) return;
    if (activeSection.status === "concluido") return;

    if (markAsCompleted && notes.trim().length < 100) {
      setSaveMsg("O parecer precisa ter pelo menos 100 caracteres para ser concluído.");
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    try {
      await api.patch(`/api/cases/sections/${activeSection.id}`, {
        notes,
        summary: {
          clinicalNotes: notes,
          specialty: activeSection.specialty,
          savedAt: new Date().toISOString(),
        },
        markAsCompleted,
      });
      const updatedStatus = markAsCompleted ? "concluido" : "em_andamento";
      setSections((prev) =>
        prev.map((s) => (s.id === activeSection.id ? { ...s, status: updatedStatus } : s))
      );
      setActiveSection((prev) => (prev ? { ...prev, status: updatedStatus } : prev));
      setSaveMsg(
        markAsCompleted
          ? "Parecer concluído e registrado no prontuário."
          : "Rascunho salvo."
      );
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const isReadOnly = activeSection?.status === "concluido";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-neutral-800 text-sm">
        Carregando seções delegadas...
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
        <h1 className="text-2xl font-bold text-black">Portal do Especialista</h1>
        <p className="text-sm text-neutral-800 mt-0.5">
          Você tem acesso apenas às seções delegadas à sua especialidade.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linha bg-white py-20 text-center">
          <Stethoscope className="h-10 w-10 text-neutral-800/40 mb-3" />
          <p className="text-sm font-semibold text-black">
            Nenhuma seção delegada no momento
          </p>
          <p className="text-xs text-neutral-800 mt-1">
            O médico responsável pelo caso irá delegar seções para sua especialidade.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Section list */}
          <div className="rounded-2xl bg-white border border-linha p-4 shadow-suave">
            <h2 className="text-sm font-bold text-black mb-3 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-black" />
              Seções atribuídas ({sections.length})
            </h2>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => selectSection(sec)}
                  className={`min-h-[44px] w-full text-left rounded-xl border px-3 py-2.5 transition ${
                    activeSection?.id === sec.id
                      ? "border-roxo bg-roxo-100"
                      : "border-linha hover:bg-fundo"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-black">{sec.studentCode}</span>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        sec.status === "concluido"
                          ? "bg-sucesso/10 text-black"
                          : sec.status === "em_andamento"
                          ? "bg-ceu-100 text-black"
                          : "bg-ouro-100 text-black"
                      }`}
                    >
                      {sec.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-800 mt-0.5">
                    <strong>Especialidade:</strong> {SPECIALTY_NAMES[sec.specialty] ?? sec.specialty}
                    {sec.birthYear ? ` · nasc. ${sec.birthYear}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Editor panel */}
          <div className="min-w-0 lg:col-span-2">
            {!activeSection ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linha bg-white py-20 text-center">
                <Stethoscope className="h-10 w-10 text-neutral-800/40 mb-3" />
                <p className="text-sm text-black">Selecione uma seção para redigir o parecer</p>
              </div>
            ) : (
              <div className="min-w-0 rounded-2xl bg-white border border-linha p-4 shadow-suave space-y-5 sm:p-6">
                {/* Prontuário Oficial - 5 Colunas Padronizadas */}
                <ProntuarioHeaderCard
                  studentCode={activeSection.studentCode}
                  studentName={`Aluno (${activeSection.studentCode.slice(-6)})`}
                  nomeCompleto={nomeAluno.fullName}
                  schoolName={slug}
                  ageText={activeSection.birthYear ? `${new Date().getFullYear() - activeSection.birthYear} anos` : "Idade não informada"}
                  professionalName={activeSection.professionalName || me?.name || "Especialista do Núcleo"}
                  professionalRole={activeSection.specialty}
                  journeyState={activeSection.status === "concluido" ? "encerrado" : "delegado"}
                />

                {/* Navegação Horizontal do Prontuário Clínico para o Especialista */}
                <div className="pt-2">
                  <ProntuarioHorizontalTabs
                    caseId={activeSection.caseId}
                    studentCode={activeSection.studentCode}
                    isDoctorOrMaster={false}
                    specialtyOnlySummary={true}
                    userSpecialty={activeSection.specialty}
                    childrenOverview={
                      <div className="min-w-0 space-y-4">
                        {/* Section header */}
                        <div className="flex items-start justify-between border-b border-linha pb-3">
                          <div>
                            <span className="text-xs font-bold text-roxo-900 bg-roxo-50 border border-roxo-200 rounded-full px-2.5 py-0.5">
                              {SPECIALTY_NAMES[activeSection.specialty] ?? activeSection.specialty}
                            </span>
                            <h2 className="mt-2 text-base font-bold text-black">
                              Parecer Clínico Multiprofissional
                            </h2>
                          </div>
                          <span
                            className={`text-xs font-bold rounded-full px-2.5 py-1 ${
                              activeSection.status === "concluido"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : activeSection.status === "em_andamento"
                                ? "bg-sky-50 text-sky-800 border border-sky-200"
                                : "bg-amber-50 text-amber-900 border border-amber-200"
                            }`}
                          >
                            {activeSection.status === "concluido" ? "Concluído" : activeSection.status === "em_andamento" ? "Em andamento" : "Pendente"}
                          </span>
                        </div>

                        {isReadOnly && (
                          <div className="flex items-center gap-2 rounded-xl border border-sucesso/20 bg-sucesso/5 px-4 py-3 text-sm text-black">
                            <CheckCircle className="h-4 w-4 shrink-0" />
                            Parecer concluído e registrado no prontuário. Edição bloqueada.
                          </div>
                        )}

                        {saveMsg && (
                          <div
                            className={`rounded-xl px-4 py-3 text-sm ${
                              saveMsg.includes("concluído") || saveMsg.includes("salvo")
                                ? "bg-sucesso/10 text-black"
                                : "bg-erro/10 text-black"
                            }`}
                          >
                            {saveMsg}
                          </div>
                        )}

                        {ctx && <CaseContextPanel ctx={ctx} isReadOnly={isReadOnly ?? false} />}

                        <EspecialidadeFormsPanel key={`${activeSection.id}:${activeSection.status}`} sectionId={activeSection.id} specialty={activeSection.specialty} />

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor={`parecer-${activeSection.id}`} className="text-xs font-semibold text-black">
                              Parecer clínico — {SPECIALTY_NAMES[activeSection.specialty] ?? activeSection.specialty}
                              {!isReadOnly && <span className="text-black ml-1">*</span>}
                            </label>
                            <span
                              className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                notes.trim().length >= 100
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {notes.trim().length} / 100 caracteres mínimos
                            </span>
                          </div>
                          <textarea
                            id={`parecer-${activeSection.id}`}
                            rows={8}
                            disabled={isReadOnly}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={`Descreva detalhadamente suas observações clínicas, marcos avaliados, evolução e recomendações terapêuticas para ${activeSection.specialty} (mínimo de 100 caracteres)...`}
                            className="w-full min-w-0 rounded-xl border border-linha px-3 py-3 text-sm text-black whitespace-pre-wrap break-words [overflow-wrap:anywhere] resize-y outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo disabled:text-neutral-800"
                          />
                        </div>

                        {!isReadOnly && (
                          <div className="flex flex-col gap-3 border-t border-linha pt-3 sm:flex-row sm:items-start sm:justify-between">
                            <p className="max-w-xl text-sm text-neutral-800">
                              Depois de concluir, o parecer não pode mais ser alterado. Mínimo de 100 caracteres.
                            </p>
                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              <Button
                                type="button"
                                disabled={saving}
                                onClick={() => handleSave(false)}
                                variant="outline" size="md" className="min-h-[44px]"
                              >
                                Salvar rascunho
                              </Button>
                              <div className="flex flex-col items-start gap-1 sm:items-end">
                                <Button
                                  type="button"
                                  disabled={saving || notes.trim().length < 100}
                                  onClick={() => handleSave(true)}
                                  variant="primary" size="md" className="min-h-[44px]"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  {saving ? "Salvando..." : "Concluir parecer"}
                                </Button>
                                {notes.trim().length < 100 && (
                                  <p aria-live="polite" className="text-xs font-medium text-neutral-800">
                                    Faltam {100 - notes.trim().length} caracteres
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    }
                  />
                </div>

                <p className="flex items-start gap-2 border-t border-linha pt-3 text-sm text-neutral-800">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Não escreva nome, CPF, telefone ou endereço da criança ou da família no texto. Este parecer faz parte do Prontuário Multidisciplinar Consolidado.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
