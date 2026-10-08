"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, type CaseSection, type Me } from "@/lib/api";
import { RoleBanner } from "@/components/ui/RoleBanner";
import { Stethoscope, AlertCircle, Lock, CheckCircle } from "lucide-react";

interface AssignedSection extends CaseSection {
  caseId: string;
  studentCode: string;
  birthYear: number | null;
}

interface CaseContext {
  fogap: { status: string; payload: Record<string, unknown> } | null;
  peerSections: { specialty: string; summary: unknown; completedAt: string | null }[];
  medicalFinalSummary: { decision?: string; followUp?: string; reason?: string; closedAt?: string } | null;
}

function textOf(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  const o = v as Record<string, unknown>;
  return String(o.clinicalNotes ?? o.texto ?? JSON.stringify(v));
}

function CaseContextPanel({ ctx }: { ctx: CaseContext }) {
  const fogapEntries = Object.entries(ctx.fogap?.payload ?? {}).filter(
    ([, v]) => v !== "" && v != null && typeof v !== "object"
  );
  return (
    <div className="rounded-xl border border-linha bg-fundo p-4 space-y-3 text-xs text-black">
      <h3 className="text-sm font-bold text-black">Contexto do caso (somente leitura)</h3>
      <div>
        <p className="font-semibold">FOGAP / avaliação do RE</p>
        {fogapEntries.length === 0 ? (
          <p className="text-neutral-800">Sem registro enviado.</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {fogapEntries.map(([k, v]) => (
              <li key={k}><span className="text-neutral-800">{k}:</span> {String(v)}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-semibold">Pareceres concluídos de outras especialidades</p>
        {ctx.peerSections.length === 0 ? (
          <p className="text-neutral-800">Nenhum parecer concluído até o momento.</p>
        ) : (
          ctx.peerSections.map((p) => (
            <p key={p.specialty} className="mt-1"><span className="font-medium">{p.specialty}:</span> {textOf(p.summary)}</p>
          ))
        )}
      </div>
      <div>
        <p className="font-semibold">Resumo final do médico</p>
        {ctx.medicalFinalSummary ? (
          <p className="mt-1">
            {ctx.medicalFinalSummary.decision}
            {ctx.medicalFinalSummary.followUp ? ` (${ctx.medicalFinalSummary.followUp})` : ""}
            {ctx.medicalFinalSummary.reason ? ` — ${ctx.medicalFinalSummary.reason}` : ""}
          </p>
        ) : (
          <p className="text-neutral-800">Disponível após o encerramento do caso.</p>
        )}
      </div>
    </div>
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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CaseContext | null>(null);

  useEffect(() => {
    setCtx(null);
    if (!activeSection) return;
    api
      .get<CaseContext>(`/api/cases/${activeSection.caseId}/specialist-view`)
      .then(setCtx)
      .catch(() => setCtx(null));
  }, [activeSection?.caseId]);

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
      {me && <RoleBanner me={me} />}

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
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
                          ? "bg-sucesso/10 text-sucesso"
                          : sec.status === "em_andamento"
                          ? "bg-ceu-100 text-black"
                          : "bg-ouro-100 text-black"
                      }`}
                    >
                      {sec.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-800 mt-0.5 capitalize">
                    {sec.specialty}
                    {sec.birthYear ? ` · nasc. ${sec.birthYear}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Editor panel */}
          <div className="lg:col-span-2">
            {!activeSection ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-linha bg-white py-20 text-center">
                <Stethoscope className="h-10 w-10 text-neutral-800/40 mb-3" />
                <p className="text-sm text-black">Selecione uma seção para redigir o parecer</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-linha p-6 shadow-suave space-y-5">
                {/* Section header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-black bg-roxo-100 rounded-full px-2.5 py-0.5 capitalize">
                      {activeSection.specialty}
                    </span>
                    <h2 className="mt-2 text-lg font-bold text-black">
                      Aluno: {activeSection.studentCode}
                    </h2>
                    {activeSection.birthYear && (
                      <p className="text-xs text-neutral-800">
                        Ano de nascimento: {activeSection.birthYear}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold rounded-full px-2.5 py-1 ${
                      activeSection.status === "concluido"
                        ? "bg-sucesso/10 text-sucesso"
                        : activeSection.status === "em_andamento"
                        ? "bg-ceu-100 text-black"
                        : "bg-ouro-100 text-black"
                    }`}
                  >
                    {activeSection.status}
                  </span>
                </div>

                {isReadOnly && (
                  <div className="flex items-center gap-2 rounded-xl border border-sucesso/20 bg-sucesso/5 px-4 py-3 text-sm text-sucesso">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    Parecer concluído e registrado no prontuário. Edição bloqueada.
                  </div>
                )}

                {saveMsg && (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm ${
                      saveMsg.includes("concluído") || saveMsg.includes("salvo")
                        ? "bg-sucesso/10 text-sucesso"
                        : "bg-erro/10 text-black"
                    }`}
                  >
                    {saveMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Parecer clínico — {activeSection.specialty}
                    {!isReadOnly && <span className="text-black ml-1">*</span>}
                  </label>
                  <textarea
                    rows={10}
                    disabled={isReadOnly}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={`Descreva suas observações clínicas, marcos avaliados, evolução e recomendações terapêuticas para ${activeSection.specialty}...`}
                    className="w-full rounded-xl border border-linha px-3 py-3 text-sm text-black resize-y outline-none focus:ring-2 focus:ring-roxo/40 disabled:bg-fundo disabled:text-neutral-800"
                  />
                </div>

                {!isReadOnly && (
                  <div className="flex items-center justify-between pt-2 border-t border-linha">
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-800">
                      <Lock className="h-3 w-3" />
                      Ao concluir, o parecer fica imutável no prontuário.
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSave(false)}
                        className="rounded-xl border border-linha px-4 py-2 text-sm font-semibold text-black hover:bg-fundo transition disabled:opacity-60"
                      >
                        Salvar rascunho
                      </button>
                      <button
                        type="button"
                        disabled={saving || !notes.trim()}
                        onClick={() => handleSave(true)}
                        className="flex items-center gap-2 rounded-xl bg-roxo-100 border border-roxo px-5 py-2 text-sm font-semibold text-black hover:bg-roxo-200 disabled:opacity-60 transition"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {saving ? "Salvando..." : "Concluir parecer"}
                      </button>
                    </div>
                  </div>
                )}

                {ctx && <CaseContextPanel ctx={ctx} />}

                <p className="text-[11px] text-neutral-800 border-t border-linha pt-3">
                  🔒 Assegure que nenhum identificador direto não autorizado conste no texto livre.
                  Este parecer faz parte do Prontuário Multidisciplinar Consolidado.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
