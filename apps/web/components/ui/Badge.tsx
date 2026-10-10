import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Estados do caso — máquina de estados com tonalidades claras e fluidas (sem verde escuro) */
export const estadosCaso = {
  rascunho: "bg-slate-100 text-slate-700 border border-slate-200/80",
  enviado: "bg-sky-50 text-sky-800 border border-sky-200/80",
  revisao: "bg-amber-50 text-amber-900 border border-amber-200/80",
  delegado: "bg-purple-50 text-purple-800 border border-purple-200/80",
  retorno: "bg-orange-50 text-orange-900 border border-orange-200/80",
  encerrado: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
} as const;

export type EstadoCaso = keyof typeof estadosCaso;

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

const variants: Record<BadgeVariant, string> = {
  default: "bg-purple-50 text-purple-800 border border-purple-200/80",
  secondary: "bg-slate-100 text-slate-800 border border-slate-200/80",
  destructive: "bg-rose-50 text-rose-800 border border-rose-200/80",
  outline: "bg-white text-slate-800 border border-slate-300",
  success: "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
  warning: "bg-amber-50 text-amber-900 border border-amber-200/80",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  estado?: EstadoCaso;
  variant?: BadgeVariant;
  children?: ReactNode;
}

export function Badge({ estado, variant, className, children, ...props }: BadgeProps) {
  const colorClass = estado
    ? estadosCaso[estado] ?? estadosCaso.rascunho
    : variant
    ? variants[variant] ?? variants.default
    : variants.default;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
        colorClass,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
