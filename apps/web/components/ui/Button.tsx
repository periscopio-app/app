import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Botão único do sistema. Mesma forma, mesmo foco e mesmo estado desabilitado em todos os painéis;
 * muda só a cor (variante) e o tamanho. Alvo de toque mínimo de 36 px no `sm` e 40 px no `md`.
 */
const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-[14px] font-semibold transition " +
  "duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roxo focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-linha disabled:text-neutral-700 disabled:shadow-none";

const variants = {
  primary: "bg-roxo-100 border border-roxo text-black shadow-sm hover:bg-roxo-200 hover:shadow-suave",
  secondary: "bg-ceu-100 border border-ceu-700 text-black shadow-sm hover:bg-ceu-300 hover:shadow-suave",
  outline: "border-[1.5px] border-roxo bg-white text-black hover:bg-roxo-50",
  ghost: "border border-transparent text-black hover:bg-ceu-50",
  warning: "bg-ouro-50 border border-ouro text-black shadow-sm hover:bg-ouro-100",
  danger: "bg-[#FDECEA] border border-erro text-black hover:bg-[#F9D5D1]",
} as const;

const sizes = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

/** Mesmas classes do Button para elementos que não podem ser <button> (links, rótulos de input de arquivo). */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string): string {
  return cn(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "lg",
  loading = false,
  fullWidth = false,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra o indicador de carregamento e bloqueia novos cliques. */
  loading?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
