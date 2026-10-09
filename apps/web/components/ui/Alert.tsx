import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tons = {
  info: "border-ceu-100 bg-ceu-50 text-black",
  ok: "border-[#CFE8DB] bg-[#EAF6F0] text-[#1E5A41]",
  atencao: "border-ouro-100 bg-ouro-50 text-black",
  erro: "border-erro/20 bg-[#FDECEA] text-black",
} as const;

export function Alert({
  tom = "info",
  children,
}: {
  tom?: keyof typeof tons;
  children: ReactNode;
}) {
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={cn("rounded-2xl border px-4 py-3.5 text-sm leading-relaxed", tons[tom])}
    >
      {children}
    </div>
  );
}
