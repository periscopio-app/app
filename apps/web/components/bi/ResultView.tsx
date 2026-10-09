"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export interface Row { dims: Record<string, string>; value: number | null; suppressed: boolean; n?: number }
export interface Result {
  metric: string; label: string; unit: string; groupBy: string[]; groupLabels: string[];
  rows: Row[]; total: number | null; suppressedCount: number; additive: boolean;
  viz: "table" | "bar" | "line"; notes: string[]; summary?: string;
}

export const fmt = (v: number | null) => (v == null ? "<5" : String(v).replace(".", ","));
const label = (r: Row) => Object.values(r.dims).join(" · ") || "Total";

function Bars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <div className="space-y-1.5" role="img" aria-label="Gráfico de barras">
      {rows.slice(0, 20).map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(90px,200px)_1fr_56px] items-center gap-2 text-xs text-black">
          <span className="truncate" title={label(r)}>{label(r)}</span>
          <div className="h-5 rounded bg-neutral-100 border border-linha overflow-hidden">
            {r.value != null ? (
              <div className="h-full bg-roxo-100 border-r border-roxo" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            ) : (
              <div className="h-full w-full" style={{ backgroundImage: "repeating-linear-gradient(45deg,#d4d4d4 0 4px,#fff 4px 8px)" }} />
            )}
          </div>
          <span className="text-right font-semibold">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Line({ rows }: { rows: Row[] }) {
  const pts = rows.filter((r) => r.value != null);
  if (pts.length < 2) return <p className="text-xs text-black">Poucos pontos para linha; veja a tabela.</p>;
  const W = 560, H = 160, P = 28;
  const max = Math.max(1, ...pts.map((r) => r.value!));
  const x = (i: number) => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const d = pts.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.value!)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label="Gráfico de linha">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#000" strokeWidth="1" />
      <path d={d} fill="none" stroke="#000" strokeWidth="2" />
      {pts.map((r, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(r.value!)} r="4" fill="#fff" stroke="#000" strokeWidth="2" />
          <text x={x(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="#000">{label(r).slice(-5)}</text>
          <text x={x(i)} y={y(r.value!) - 8} fontSize="9" textAnchor="middle" fill="#000">{fmt(r.value)}</text>
        </g>
      ))}
    </svg>
  );
}

function csvOf(r: Result) {
  const head = [...r.groupLabels, r.label].join(";");
  const lines = r.rows.map((x) => [...r.groupBy.map((d) => x.dims[d]), x.value == null ? "<5" : x.value].join(";"));
  return [head, ...lines].join("\n");
}

export function ResultView({ r, title }: { r: Result; title?: string }) {
  const [view, setView] = useState<"table" | "bar" | "line">(r.viz);
  useEffect(() => setView(r.viz), [r]);
  const canChart = r.groupBy.length === 1 && r.rows.length > 0;
  const download = () => {
    const blob = new Blob(["﻿" + csvOf(r)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bi-${r.metric}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-black">{title ?? r.label} <span className="font-normal text-xs">({r.unit})</span></h3>
        <div className="flex gap-1 text-xs">
          {canChart && (["bar", "line", "table"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`rounded-lg border px-2 py-1 text-black ${view === v ? "bg-roxo-100 border-roxo font-semibold" : "border-linha bg-white"}`}>
              {v === "bar" ? "Barras" : v === "line" ? "Linha" : "Tabela"}
            </button>
          ))}
          <button type="button" onClick={download} className="inline-flex items-center gap-1 rounded-lg border border-linha bg-white px-2 py-1 text-black">
            <Download className="h-3 w-3" /> CSV
          </button>
        </div>
      </div>
      {canChart && view === "bar" && <Bars rows={r.rows} />}
      {canChart && view === "line" && <Line rows={r.rows} />}
      {(!canChart || view === "table") && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-black">
            <thead>
              <tr className="text-left text-xs border-b border-linha">
                {r.groupLabels.map((g) => <th key={g} className="py-1.5 pr-3">{g}</th>)}
                <th className="py-1.5">{r.groupLabels.length ? "Valor" : r.label}</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((x, i) => (
                <tr key={i} className="border-b border-linha">
                  {r.groupBy.map((d) => <td key={d} className="py-1.5 pr-3">{x.dims[d]}</td>)}
                  <td className="py-1.5 font-semibold">{fmt(x.value)}{x.n != null && <span className="ml-1 text-[11px] font-normal">(n={x.n})</span>}</td>
                </tr>
              ))}
              {r.rows.length === 0 && <tr><td className="py-4 text-center" colSpan={r.groupBy.length + 1}>Nenhum dado para esse recorte.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {r.total != null && <p className="text-xs text-black">Total: <strong>{fmt(r.total)}</strong></p>}
      {r.notes.map((n) => <p key={n} className="text-xs text-neutral-800">{n}</p>)}
    </div>
  );
}

