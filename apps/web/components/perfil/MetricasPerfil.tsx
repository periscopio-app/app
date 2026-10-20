"use client";

import { Info } from "lucide-react";
import type { CartaoMetrica, MetricasPerfil as Metricas, TabelaMetrica } from "@/lib/perfil";
import { Alert, Card } from "@/components/ui";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function valorDoCartao(c: CartaoMetrica): string {
  if (c.oculto) return "< 5";
  if (c.valor === null) return "—";
  return nf.format(c.valor);
}

function CartaoView({ c }: { c: CartaoMetrica }) {
  const semDado = c.valor === null && !c.oculto;
  return (
    <li className="rounded-2xl border border-linha bg-white p-4">
      <p className="text-xs font-semibold text-neutral-800">{c.rotulo}</p>
      <p className="mt-1 flex items-baseline gap-1.5 text-black">
        <span className="text-3xl font-bold tabular-nums">{valorDoCartao(c)}</span>
        {c.unidade && !semDado && !c.oculto && <span className="text-sm text-neutral-800">{c.unidade}</span>}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-neutral-800">
        {c.oculto ? "Grupo pequeno: o número fica oculto para proteger os alunos. " : ""}
        {semDado ? "Ainda sem dados suficientes. " : ""}
        {c.ajuda}
      </p>
    </li>
  );
}

function TabelaView({ t }: { t: TabelaMetrica }) {
  if (t.linhas.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-linha bg-white">
      <table className="w-full text-sm">
        <caption className="px-4 pt-3 text-left text-sm font-bold text-black">{t.titulo}</caption>
        <thead>
          <tr className="border-b border-linha text-left text-xs text-neutral-800">
            {t.colunas.map((col) => (
              <th key={col} scope="col" className="px-4 py-2 font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.linhas.map((linha, i) => (
            <tr key={i} className="border-b border-linha/60 last:border-0">
              {linha.map((cel, j) => (
                <td key={j} className={`px-4 py-2 text-black ${j > 0 ? "tabular-nums" : ""}`}>
                  {cel === null || cel === undefined ? "—" : typeof cel === "number" ? nf.format(cel) : cel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetricasPerfil({ metricas }: { metricas: Metricas }) {
  return (
    <Card className="space-y-5 p-6 md:p-8">
      <div>
        <h2 className="text-xl font-bold text-black">{metricas.titulo}</h2>
        <p className="mt-1 text-sm text-neutral-800">{metricas.descricao}</p>
      </div>

      {metricas.cartoes.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicadores do seu trabalho">
          {metricas.cartoes.map((c) => (
            <CartaoView key={c.chave} c={c} />
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {metricas.tabelas.map((t) => (
          <TabelaView key={t.chave} t={t} />
        ))}
      </div>

      <Alert tom="info">
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{metricas.aviso}</span>
        </span>
      </Alert>
    </Card>
  );
}
