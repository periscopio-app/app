"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Search, ShieldCheck, User, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useCapabilities } from "@/lib/capabilities";
import { RoleBanner } from "@/components/ui/RoleBanner";
import { Button } from "@/components/ui";

// ─── tipos (espelham /api/pilot/*) ──────────────────────────────────────────

interface CountCell { value: number | null; suppressed: boolean }
interface PercentCell { value: number | null; numerator: number | null; denominator: number | null; suppressed: boolean; reason?: "grupo_pequeno" | "sem_denominador" }
interface Def { id: string; ordem: number; titulo: string; enunciado: string; numerador: string; denominador: string; fonte: string; status: string; pendencias: string[] }
type DesfechoKey = "alta" | "abandono" | "interrupcao_justificada" | "encaminhamento" | "acompanhamento" | "em_atendimento";
type VariationKey = "menos_itens" | "igual" | "mais_itens";
interface EstSource {
  comMedidaInicial: CountCell; comReavaliacao: CountCell; comParCompleto: CountCell; percentualComPar: PercentCell;
  direcao: Record<VariationKey, CountCell>; variacaoMedia: number | null;
}
interface Group {
  capacitacao: { educadores: number; concluiram: number; emAndamento: number; naoIniciaram: number; percentual: PercentCell; cursosObrigatorios: number; catalogoVazio: boolean };
  rastreio: { matricula: number | null; casosAbertos: CountCell; fogapEnviado: CountCell; percentual: PercentCell };
  acesso: { encaminhados: CountCell; acessaram: CountCell; aguardando: CountCell; percentual: PercentCell; medianaDias: number | null };
  desfecho: { admitidos: CountCell; categorias: Record<DesfechoKey, CountCell>; taxas: { adesao: PercentCell; abandono: PercentCell; alta: PercentCell } };
  estabilizacao: { admitidos: CountCell; medida: string; escola: EstSource; nucleo: EstSource };
}
interface SchoolGroup extends Group { schoolId: string; schoolName: string; isControlGroup: boolean }
interface GroupResponse {
  generatedAt: string;
  scope: { schools: number };
  definitions: Def[];
  historicalReference: { fonte: string; abandono: number; interrupcaoJustificada: number; alta: number; nota: string };
  overall: Group;
  bySchool: SchoolGroup[];
  notes: string[];
}
interface SourcePair { inicial: number | null; reavaliacao: number | null; itemsTotal: number | null; variacao: number | null; direcao: VariationKey | null }
interface StudentCase {
  caseId: string; journeyState: string; abertoEm: string;
  rastreio: { fogapEnviadoEm: string | null };
  acesso: { primeiraAvaliacaoEm: string | null; diasAteAvaliacao: number | null; aguardando: boolean };
  desfecho: { categoria: DesfechoKey; rotulo: string; encerradoEm: string | null; acompanhamento: "semestral" | "anual" | null };
  estabilizacao: { medida: string; escola: SourcePair; nucleo: SourcePair };
}
interface StudentResponse { student: { studentCode: string; ageBracket: string | null; schoolName: string | null }; cases: StudentCase[]; definitions: Def[]; note: string }
interface MeasureItems { measure: string; version: string; aviso: string; options: string[]; items: { id: string; n: number; texto: string }[] }

