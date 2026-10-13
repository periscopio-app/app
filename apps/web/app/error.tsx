"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Tela de erro amigável: substitui o "Application error" cru do navegador em qualquer página. */
export default function ErroDaPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Fica no console para o suporte; nada de dado do aluno entra aqui.
    console.error("Erro de tela:", error?.message, error?.digest ?? "");
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-[#F6F9FB] p-6" role="alert">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#E1E9ED] bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-black">Algo não saiu como esperado</h1>
        <p className="text-sm leading-relaxed text-neutral-800">
          Não foi possível abrir esta tela agora. Seus dados salvos estão preservados. Tente de novo; se o problema continuar, volte ao início e avise o suporte.
        </p>
        {error?.digest && <p className="text-[11px] text-neutral-600">Código para o suporte: {error.digest}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => reset()} className="rounded-xl bg-[#682880] px-4 py-2 text-xs font-bold text-white hover:bg-[#531e66]">
            Tentar de novo
          </button>
          <Link href="/" className="rounded-xl border border-[#E1E9ED] bg-[#F0F9FC] px-4 py-2 text-xs font-bold text-black hover:bg-[#E1E9ED]">
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
