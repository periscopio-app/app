"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, ShieldCheck, Users } from "lucide-react";
import { api, type Me } from "@/lib/api";
import { RoleBanner } from "@/components/ui/RoleBanner";

interface School { id: string; name: string }
interface Summary {
  studentCode: string;
  ageBracket: string | null;
  school: School;
  submittedAt: string | null;
  stage: string;
  grupo: string | null;
  dificuldadesPersistentes: string[];
  conduta: "sim" | "nao" | null;
  qual: string;
  tempo: string;
  resultado: string;
}
interface Referral { studentCode: string; ageBracket: string | null; school: School; stage: string; updatedAt: string }

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function GestaoPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<"sumarios" | "lista">("sumarios");
  const [summaries, setSummaries] = useState<Summary[] | null>(null);
  const [referrals, setReferrals] = useState<Referral[] | null>(null);
  const [schoolId, setSchoolId] = useState("");
  const [error, setError] = useState("");

  const isMunicipal = me?.role === "municipal_manager";

  useEffect(() => {
    api.get<{ user: Me }>("/api/me").then((r) => setMe(r.user)).catch(() => setError("Não foi possível identificar seu perfil."));
  }, []);

  useEffect(() => {
    if (!me) return;
    const qs = isMunicipal && schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
    setError("");
    Promise.all([
      api.get<{ summaries: Summary[] }>(`/api/management/re-summaries${qs}`),
      api.get<{ referrals: Referral[] }>(`/api/management/nucleo-referrals${qs}`),
    ])
      .then(([s, l]) => { setSummaries(s.summaries); setReferrals(l.referrals); })
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar"));
  }, [me, isMunicipal, schoolId]);

  const schools = useMemo(() => {
    const map = new Map<string, string>();
    [...(summaries ?? []), ...(referrals ?? [])].forEach((x) => map.set(x.school.id, x.school.name));
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [summaries, referrals]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 text-black">
      {me && <RoleBanner me={me} />}
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ClipboardList className="h-6 w-6" /> Gestão do programa</h1>
        <p className="mt-1 text-sm">
          {isMunicipal ? "Sumário do RE e lista final de alunos encaminhados ao núcleo assistencial, na rede." : "Sumário do RE e lista final de alunos encaminhados ao núcleo assistencial, na sua escola."}
        </p>
        <p className="mt-2 inline-flex items-start gap-2 rounded-xl border border-linha bg-roxo-50 px-3 py-2 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Os alunos aparecem só pelo código. Respostas detalhadas, pareceres e decisões clínicas não são exibidos a este perfil.
        </p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-black bg-white p-3 text-sm">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Visões" className="inline-flex rounded-xl border border-linha bg-white p-1">
          {([["sumarios", "Sumário do RE", summaries?.length], ["lista", "Encaminhados ao núcleo", referrals?.length]] as const).map(([id, label, n]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === id ? "bg-roxo-100 border border-roxo" : "border border-transparent"}`}>
              {label}{typeof n === "number" ? ` (${n})` : ""}
            </button>
          ))}
        </div>
        {isMunicipal && schools.length > 1 && (
          <>
            <label htmlFor="g-escola" className="sr-only">Escola</label>
            <select id="g-escola" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-xl border border-black bg-white px-3 py-2 text-sm">
              <option value="">Todas as escolas</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </>
        )}
      </div>

      {tab === "sumarios" && (
        <section aria-label="Sumário do RE" className="space-y-3">
          {summaries === null && !error && <p className="text-sm">Carregando…</p>}
          {summaries?.length === 0 && <p className="rounded-xl border border-linha bg-white p-4 text-sm">Nenhum sumário enviado pelo RE ainda.</p>}
          {summaries?.map((s) => (
            <article key={s.studentCode} className="rounded-2xl border border-linha bg-white p-4 shadow-suave">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono font-bold">{s.studentCode}</span>
                <span className="rounded-full border border-linha px-2 py-0.5 text-xs">{s.school.name}</span>
                {s.ageBracket && <span className="rounded-full border border-linha px-2 py-0.5 text-xs">{s.ageBracket} anos</span>}
                <span className="rounded-full bg-roxo-100 px-2 py-0.5 text-xs font-semibold">{s.stage}</span>
                <span className="ml-auto text-xs">Enviado em {fmt(s.submittedAt)}</span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold">Dificuldades que persistem</dt><dd>{s.dificuldadesPersistentes.length ? s.dificuldadesPersistentes.join(", ") : "—"}</dd></div>
                <div><dt className="text-xs font-semibold">Escola já tomou alguma conduta?</dt><dd>{s.conduta === "sim" ? "Sim" : s.conduta === "nao" ? "Não" : "—"}</dd></div>
                {s.conduta === "sim" && <>
                  <div><dt className="text-xs font-semibold">Qual</dt><dd>{s.qual || "—"}</dd></div>
                  <div><dt className="text-xs font-semibold">Por quanto tempo</dt><dd>{s.tempo || "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-semibold">Resultado</dt><dd>{s.resultado || "—"}</dd></div>
                </>}
              </dl>
            </article>
          ))}
        </section>
      )}

      {tab === "lista" && (
        <section aria-label="Lista final de encaminhados ao núcleo assistencial">
          {referrals === null && !error && <p className="text-sm">Carregando…</p>}
          {referrals?.length === 0 && <p className="rounded-xl border border-linha bg-white p-4 text-sm">Nenhum aluno encaminhado ao núcleo ainda.</p>}
          {referrals && referrals.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-linha bg-white">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Alunos encaminhados ao núcleo assistencial</caption>
                <thead>
                  <tr className="border-b border-linha text-left">
                    <th scope="col" className="px-3 py-2"><Users className="mr-1 inline h-4 w-4" />Aluno (código)</th>
                    <th scope="col" className="px-3 py-2">Escola</th>
                    <th scope="col" className="px-3 py-2">Faixa etária</th>
                    <th scope="col" className="px-3 py-2">Etapa</th>
                    <th scope="col" className="px-3 py-2">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.studentCode} className="border-b border-linha last:border-0">
                      <td className="px-3 py-2 font-mono font-semibold">{r.studentCode}</td>
                      <td className="px-3 py-2">{r.school.name}</td>
                      <td className="px-3 py-2">{r.ageBracket ?? "—"}</td>
                      <td className="px-3 py-2">{r.stage}</td>
                      <td className="px-3 py-2">{fmt(r.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
