import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Cartão padrão dos blocos de proteção de dados do prontuário (consentimento, cofre de identidade).
 * Mesma estrutura nos dois, em qualquer largura: título e selos em cima, texto de apoio, conteúdo e ações embaixo.
 * Nada fica em linha única: selos e botões quebram para a linha seguinte em vez de estourar a caixa.
 */
export function CartaoProtecao({
  id,
  icone,
  titulo,
  selos,
  descricao,
  acoes,
  children,
  className,
}: {
  id?: string;
  /** Ícone já com o tamanho (use `h-5 w-5`). */
  icone: ReactNode;
  titulo: string;
  /** Selos de estado (componente Badge). Ficam abaixo do título. */
  selos?: ReactNode;
  descricao?: ReactNode;
  /** Botões. Ficam no rodapé, alinhados entre os cartões vizinhos. */
  acoes?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-label={titulo}
      className={cn("flex h-full min-w-0 scroll-mt-24 flex-col gap-4 rounded-2xl border border-linha bg-white p-4 shadow-suave sm:p-5", className)}
    >
      <header className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-roxo-100 bg-roxo-50 text-roxo">
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-snug text-black [text-wrap:balance]">{titulo}</h3>
          {selos && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{selos}</div>}
          {descricao && <p className="mt-2 text-xs leading-relaxed text-neutral-700">{descricao}</p>}
        </div>
      </header>

      {children}

      {acoes && <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:flex-wrap [&>*]:whitespace-nowrap">{acoes}</div>}
    </section>
  );
}
