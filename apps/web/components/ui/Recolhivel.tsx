"use client";

import { useEffect, useId, useState, type HTMLAttributes, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type SectionAttrs = Omit<HTMLAttributes<HTMLElement>, "title" | "children" | "id"> & { [data: `data-${string}`]: string | undefined };

type Props = {
  titulo: ReactNode;
  /** Texto curto que continua visível com o bloco fechado. */
  resumo?: ReactNode;
  icone?: ReactNode;
  /** Etiqueta de estado à direita (ex.: "Completo"). */
  direita?: ReactNode;
  /** Modo controlado. Sem isto, o bloco guarda o próprio estado. */
  aberto?: boolean;
  onAbertoChange?: (aberto: boolean) => void;
  abertoInicial?: boolean;
  /** Se informado, lembra neste navegador se o bloco estava aberto ou fechado. */
  memoriaKey?: string;
  id?: string;
  idTitulo?: string;
  nivel?: 2 | 3;
  /** Classes do contêiner (moldura) e do corpo. */
  className?: string;
  classNameCorpo?: string;
  sectionProps?: SectionAttrs;
  children: ReactNode;
};

const PREFIXO = "periscopio:bloco:";

function lerMemoria(chave?: string): boolean | null {
  if (!chave) return null;
  try {
    const v = window.localStorage.getItem(PREFIXO + chave);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

function gravarMemoria(chave: string | undefined, aberto: boolean) {
  if (!chave) return;
  try {
    window.localStorage.setItem(PREFIXO + chave, aberto ? "1" : "0");
  } catch {
    /* navegação privativa ou armazenamento bloqueado: segue sem lembrar */
  }
}

/**
 * Bloco que abre e fecha na vertical. O cabeçalho inteiro é o botão (alvo de toque grande, texto legível, foco visível).
 * O conteúdo continua montado quando fechado (só fica oculto), então nada digitado dentro se perde ao recolher.
 */
export function Recolhivel({
  titulo,
  resumo,
  icone,
  direita,
  aberto: abertoControlado,
  onAbertoChange,
  abertoInicial = true,
  memoriaKey,
  id,
  idTitulo,
  nivel = 2,
  className,
  classNameCorpo,
  sectionProps,
  children,
}: Props) {
  const gerado = useId();
  const tituloId = idTitulo ?? `${gerado}-t`;
  const corpoId = `${gerado}-c`;
  const [interno, setInterno] = useState(abertoInicial);
  const controlado = abertoControlado !== undefined;
  const aberto = controlado ? abertoControlado : interno;

  useEffect(() => {
    if (controlado) return;
    const guardado = lerMemoria(memoriaKey);
    if (guardado !== null) setInterno(guardado);
  }, [controlado, memoriaKey]);

  const alternar = () => {
    const proximo = !aberto;
    if (!controlado) setInterno(proximo);
    gravarMemoria(memoriaKey, proximo);
    onAbertoChange?.(proximo);
  };

  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <section id={id} aria-labelledby={tituloId} className={cn("rounded-2xl border border-linha bg-white shadow-suave", className)} {...sectionProps}>
      <Titulo id={tituloId} className="m-0">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          aria-controls={corpoId}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none transition hover:bg-roxo-50 focus-visible:ring-2 focus-visible:ring-roxo"
        >
          {icone && <span className="shrink-0 text-black" aria-hidden>{icone}</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-snug text-black">{titulo}</span>
            {resumo && <span className="mt-0.5 block text-sm font-normal text-neutral-800">{resumo}</span>}
          </span>
          {direita && <span className="shrink-0">{direita}</span>}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-linha bg-white" aria-hidden>
            <ChevronDown className={cn("h-5 w-5 text-black transition-transform", aberto && "rotate-180")} />
          </span>
        </button>
      </Titulo>
      <div id={corpoId} role="region" aria-labelledby={tituloId} hidden={!aberto} className={cn("border-t border-linha px-4 pb-4 pt-4", classNameCorpo)}>
        {children}
      </div>
    </section>
  );
}
