"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MessageSquareText, X } from "lucide-react";

type Props = {
  /** Texto atual do comentário. */
  valor: string;
  onChange: (texto: string) => void;
  /** Sobre o que é o comentário (ex.: o texto da pergunta). Usado só para leitor de tela. */
  sobre: string;
  readOnly?: boolean;
  maxLength?: number;
};

/**
 * Comentário de uma pergunta, no estilo do comentário do Excel: um botão com texto ("Comentar" / "Ver comentário") abre uma
 * notinha ao lado da pergunta. Um triângulo vermelho no canto do botão avisa que já existe comentário. Salva a cada letra.
 */
export function ComentarioPopup({ valor, onChange, sobre, readOnly = false, maxLength = 1000 }: Props) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const dialogoId = useId();
  const tem = valor.trim().length > 0;

  useEffect(() => {
    if (!aberto) return;
    area.current?.focus();
    const fora = (e: MouseEvent | TouchEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  if (readOnly && !tem) return null;

  const rotuloBotao = readOnly ? "Ver comentário" : tem ? "Ver comentário" : "Comentar";
  return (
    <span ref={raiz} className="relative inline-block" data-comentario>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-controls={aberto ? dialogoId : undefined}
        aria-label={`${rotuloBotao}: ${sobre}`}
        className="relative inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-linha bg-white px-3 py-1.5 text-sm font-semibold text-black outline-none transition hover:bg-roxo-50 focus-visible:ring-2 focus-visible:ring-roxo"
      >
        <MessageSquareText className="h-4 w-4" aria-hidden />
        {rotuloBotao}
        {tem && <span aria-hidden className="absolute right-0 top-0 h-0 w-0 rounded-tr-lg border-l-[12px] border-t-[12px] border-l-transparent border-t-red-600" />}
      </button>
      {aberto && (
        <div
          id={dialogoId}
          role="dialog"
          aria-label={`Comentário: ${sobre}`}
          className="fixed inset-x-3 bottom-3 z-40 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-black">Comentário</p>
            <button type="button" onClick={() => { setAberto(false); botao.current?.focus(); }} aria-label="Fechar comentário" className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-black outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-roxo">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <textarea
            ref={area}
            rows={5}
            maxLength={maxLength}
            readOnly={readOnly}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Texto do comentário: ${sobre}`}
            placeholder="Escreva aqui o que observou sobre esta pergunta."
            className="w-full resize-y rounded-lg border border-amber-300 bg-white px-3 py-2 text-base text-black outline-none focus:ring-2 focus:ring-roxo/40"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-800" aria-live="polite">{readOnly ? "Somente leitura" : `${valor.length} de ${maxLength} · salva sozinho`}</span>
            <button type="button" onClick={() => { setAberto(false); botao.current?.focus(); }} className="min-h-[40px] rounded-lg bg-roxo px-4 text-sm font-bold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-roxo">
              Pronto
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
