"use client";

/**
 * Gráficos do painel de Tarumã. SVG/CSS puro (sem biblioteca), texto preto, contraste AA.
 * Valor nulo = célula oculta (<5 casos): aparece hachurada, nunca como zero.
 */

export interface Datum {
  key: string;
  label: string;
  value: number | null;
  share?: number | null;
  highlight?: boolean;
}
export interface Kpi { id: string; label: string; value: string; detail: string }
export interface ServiceRow { key: string; label: string; demand: number | null; capacity: number; professionals: number | null }
export interface Heatmap { services: { key: string; label: string }[]; rows: { school: string; cells: (number | null)[] }[] }

const fmt = (v: number | null | undefined) => (v == null ? "<5" : String(v).replace(".", ","));
const HATCH = "repeating-linear-gradient(45deg,#d4d4d4 0 4px,#fff 4px 8px)";

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {kpis.map((k, i) => (
        <div
          key={k.id}
          className={`rounded-2xl border bg-white p-4 shadow-suave ${i === 0 ? "border-roxo bg-roxo-50" : "border-linha"}`}
        >
          <div className="text-xs font-semibold text-black">{k.label}</div>
          <div className={`mt-1 font-bold text-black ${k.value.length > 10 ? "text-lg leading-tight" : "text-3xl"}`}>{k.value}</div>
          {k.detail && <div className="mt-1 text-[11px] leading-snug text-black">{k.detail}</div>}
        </div>
      ))}
    </section>
  );
}

/** Barras horizontais ordenadas. `unit` aparece depois do número (ex.: "%"). */
export function HBarChart({
  title, subtitle, data, showShare = false, color = "roxo", emptyText = "Sem dados para exibir.",
}: {
  title: string; subtitle?: string; data: Datum[]; showShare?: boolean; color?: "roxo" | "ceu"; emptyText?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  const fill = color === "roxo" ? "bg-roxo-200 border-roxo" : "bg-ceu-100 border-ceu-700";
  return (
    <figure className="rounded-2xl border border-linha bg-white p-4 shadow-suave">
      <figcaption className="mb-3">
        <div className="text-sm font-bold text-black">{title}</div>
        {subtitle && <div className="text-xs text-black">{subtitle}</div>}
      </figcaption>
      {data.length === 0 ? (
        <p className="text-sm text-black">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5" role="list">
          {data.map((d) => (
            <li key={d.key} className="grid grid-cols-[minmax(80px,170px)_1fr_auto] items-center gap-2 text-xs text-black">
              <span className="truncate" title={d.label}>{d.label}</span>
              <div className="h-5 overflow-hidden rounded border border-linha bg-neutral-50" aria-hidden>
                {d.value != null ? (
                  <div className={`h-full border-r ${fill}`} style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
                ) : (
                  <div className="h-full w-full" style={{ backgroundImage: HATCH }} />
                )}
              </div>
              <span className="w-24 text-right font-semibold tabular-nums">
                {fmt(d.value)}
                {showShare && d.share != null && <span className="ml-1 font-normal">({fmt(d.share)}%)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Colunas verticais (faixa etária), com a faixa do piloto destacada. */
export function ColumnChart({ title, subtitle, data }: { title: string; subtitle?: string; data: Datum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  const H = 150;
  return (
    <figure className="rounded-2xl border border-linha bg-white p-4 shadow-suave">
      <figcaption className="mb-3">
        <div className="text-sm font-bold text-black">{title}</div>
        {subtitle && <div className="text-xs text-black">{subtitle}</div>}
      </figcaption>
      <div className="flex items-end gap-3" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${fmt(d.value)}`).join("; ")}`}>
        {data.map((d) => (
          <div key={d.key} className="flex flex-1 flex-col items-center text-xs text-black">
            <span className="mb-1 font-semibold tabular-nums">{fmt(d.value)}</span>
            <div className="flex w-full items-end justify-center" style={{ height: H }}>
              {d.value != null ? (
                <div
                  className={`w-full max-w-[56px] rounded-t border ${d.highlight ? "border-2 border-roxo bg-roxo-200" : "border-ceu-700 bg-ceu-100"}`}
                  style={{ height: Math.max(3, (d.value / max) * H) }}
                />
              ) : (
                <div className="w-full max-w-[56px] rounded-t border border-neutral-400" style={{ height: 24, backgroundImage: HATCH }} />
              )}
            </div>
            <span className="mt-1 text-center leading-tight">{d.label}</span>
            {d.share != null && <span className="text-[11px]">{fmt(d.share)}%</span>}
            {d.highlight && <span className="mt-0.5 rounded-full border border-roxo bg-roxo-100 px-2 text-[10px] font-bold">piloto</span>}
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Demanda registrada × profissionais necessários por especialidade. */
export function ServiceDemand({ rows }: { rows: ServiceRow[] }) {
  const maxD = Math.max(1, ...rows.map((r) => r.demand ?? 0));
  return (
    <figure className="rounded-2xl border border-linha bg-white p-4 shadow-suave">
      <figcaption className="mb-3">
        <div className="text-sm font-bold text-black">Demanda por especialidade e profissionais necessários</div>
        <div className="text-xs text-black">Casos com demanda registrada ÷ casos acompanhados por profissional (parâmetro provisório, editável abaixo).</div>
      </figcaption>
      <ul className="space-y-1.5" role="list">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(110px,170px)_1fr_auto] items-center gap-2 text-xs text-black">
            <span className="truncate">{r.label}</span>
            <div className="h-5 overflow-hidden rounded border border-linha bg-neutral-50" aria-hidden>
              {r.demand != null ? (
                <div className="h-full border-r border-ceu-700 bg-ceu-100" style={{ width: `${Math.max(2, (r.demand / maxD) * 100)}%` }} />
              ) : (
                <div className="h-full w-full" style={{ backgroundImage: HATCH }} />
              )}
            </div>
            <span className="w-44 text-right tabular-nums">
              <strong>{fmt(r.demand)}</strong> casos → <strong>{r.professionals == null ? "—" : fmt(r.professionals)}</strong> prof.
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Mapa de calor escola × especialidade (contagens; hachurado = oculto). */
export function SchoolServiceHeatmap({ heat }: { heat: Heatmap }) {
  const max = Math.max(1, ...heat.rows.flatMap((r) => r.cells.map((c) => c ?? 0)));
  const shade = (v: number) => {
    const a = 0.1 + 0.45 * (v / max); // teto baixo: texto preto sempre legível
    return `rgba(104,40,128,${a.toFixed(2)})`;
  };
  return (
    <figure className="rounded-2xl border border-linha bg-white p-4 shadow-suave overflow-x-auto">
      <figcaption className="mb-3">
        <div className="text-sm font-bold text-black">Demanda por escola e especialidade</div>
        <div className="text-xs text-black">Número de casos com demanda registrada. “&lt;5” = oculto por privacidade.</div>
      </figcaption>
      <table className="w-full min-w-[560px] border-separate border-spacing-1 text-xs text-black">
        <thead>
          <tr>
            <th className="text-left font-semibold">Escola</th>
            {heat.services.map((s) => (
              <th key={s.key} className="font-semibold leading-tight">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heat.rows.map((r) => (
            <tr key={r.school}>
              <td className="pr-2 font-semibold">{r.school}</td>
              {r.cells.map((c, i) => (
                <td
                  key={i}
                  className="h-8 rounded text-center font-semibold tabular-nums"
                  style={c == null ? { backgroundImage: HATCH } : { background: shade(c) }}
                >
                  {fmt(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
