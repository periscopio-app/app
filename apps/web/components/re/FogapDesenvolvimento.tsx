"use client";

import {
  FAIXAS_FOGAP,
  alternarResposta,
  itensDaFaixa,
  type FaixaFogap,
  type OpcaoDesenvolvimento,
} from "@periscopio/shared";

export type RespostasDesenvolvimento = Record<string, OpcaoDesenvolvimento | null>;

interface Props {
  /** Faixa em uso (a da idade, ou a que a RE escolheu). */
  faixa: FaixaFogap;
  /** Faixa que a idade do aluno sugere, só para avisar quando a RE escolhe a outra. */
  faixaSugerida: FaixaFogap | null;
  respostas: RespostasDesenvolvimento;
  readOnly: boolean;
  onFaixa: (f: FaixaFogap) => void;
  onResponder: (id: string, valor: OpcaoDesenvolvimento | null) => void;
}

/**
 * FOGAP — desenvolvimento por faixa de idade. Duas caixas por item (Adequada / Inadequada), só uma marcada;
 * clicar na marcada desmarca. Item em branco continua em branco: nunca vira "Inadequada".
 * A tela mostra só o andamento (respondidas/total). O FOGAP não tem nota, então não há total de "Inadequadas".
 */
export function FogapDesenvolvimento({ faixa, faixaSugerida, respostas, readOnly, onFaixa, onResponder }: Props) {
  const itens = itensDaFaixa(faixa);
  const respondidas = itens.filter((i) => respostas[i.id]).length;

  return (
    <fieldset className="space-y-4 rounded-2xl border border-linha bg-white p-4 shadow-suave sm:p-5" data-testid="fogap-desenvolvimento">
      <legend className="px-1 text-sm font-bold text-black">FOGAP — desenvolvimento do aluno</legend>
      <p className="text-xs text-neutral-800">
        {readOnly
          ? "Respostas do RE, item a item (somente leitura). A opção marcada aparece em roxo, com ✓. Item sem marca é item que o RE deixou em branco."
          : "Escolha a faixa de idade e marque, item a item, o que o professor observa. Pode deixar itens em branco. O médico que receber o caso vê estas marcas, em somente leitura."}
      </p>

      <div role="radiogroup" aria-label="Faixa de idade do FOGAP" className="flex flex-wrap gap-2">
        {FAIXAS_FOGAP.map((f) => {
          const ativo = f.id === faixa;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={readOnly}
              onClick={() => onFaixa(f.id)}
              data-testid={`fogap-faixa-${f.id}`}
              className={`min-h-[44px] rounded-xl border px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${
                ativo ? "border-roxo bg-roxo text-white" : "border-linha bg-white text-black hover:bg-roxo-50 disabled:opacity-60"
              }`}
            >
              {f.rotulo}
            </button>
          );
        })}
      </div>

      {faixaSugerida && faixaSugerida !== faixa && (
        <p className="rounded-xl border border-linha bg-fundo p-3 text-xs text-neutral-800" role="status">
          Pela idade do aluno, a faixa sugerida é <strong>{FAIXAS_FOGAP.find((f) => f.id === faixaSugerida)?.rotulo}</strong>. Você escolheu outra; as respostas da faixa sugerida ficam guardadas.
        </p>
      )}

      <p className="text-xs font-semibold text-neutral-800" aria-live="polite" data-testid="fogap-progresso">
        {respondidas} de {itens.length} itens respondidos
      </p>

      <ul className="divide-y divide-linha rounded-xl border border-linha">
        {itens.map((item) => {
          const atual = respostas[item.id] ?? null;
          return (
            <li key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-black">
                <span className="mr-2 font-mono text-xs text-neutral-700">{item.n}</span>
                {item.texto}
                {readOnly && !atual && <span className="ml-2 rounded-full bg-fundo px-2 py-0.5 text-[10px] font-semibold text-neutral-700">em branco</span>}
              </span>
              <div role="group" aria-label={`Resposta do item ${item.n}`} className="flex shrink-0 gap-2">
                {(
                  [
                    ["adequada", "Adequada"],
                    ["inadequada", "Inadequada"],
                  ] as const
                ).map(([valor, rotulo]) => {
                  const marcado = atual === valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={marcado}
                      disabled={readOnly}
                      onClick={() => onResponder(item.id, alternarResposta<OpcaoDesenvolvimento>(atual, valor))}
                      data-testid={`fogap-${item.id}-${valor}`}
                      className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${
                        marcado ? "border-roxo bg-roxo text-white" : readOnly ? "border-linha bg-white text-neutral-600 opacity-60" : "border-linha bg-white text-black hover:bg-roxo-50"
                      }`}
                    >
                      {marcado && readOnly ? `✓ ${rotulo}` : rotulo}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