const DESFECHO_LABELS: Record<DesfechoKey, string> = {
  alta: "Alta", abandono: "Abandono", interrupcao_justificada: "Interrupção justificada",
  encaminhamento: "Encaminhamento", acompanhamento: "Acompanhamento (semestral/anual)", em_atendimento: "Em atendimento",
};
const VARIATION_LABELS: Record<VariationKey, string> = { menos_itens: "Menos itens marcados", igual: "Mesma contagem", mais_itens: "Mais itens marcados" };
const OPTION_LABELS: Record<string, string> = { nem_um_pouco: "Nem um pouco", so_um_pouco: "Só um pouco", bastante: "Bastante", demais: "Demais" };
const STATE_LABELS: Record<string, string> = {
  rascunho: "Rascunho (escola)", enviado_re: "Enviado pelo RE", revisao_medica: "Em revisão médica",
  delegado: "Delegado aos especialistas", retornado: "Retornado ao médico", encerrado: "Encerrado",
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

function Count({ cell }: { cell: CountCell }) {
  if (cell.suppressed) return <span title="Grupo com menos de 5 alunos: oculto para proteger as crianças" className="font-semibold">&lt;5</span>;
  return <span>{cell.value ?? "—"}</span>;
}

function Pct({ cell, withFraction = true }: { cell: PercentCell; withFraction?: boolean }) {
  if (cell.reason === "sem_denominador") return <span title="Sem denominador válido (matrícula não informada)">—</span>;
  if (cell.suppressed) return <span title="Grupo pequeno ou diferença que identificaria crianças: oculto" className="font-semibold">&lt;5</span>;
  return (
    <span>
      <strong>{cell.value?.toLocaleString("pt-BR")}%</strong>
      {withFraction && cell.numerator != null && cell.denominator != null && (
        <span className="ml-1 text-xs text-black/70">({cell.numerator}/{cell.denominator})</span>
      )}
    </span>
  );
}

function Big({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-linha bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/70">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{children}</p>
      {hint && <p className="mt-1 text-xs text-black/70">{hint}</p>}
    </div>
  );
}

function Definition({ def }: { def: Def }) {
  return (
    <details className="mt-2 rounded-xl border border-linha bg-roxo-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold">Como é calculado (definição em proposta)</summary>
      <dl className="mt-2 space-y-1">
        <div><dt className="inline font-semibold">Numerador: </dt><dd className="inline">{def.numerador}</dd></div>
        <div><dt className="inline font-semibold">Denominador: </dt><dd className="inline">{def.denominador}</dd></div>
        <div><dt className="inline font-semibold">Fonte: </dt><dd className="inline">{def.fonte}</dd></div>
      </dl>
      <p className="mt-2 font-semibold">Perguntas abertas para a validação:</p>
      <ul className="list-disc pl-5">{def.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
    </details>
  );
}

function SectionHead({ def }: { def: Def }) {
  return (
    <header>
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black bg-roxo-100 text-sm">{def.ordem}</span>
        {def.titulo}
      </h2>
      <p className="mt-1 text-sm">{def.enunciado}</p>
      <Definition def={def} />
    </header>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th scope="col" className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide">{children}</th>;
}

// ─── painel de grupo ────────────────────────────────────────────────────────

function GroupPanel() {
  const [data, setData] = useState<GroupResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  const [group, setGroup] = useState<"pilot" | "control" | "all">("pilot");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ group });
    if (schoolId) qs.set("schoolId", schoolId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    try {
      const r = await api.get<GroupResponse>(`/api/pilot/indicators?${qs.toString()}`);
      setData(r);
      if (!schoolId) setSchoolOptions(r.bySchool.map((s) => ({ id: s.schoolId, name: s.schoolName })));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar os indicadores.");
    } finally {
      setLoading(false);
    }
  }, [group, schoolId, from, to]);

  useEffect(() => { void load(); }, [load]);

  const defs = useMemo(() => new Map((data?.definitions ?? []).map((d) => [d.id, d])), [data]);
  const o = data?.overall;
  const label = schoolId ? (data?.bySchool[0]?.schoolName ?? "Escola") : "Seleção";

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-linha bg-white p-3" onSubmit={(e) => e.preventDefault()} aria-label="Filtros">
        <label className="text-sm">
          <span className="block text-xs font-semibold">Escola</span>
          <select className="mt-1 rounded-lg border border-black bg-white px-2 py-1.5" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">Todas as escolas</option>
            {schoolOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold">Grupo</span>
          <select className="mt-1 rounded-lg border border-black bg-white px-2 py-1.5" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
            <option value="pilot">Escolas do piloto</option>
            <option value="control">Grupo controle</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold">Casos abertos de</span>
          <input type="date" className="mt-1 rounded-lg border border-black bg-white px-2 py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold">até</span>
          <input type="date" className="mt-1 rounded-lg border border-black bg-white px-2 py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {loading && <span className="text-sm" role="status">Carregando…</span>}
      </form>

      {error && <p role="alert" className="rounded-xl border border-black bg-white p-3 text-sm">{error}</p>}

      {data && o && (
        <>
          <ul className="space-y-1 rounded-xl border border-linha bg-roxo-50 p-3 text-xs">
            {data.notes.map((n) => <li key={n} className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />{n}</li>)}
          </ul>

          {/* 1 Capacitação */}
          <section aria-labelledby="ind-1" className="space-y-3">
            <div id="ind-1"><SectionHead def={defs.get("capacitacao")!} /></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Big label={`Concluíram (${label})`}><Pct cell={o.capacitacao.percentual} /></Big>
              <Big label="Educadores">{o.capacitacao.educadores}</Big>
              <Big label="Em andamento">{o.capacitacao.emAndamento}</Big>
              <Big label="Não iniciaram">{o.capacitacao.naoIniciaram}</Big>
            </div>
            <p className="text-xs">Cursos obrigatórios considerados: {o.capacitacao.cursosObrigatorios}{o.capacitacao.catalogoVazio ? " — nenhum curso cadastrado no LMS ainda." : "."}</p>
          </section>

          {/* 2 Rastreio */}
          <section aria-labelledby="ind-2" className="space-y-3">
            <div id="ind-2"><SectionHead def={defs.get("rastreio")!} /></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Big label="FOGAP enviado ao médico"><Pct cell={o.rastreio.percentual} /></Big>
              <Big label="Alunos com FOGAP enviado"><Count cell={o.rastreio.fogapEnviado} /></Big>
              <Big label="Casos abertos pelo RE"><Count cell={o.rastreio.casosAbertos} /></Big>
              <Big label="Matriculados (denominador)">{o.rastreio.matricula ?? "—"}</Big>
            </div>
          </section>

          {/* 3 Acesso */}
          <section aria-labelledby="ind-3" className="space-y-3">
            <div id="ind-3"><SectionHead def={defs.get("acesso")!} /></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Big label="Acessaram o núcleo"><Pct cell={o.acesso.percentual} /></Big>
              <Big label="Encaminhados"><Count cell={o.acesso.encaminhados} /></Big>
              <Big label="Aguardando 1ª avaliação"><Count cell={o.acesso.aguardando} /></Big>
              <Big label="Mediana até a 1ª avaliação" hint="Dias entre o envio do FOGAP e a avaliação médica. Aparece com 5 ou mais casos.">
                {o.acesso.medianaDias == null ? "—" : `${o.acesso.medianaDias.toLocaleString("pt-BR")} dias`}
              </Big>
            </div>
          </section>

          {/* 4 Desfecho */}
          <section aria-labelledby="ind-4" className="space-y-3">
            <div id="ind-4"><SectionHead def={defs.get("desfecho")!} /></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Big label="Adesão"><Pct cell={o.desfecho.taxas.adesao} /></Big>
              <Big label="Abandono"><Pct cell={o.desfecho.taxas.abandono} /></Big>
              <Big label="Alta"><Pct cell={o.desfecho.taxas.alta} /></Big>
              <Big label="Casos que acessaram o núcleo"><Count cell={o.desfecho.admitidos} /></Big>
            </div>
            <div className="overflow-x-auto rounded-xl border border-linha bg-white">
              <table className="w-full text-sm">
                <caption className="sr-only">Casos por desfecho registrado pelo médico</caption>
                <thead className="border-b border-linha"><tr><Th>Desfecho</Th><Th>Casos</Th></tr></thead>
                <tbody>
                  {(Object.keys(DESFECHO_LABELS) as DesfechoKey[]).map((k) => (
                    <tr key={k} className="border-b border-linha last:border-0">
                      <td className="px-3 py-2">{DESFECHO_LABELS[k]}</td>
                      <td className="px-3 py-2"><Count cell={o.desfecho.categorias[k]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rounded-xl border border-linha bg-white p-3 text-xs">
              <strong>Para contexto, não é meta:</strong> no programa analógico (2015–2025) abandonaram {data.historicalReference.abandono.toLocaleString("pt-BR")}%,
              interromperam com justificativa {data.historicalReference.interrupcaoJustificada}% e tiveram alta {data.historicalReference.alta.toLocaleString("pt-BR")}%.
              {" "}{data.historicalReference.fonte} {data.historicalReference.nota}
            </p>
          </section>

          {/* 5 Estabilização */}
          <section aria-labelledby="ind-5" className="space-y-3">
            <div id="ind-5"><SectionHead def={defs.get("estabilizacao")!} /></div>
            <p className="text-xs">Medida: {o.estabilizacao.medida}. Mostra só se a contagem ficou menor, igual ou maior entre a avaliação inicial e a reavaliação. Não classifica o aluno.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {(["nucleo", "escola"] as const).map((src) => {
                const s = o.estabilizacao[src];
                return (
                  <div key={src} className="rounded-xl border border-linha bg-white p-3">
                    <h3 className="font-bold">{src === "nucleo" ? "Medida do núcleo" : "Medida da escola"}</h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>Com medida inicial: <strong><Count cell={s.comMedidaInicial} /></strong></li>
                      <li>Com reavaliação: <strong><Count cell={s.comReavaliacao} /></strong></li>
                      <li>Com as duas (comparáveis): <strong><Count cell={s.comParCompleto} /></strong> — <Pct cell={s.percentualComPar} /> dos que acessaram o núcleo</li>
                      {(Object.keys(VARIATION_LABELS) as VariationKey[]).map((k) => (
                        <li key={k}>{VARIATION_LABELS[k]}: <strong><Count cell={s.direcao[k]} /></strong></li>
                      ))}
                      <li>Variação média da contagem: <strong>{s.variacaoMedia == null ? "—" : s.variacaoMedia.toLocaleString("pt-BR")}</strong></li>
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Por escola */}
          <section aria-labelledby="por-escola" className="space-y-2">
            <h2 id="por-escola" className="flex items-center gap-2 text-lg font-extrabold"><Users className="h-5 w-5" /> Por escola</h2>
            <div className="overflow-x-auto rounded-xl border border-linha bg-white">
              <table className="w-full min-w-[900px] text-sm">
                <caption className="sr-only">Indicadores do piloto por escola</caption>
                <thead className="border-b border-linha">
                  <tr><Th>Escola</Th><Th>1 Capacitação</Th><Th>2 Rastreio</Th><Th>3 Acesso ao núcleo</Th><Th>4 Adesão</Th><Th>4 Abandono</Th><Th>4 Alta</Th><Th>5 Com reavaliação (núcleo)</Th></tr>
                </thead>
                <tbody>
                  {data.bySchool.length === 0 && <tr><td colSpan={8} className="px-3 py-3">Nenhuma escola neste filtro.</td></tr>}
                  {data.bySchool.map((s) => (
                    <tr key={s.schoolId} className="border-b border-linha last:border-0">
                      <th scope="row" className="px-3 py-2 text-left font-semibold">{s.schoolName}{s.isControlGroup ? " (controle)" : ""}</th>
                      <td className="px-3 py-2"><Pct cell={s.capacitacao.percentual} /></td>
                      <td className="px-3 py-2"><Pct cell={s.rastreio.percentual} /></td>
                      <td className="px-3 py-2"><Pct cell={s.acesso.percentual} /></td>
                      <td className="px-3 py-2"><Pct cell={s.desfecho.taxas.adesao} withFraction={false} /></td>
                      <td className="px-3 py-2"><Pct cell={s.desfecho.taxas.abandono} withFraction={false} /></td>
                      <td className="px-3 py-2"><Pct cell={s.desfecho.taxas.alta} withFraction={false} /></td>
                      <td className="px-3 py-2"><Count cell={s.estabilizacao.nucleo.comParCompleto} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs">Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>
          </section>
        </>
      )}
    </div>
  );
}

// ─── ficha do aluno ─────────────────────────────────────────────────────────

function PairRow({ title, pair }: { title: string; pair: SourcePair }) {
  const dir = pair.direcao ? VARIATION_LABELS[pair.direcao] : "—";
  return (
    <tr className="border-b border-linha last:border-0">
      <th scope="row" className="px-3 py-2 text-left font-semibold">{title}</th>
      <td className="px-3 py-2">{pair.inicial ?? "—"}{pair.itemsTotal ? ` de ${pair.itemsTotal}` : ""}</td>
      <td className="px-3 py-2">{pair.reavaliacao ?? "—"}{pair.itemsTotal ? ` de ${pair.itemsTotal}` : ""}</td>
      <td className="px-3 py-2">{pair.variacao == null ? "—" : `${pair.variacao > 0 ? "+" : ""}${pair.variacao}`}</td>
      <td className="px-3 py-2">{dir}</td>
    </tr>
  );
}

function MeasureForm({ caseId, sources, onSaved }: { caseId: string; sources: ("escola" | "nucleo")[]; onSaved: () => void }) {
  const [items, setItems] = useState<MeasureItems | null>(null);
  const [phase, setPhase] = useState<"inicial" | "reavaliacao">("inicial");
  const [source, setSource] = useState<"escola" | "nucleo">(sources[0]);
  const [appliedOn, setAppliedOn] = useState(new Date().toISOString().slice(0, 10));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get<MeasureItems>("/api/pilot/measure-items").then(setItems).catch(() => setMsg("Não foi possível carregar os itens.")); }, []);

  if (!items) return <p className="text-sm">{msg || "Carregando itens…"}</p>;
  const complete = items.items.every((i) => answers[i.id]);

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api.post<{ markedCount: number; itemsTotal: number }>(`/api/cases/${caseId}/symptom-measurements`, { phase, source, appliedOn, answers });
      setMsg(`Medida gravada: ${r.markedCount} de ${r.itemsTotal} itens marcados Bastante ou Demais.`);
      setAnswers({});
      onSaved();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Não foi possível gravar a medida.");
    } finally { setBusy(false); }
  };

  return (
    <form className="space-y-3 rounded-xl border border-linha bg-white p-3" onSubmit={(e) => { e.preventDefault(); if (complete) void save(); }}>
      <h4 className="font-bold">Registrar medida de sintomas</h4>
      <p className="text-xs">{items.aviso} Gravar de novo substitui a medida anterior nos indicadores, e a anterior fica no histórico.</p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm"><span className="block text-xs font-semibold">Momento</span>
          <select className="mt-1 rounded-lg border border-black bg-white px-2 py-1.5" value={phase} onChange={(e) => setPhase(e.target.value as typeof phase)}>
            <option value="inicial">Avaliação inicial</option><option value="reavaliacao">Reavaliação (fim do ano letivo)</option>
          </select></label>
        <label className="text-sm"><span className="block text-xs font-semibold">Origem</span>
          <select className="mt-1 rounded-lg border border-black bg-white px-2 py-1.5" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            {sources.map((s) => <option key={s} value={s}>{s === "escola" ? "Escola" : "Núcleo"}</option>)}
          </select></label>
        <label className="text-sm"><span className="block text-xs font-semibold">Data de aplicação</span>
          <input type="date" max={new Date().toISOString().slice(0, 10)} className="mt-1 rounded-lg border border-black bg-white px-2 py-1.5" value={appliedOn} onChange={(e) => setAppliedOn(e.target.value)} /></label>
      </div>
      <ol className="space-y-2">
        {items.items.map((i) => (
          <li key={i.id}>
            <fieldset>
              <legend className="text-sm"><strong>{i.n}.</strong> {i.texto}</legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {items.options.map((o) => (
                  <label key={o} className="inline-flex items-center gap-1 text-sm">
                    <input type="radio" name={i.id} value={o} checked={answers[i.id] === o} onChange={() => setAnswers((a) => ({ ...a, [i.id]: o }))} />
                    {OPTION_LABELS[o] ?? o}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <Button type="submit" disabled={!complete || busy} variant="primary" size="md">
        {busy ? "Gravando…" : "Gravar medida"}
      </Button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </form>
  );
}

function StudentPanel({ canRecord, role }: { canRecord: boolean; role: string }) {
  const [code, setCode] = useState("");
  const [data, setData] = useState<StudentResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sources: ("escola" | "nucleo")[] =
    ["ppi", "re", "responsavel_escolar"].includes(role) ? ["escola"] : ["admin_platform", "adm_master"].includes(role) ? ["escola", "nucleo"] : ["nucleo"];

  const search = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setLoading(true); setError("");
    try {
      setData(await api.get<StudentResponse>(`/api/pilot/students/${encodeURIComponent(value.trim())}/indicators`));
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar o aluno.");
    } finally { setLoading(false); }
  }, []);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-linha bg-white p-3" onSubmit={(e) => { e.preventDefault(); void search(code); }}>
        <label className="text-sm"><span className="block text-xs font-semibold">Código do aluno</span>
          <input className="mt-1 w-72 rounded-lg border border-black bg-white px-2 py-1.5 font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: DEMO-2026-AB12CD34" autoComplete="off" /></label>
        <Button type="submit" variant="primary" size="md"><Search className="h-4 w-4" /> Acompanhar</Button>
        {loading && <span role="status" className="text-sm">Carregando…</span>}
      </form>
      <p className="text-xs">O aluno é sempre identificado pelo código. Cada consulta fica registrada na auditoria.</p>
      {error && <p role="alert" className="rounded-xl border border-black bg-white p-3 text-sm">{error}</p>}

      {data && (
        <div className="space-y-4">
          <p className="text-sm">Aluno <strong className="font-mono">{data.student.studentCode}</strong> · faixa {data.student.ageBracket ?? "—"} · {data.student.schoolName ?? "—"}</p>
          {data.cases.length === 0 && <p className="rounded-xl border border-linha bg-white p-3 text-sm">Este aluno ainda não tem caso aberto.</p>}
          {data.cases.map((c) => (
            <article key={c.caseId} className="space-y-3 rounded-xl border border-linha bg-white p-4">
              <h3 className="font-extrabold">Caso aberto em {fmtDate(c.abertoEm)} · {STATE_LABELS[c.journeyState] ?? c.journeyState}</h3>
              <ol className="grid gap-3 md:grid-cols-3">
                <li className="rounded-xl border border-linha p-3 text-sm"><p className="font-bold">2 · Rastreio</p>
                  <p>FOGAP enviado ao médico: <strong>{fmtDate(c.rastreio.fogapEnviadoEm)}</strong></p></li>
                <li className="rounded-xl border border-linha p-3 text-sm"><p className="font-bold">3 · Acesso ao núcleo</p>
                  <p>Primeira avaliação: <strong>{fmtDate(c.acesso.primeiraAvaliacaoEm)}</strong></p>
                  <p>{c.acesso.diasAteAvaliacao != null ? `${c.acesso.diasAteAvaliacao.toLocaleString("pt-BR")} dias após o envio` : c.acesso.aguardando ? "Aguardando a primeira avaliação" : "Ainda não encaminhado"}</p></li>
                <li className="rounded-xl border border-linha p-3 text-sm"><p className="font-bold">4 · Desfecho</p>
                  <p><strong>{c.desfecho.rotulo}</strong>{c.desfecho.acompanhamento ? ` (${c.desfecho.acompanhamento})` : ""}</p>
                  <p>{c.desfecho.encerradoEm ? `Encerrado em ${fmtDate(c.desfecho.encerradoEm)}` : "Sem encerramento"}</p>
                  <p className="mt-1 text-xs">A decisão é do médico responsável.</p></li>
              </ol>
              <div>
                <h4 className="font-bold">5 · Inicial × reavaliação</h4>
                <p className="text-xs">{c.estabilizacao.medida}. A variação é a contagem da reavaliação menos a inicial; não é diagnóstico nem classificação.</p>
                <div className="mt-2 overflow-x-auto rounded-xl border border-linha">
                  <table className="w-full text-sm">
                    <thead className="border-b border-linha"><tr><Th>Origem</Th><Th>Inicial</Th><Th>Reavaliação</Th><Th>Variação</Th><Th>Direção</Th></tr></thead>
                    <tbody>
                      <PairRow title="Núcleo" pair={c.estabilizacao.nucleo} />
                      <PairRow title="Escola" pair={c.estabilizacao.escola} />
                    </tbody>
                  </table>
                </div>
              </div>
              {canRecord && <MeasureForm caseId={c.caseId} sources={sources} onSaved={() => void search(data.student.studentCode)} />}
            </article>
          ))}
          <p className="text-xs">{data.note}</p>
        </div>
      )}
    </div>
  );
}

// ─── página ─────────────────────────────────────────────────────────────────

export default function IndicadoresPage() {
  const { me, has, ready } = useCapabilities();
  const canGroup = has("pilot.indicators.view");
  const canStudent = has("pilot.indicators.case.view");
  const [tab, setTab] = useState<"grupo" | "aluno">("grupo");

  useEffect(() => {
    if (ready && !canGroup && canStudent) setTab("aluno");
  }, [ready, canGroup, canStudent]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 text-black">
      {me && <RoleBanner me={me} />}
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><BarChart3 className="h-6 w-6" /> Indicadores do piloto</h1>
        <p className="mt-1 text-sm">Os cinco indicadores de avaliação do piloto, em grupo (escola e rede) e individualmente (aluno por código).</p>
        <p className="mt-2 inline-flex items-start gap-2 rounded-xl border border-linha bg-roxo-50 px-3 py-2 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Os critérios de cálculo estão em proposta, aguardando validação no planejamento da implantação. Nenhum indicador diagnostica, classifica ou define alta.
        </p>
      </header>

      {ready && !canGroup && !canStudent && (
        <p role="alert" className="rounded-xl border border-black bg-white p-3 text-sm">Seu perfil não tem acesso aos indicadores do piloto.</p>
      )}

      {(canGroup || canStudent) && (
        <div role="tablist" aria-label="Visões" className="inline-flex rounded-xl border border-linha bg-white p-1">
          {canGroup && (
            <button role="tab" aria-selected={tab === "grupo"} onClick={() => setTab("grupo")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "grupo" ? "border border-roxo bg-roxo-100" : "border border-transparent"}`}>
              <Users className="h-4 w-4" /> Grupo
            </button>
          )}
          {canStudent && (
            <button role="tab" aria-selected={tab === "aluno"} onClick={() => setTab("aluno")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "aluno" ? "border border-roxo bg-roxo-100" : "border border-transparent"}`}>
              <User className="h-4 w-4" /> Aluno
            </button>
          )}
        </div>
      )}

      {tab === "grupo" && canGroup && <GroupPanel />}
      {tab === "aluno" && canStudent && <StudentPanel canRecord={has("pilot.symptoms.record")} role={me?.role ?? ""} />}
    </div>
  );
}
