import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Estados do caso — mesma máquina de estados do backend (rascunho → encerrado). */
const estados = {
  rascunho: "bg-linha text-tinta-700",
  enviado: "bg-ceu-100 text-ceu-800",
  revisao: "bg-ouro-100 text-ouro-800",
  delegado: "bg-roxo-100 text-roxo-800",
  retorno: "bg-comunidade-100 text-comunidade-700",
  encerrado: "bg-[#DFF1E8] text-[#1E5A41]",
} as const;

export type EstadoCaso = keyof typeof estados;

export function Badge({ estado, children }: { estado: EstadoCaso; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        estados[estado],
      )}
    >
      {children}
    </span>
  );
}
