"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Network } from "lucide-react";
import { api, ApiError } from "@/lib/api";

interface Grupo { id: number; name: string; size: number; top: { l: string; f: string; d: number }[]; files: string[] }
interface Mapa { nodes: number; links: number; communities: number; shown: number; commit: string; geradoEm: string; groups: Grupo[]; edges: [number, number, number][] }

const R = 210;
const R0 = 178;
const GAP = 0.012;
const ponto = (ang: number, r: number): [number, number] => [Math.cos(ang) * r, Math.sin(ang) * r];

/** Mapa técnico do código. Só o Administrador Master chega aqui (a API recusa os demais). Não mostra dado de aluno. */
export default function MapaDoSistemaPage() {
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<Mapa>("/api/admin/system-map")
      .then((m) => {
        setMapa(m);
        setSel(m.groups[1]?.id ?? m.groups[0]?.id ?? null);
      })
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o mapa."));
  }, []);

  const arcos = useMemo(() => {
    if (!mapa) return [];
    const total = mapa.groups.reduce((a, g) => a + g.size, 0);
    let a = -Math.PI / 2;
    return mapa.groups.map((g, i) => {
      const span = (g.size / total) * (2 * Math.PI - GAP * mapa.groups.length);
      const arco = { g, a0: a, a1: a + span, m: a + span / 2, hue: (i * 37) % 360 };
      a += span + GAP;
      return arco;
    });
  }, [mapa]);

  const porId = useMemo(() => new Map(arcos.map((x) => [x.g.id, x])), [arcos]);
  const atual = sel !== null ? porId.get(sel)?.g ?? null : null;
  const vizinhos = useMemo(() => {
    const s = new Set<number>();
    if (!mapa || sel === null) return s;
    for (const [x, y] of mapa.edges) {
      if (x === sel) s.add(y);
      if (y === sel) s.add(x);
    }
    return s;
  }, [mapa, sel]);
  const ligacoes = useMemo(() => {
    if (!mapa || sel === null) return [];
    return mapa.edges
      .filter(([x, y]) => x === sel || y === sel)
      .map(([x, y, w]) => ({ id: x === sel ? y : x, w }))
      .sort((p, q) => q.w - p.w)
      .slice(0, 6);
  }, [mapa, sel]);
  const maxPeso = mapa ? Math.max(1, ...mapa.edges.map((e) => e[2])) : 1;

  return (
    <div className="min-h-screen bg-[#F6F9FB] p-4 font-sans text-black sm:p-6 md:p-10">
      <div className="mx-auto max-w-[1180px]">
        <Link href="/admin/saude" className="inline-flex w-fit items-center gap-1.5 text-xs text-slate-600 hover:text-black">
          <ArrowLeft className="h-3.5 w-3.5" /> Saúde do sistema
        </Link>
        <h1 className="mt-3 flex items-center gap-2 font-display text-2xl font-bold">
          <Network className="h-6 w-6" aria-hidden /> Mapa do sistema
        </h1>
        <p className="mt-1 max-w-[62ch] text-sm text-slate-600">
          Informação técnica de orientação para o Administrador Master. Cada fatia é uma área do código (telas, rotas, serviços, catálogos, testes) e cada linha mostra as chamadas entre duas áreas. Não contém dado de aluno.
        </p>

        {erro && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        {!mapa && !erro && <p className="mt-6 text-sm text-slate-600">Carregando…</p>}

        {mapa && (
          <>
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-slate-600">
              <span><b className="font-normal text-black">{mapa.nodes.toLocaleString("pt-BR")}</b> itens de código</span>
              <span><b className="font-normal text-black">{mapa.links.toLocaleString("pt-BR")}</b> ligações</span>
              <span><b className="font-normal text-black">{mapa.communities}</b> áreas ({mapa.groups.length} maiores no anel)</span>
              <span>gerado em <b className="font-normal text-black">{mapa.geradoEm}</b>, versão <b className="font-normal text-black">{mapa.commit || "local"}</b></span>
            </p>

            <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="rounded-xl border border-[#E1E9ED] bg-white p-2">
                <svg viewBox="-360 -245 720 490" className="block h-auto w-full" role="img" aria-label="Anel com as maiores áreas do código e as ligações entre elas">
                  <g>
                    {mapa.edges.map(([x, y, w]) => {
                      const A = porId.get(x);
                      const B = porId.get(y);
                      if (!A || !B) return null;
                      const [x1, y1] = ponto(A.m, R0 - 2);
                      const [x2, y2] = ponto(B.m, R0 - 2);
                      const on = sel !== null && (x === sel || y === sel);
                      return (
                        <path
                          key={`${x}-${y}`}
                          d={`M${x1} ${y1}Q0 0 ${x2} ${y2}`}
                          fill="none"
                          stroke="#1f6f78"
                          strokeWidth={0.6 + (w / maxPeso) * 5}
                          opacity={on ? 0.75 : sel !== null ? 0.03 : 0.16}
                        />
                      );
                    })}
                  </g>
                  {arcos.map(({ g, a0, a1, m, hue }) => {
                    const [x0, y0] = ponto(a0, R);
                    const [x1, y1] = ponto(a1, R);
                    const [x2, y2] = ponto(a1, R0);
                    const [x3, y3] = ponto(a0, R0);
                    const grande = a1 - a0 > Math.PI ? 1 : 0;
                    const [lx, ly] = ponto(m, R + 8);
                    const dir = Math.cos(m) >= 0;
                    const apagado = sel !== null && g.id !== sel && !vizinhos.has(g.id);
                    return (
                      <g
                        key={g.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${g.name}, ${g.size} itens`}
                        className="cursor-pointer outline-none"
                        opacity={apagado ? 0.25 : 1}
                        onClick={() => setSel(g.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(g.id); } }}
                      >
                        <path
                          d={`M${x0} ${y0}A${R} ${R} 0 ${grande} 1 ${x1} ${y1}L${x2} ${y2}A${R0} ${R0} 0 ${grande} 0 ${x3} ${y3}Z`}
                          fill={`hsl(${hue} 38% 46%)`}
                          stroke={g.id === sel ? "#000" : "#fff"}
                          strokeWidth={g.id === sel ? 2 : 1}
                        />
                        <text x={lx} y={ly + 3} textAnchor={dir ? "start" : "end"} className="hidden fill-black text-[10.5px] font-medium sm:block" pointerEvents="none">
                          {g.name.length > 24 ? `${g.name.slice(0, 23)}…` : g.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="min-w-0 rounded-xl border border-[#E1E9ED] bg-white p-4">
                <label htmlFor="area" className="text-xs text-slate-600">Área</label>
                <select
                  id="area"
                  value={sel ?? ""}
                  onChange={(e) => setSel(Number(e.target.value))}
                  className="mb-3 mt-1 w-full rounded-lg border border-[#E1E9ED] bg-white px-3 py-2 text-sm"
                >
                  {mapa.groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                {atual && (
                  <div aria-live="polite">
                    <h2 className="font-display text-lg font-bold">{atual.name}</h2>
                    <p className="text-xs text-slate-600">{atual.size} itens de código</p>
                    <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Itens mais ligados</h3>
                    <ul className="grid gap-2">
                      {atual.top.map((t) => (
                        <li key={`${t.f}:${t.l}`} className="flex min-w-0 justify-between gap-3 text-sm">
                          <span className="min-w-0 break-words font-medium">{t.l}<br /><code className="font-mono text-xs text-slate-500">{t.f}</code></span>
                          <span className="flex-none font-mono text-xs text-[#1f6f78]">{t.d}</span>
                        </li>
                      ))}
                    </ul>
                    <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Arquivos principais</h3>
                    {atual.files.map((f) => (
                      <code key={f} className="block break-all font-mono text-xs text-slate-600">{f}</code>
                    ))}
                    <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mais conectada a</h3>
                    {ligacoes.length === 0 ? (
                      <p className="text-sm text-slate-600">Sem ligações fortes com as outras áreas do anel.</p>
                    ) : (
                      ligacoes.map((l) => (
                        <button key={l.id} type="button" onClick={() => setSel(l.id)} className="flex w-full items-center gap-2 border-b border-[#E1E9ED] py-1.5 text-left text-sm hover:text-[#1f6f78]">
                          {porId.get(l.id)?.g.name}
                          <span className="ml-auto font-mono text-xs text-slate-500">{l.w}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-5 max-w-[70ch] text-xs text-slate-600">
              Gerado só da estrutura do código (sem leitura de texto por IA). O número ao lado de cada item é a quantidade de ligações dele no grafo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
