"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  GENOGRAMA_ANOTACAO_MAX,
  GENOGRAMA_VAZIO,
  GRUPOS_PARENTESCO,
  PARENTESCOS,
  adicionarMembro,
  atualizarMembro,
  disponibilidade,
  lerGenograma,
  removerMembro,
  rotulosNoDesenho,
  serializarGenograma,
  type Forma,
  type Genograma,
} from "@periscopio/shared";
import { GenogramaDesenho } from "./GenogramaDesenho";

const FORMAS: { id: Forma; rotulo: string }[] = [
  { id: "unknown", rotulo: "Símbolo neutro" },
  { id: "male", rotulo: "Quadrado" },
  { id: "female", rotulo: "Círculo" },
];

/**
 * Editor de genograma por parentesco. Não há campo de nome: o profissional escolhe o parentesco e o desenho aparece.
 * O valor é um texto curto (JSON) guardado no payload do formulário; vazio = sem desenho.
 */
export function GenogramaEditor({ value, onChange, disabled, idBase }: { value: string; onChange: (texto: string) => void; disabled?: boolean; idBase: string }) {
  const [g, setG] = useState<Genograma>(() => lerGenograma(value) ?? GENOGRAMA_VAZIO);

  // Quando o valor muda por fora (carregou do servidor, reabriu), acompanha.
  useEffect(() => {
    if (value !== serializarGenograma(g)) setG(lerGenograma(value) ?? GENOGRAMA_VAZIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const aplicar = (novo: Genograma) => {
    setG(novo);
    onChange(serializarGenograma(novo));
  };

  const rotulos = useMemo(() => rotulosNoDesenho(g.membros), [g.membros]);
  const temPais = g.membros.some((m) => m.parentesco === "mae") && g.membros.some((m) => m.parentesco === "pai");

  if (disabled) {
    return g.membros.length === 0 ? (
      <p className="text-xs text-neutral-800">Sem desenho registrado.</p>
    ) : (
      <GenogramaDesenho genograma={g} />
    );
  }

  return (
    <div className="space-y-3" data-testid="genograma-editor">
      <fieldset className="space-y-1">
        <legend className="text-xs font-semibold text-black">Figura do aluno(a)</legend>
        <div className="flex flex-wrap gap-2">
          {FORMAS.map((f) => (
            <label
              key={f.id}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-black ${
                g.aluno === f.id ? "border-roxo bg-roxo-100" : "border-linha bg-white hover:bg-fundo"
              }`}
            >
              <input type="radio" name={`${idBase}-aluno`} checked={g.aluno === f.id} onChange={() => aplicar({ ...g, aluno: f.id })} className="sr-only" />
              {f.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-black">Adicionar parente (escolha o parentesco)</p>
        {GRUPOS_PARENTESCO.map((grupo) => (
          <div key={grupo.id} className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-700">{grupo.titulo}</p>
            <div className="flex flex-wrap gap-1.5">
              {PARENTESCOS.filter((p) => p.grupo === grupo.id).map((p) => {
                const disp = disponibilidade(g, p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!disp.ok}
                    title={disp.ok ? undefined : disp.motivo}
                    onClick={() => aplicar(adicionarMembro(g, p.id))}
                    className="inline-flex items-center gap-1 rounded-lg border border-linha bg-white px-2.5 py-1.5 text-xs font-semibold text-black hover:bg-roxo-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white"
                  >
                    <Plus className="h-3 w-3" aria-hidden /> {p.rotulo}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-neutral-700">
          Avós e tios só liberam depois que a mãe ou o pai estiver no desenho. Meio-irmãos e padrasto/madrasta ainda não são desenhados: registre em texto.
        </p>
      </div>

      {temPais && (
        <label className="flex items-center gap-2 text-xs text-black">
          <input type="checkbox" checked={Boolean(g.paisSeparados)} onChange={(e) => aplicar({ ...g, paisSeparados: e.target.checked })} />
          Mãe e pai não vivem juntos (linha de união marcada como separada)
        </label>
      )}

      {g.membros.length > 0 ? (
        <>
          <GenogramaDesenho genograma={g} />
          <ul className="space-y-2" aria-label="Figuras do genograma">
            {g.membros.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-linha bg-white px-3 py-2">
                <span className="min-w-[8rem] text-xs font-semibold text-black">{rotulos.get(m.id)}</span>
                <label className="flex items-center gap-1.5 text-xs text-black">
                  <input type="checkbox" checked={Boolean(m.falecido)} onChange={(e) => aplicar(atualizarMembro(g, m.id, { falecido: e.target.checked }))} />
                  Falecido(a)
                </label>
                <input
                  aria-label={`Anotação sobre ${rotulos.get(m.id)} (sem nomes)`}
                  placeholder="Anotação curta, sem nomes (opcional)"
                  maxLength={GENOGRAMA_ANOTACAO_MAX}
                  value={m.anotacao ?? ""}
                  onChange={(e) => aplicar(atualizarMembro(g, m.id, { anotacao: e.target.value }))}
                  className="min-w-[10rem] flex-1 rounded-lg border border-linha px-2 py-1 text-xs text-black outline-none focus:ring-2 focus:ring-roxo/40"
                />
                <button
                  type="button"
                  onClick={() => aplicar(removerMembro(g, m.id))}
                  aria-label={`Remover ${rotulos.get(m.id)} do desenho`}
                  className="rounded-lg p-1.5 text-black hover:bg-fundo"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-neutral-700">Remover um avô, avó ou a mãe/o pai também retira do desenho quem dependia dessa figura (tios, avós).</p>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-linha px-3 py-4 text-center text-xs text-neutral-800">
          O desenho aparece aqui conforme você adiciona os parentescos.
        </p>
      )}
    </div>
  );
}
