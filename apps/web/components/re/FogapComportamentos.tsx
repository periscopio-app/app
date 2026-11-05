"use client";

import { FOGAP_COMPORTAMENTOS, alternarResposta, type OpcaoComportamento } from "@periscopio/shared";

export type RespostasComportamentos = Record<string, OpcaoComportamento | null>;

interface Props {
  respostas: RespostasComportamentos;
  readOnly: boolean;
  onResponder: (id: string, valor: OpcaoComportamento | null) => void;
}

/**
 * FOGAP — comportamentos. Duas caixas por item (Sim / Não), só uma marcada; clicar na marcada desmarca.
 * Item em branco continua em branco: nunca vira "Não". Todos precisam de resposta para enviar ao médico.
 * A tela mostra só o andamento (respondidos/total): o FOGAP não tem nota.
 */
export function FogapComportamentos({ respostas, readOnly, onResponder }: Props) {
  const respondidos = FOGAP_COMPORTAMENTOS.filter((c) => respostas[c.id]).length;

  return (
    <fieldset className="space-y-4 rounded-2xl border border-linha bg-white p-4 shadow-suave sm:p-5" data-testid="fogap-comportamentos">
      <legend className="px-1 text-sm font-bold text-black">FOGAP — comportamentos</legend>
      <p className="text-xs text-neutral-800">
        {readOnly
          ? "Respostas do RE, item a item (somente leitura). A opção marcada aparece em roxo, com ✓. Item sem marca é item que o RE deixou em branco."
          : "Marque Sim ou Não para cada comportamento que o professor relata. Para enviar ao médico, todos os itens precisam de resposta."}
      </p>

      <p className="text-xs font-semibold text-neutral-800" aria-live="polite" data-testid="fogap-comportamentos-progresso">
        {respondidos} de {FOGAP_COMPORTAMENTOS.length} itens respondidos
      </p>

      <ul className="divide-y divide-linha rounded-xl border border-linha">
        {FOGAP_COMPORTAMENTOS.map((item) => {
          const atual = respostas[item.id] ?? null;
          return (
            <li key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-black">
                <span className="mr-2 font-mono text-xs text-neutral-700">{item.n}</span>
                {item.texto}
                {readOnly && !atual && <span className="ml-2 rounded-full bg-fundo px-2 py-0.5 text-[10px] font-semibold text-neutral-700">em branco</span>}
              </span>
              <div role="group" aria-label={`Resposta do comportamento ${item.n}`} className="flex shrink-0 gap-2">
                {(
                  [
                    ["sim", "Sim"],
                    ["nao", "Não"],
                  ] as const
                ).map(([valor, rotulo]) => {
                  const marcado = atual === valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={marcado}
                      disabled={readOnly}
                      onClick={() => onResponder(item.id, alternarResposta<OpcaoComportamento>(atual, valor))}
                      data-testid={`fogap-${item.id}-${valor}`}
                      className={`min-h-[44px] min-w-[72px] rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${
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
