"use client";

import { useEffect, useState } from "react";

const NIVEIS = [
  { id: "normal", rotulo: "A", nome: "Texto normal", px: 16 },
  { id: "grande", rotulo: "A", nome: "Texto grande", px: 18 },
  { id: "muito-grande", rotulo: "A", nome: "Texto muito grande", px: 20 },
] as const;

const CHAVE = "periscopio:tamanho-texto";

function aplicar(px: number) {
  document.documentElement.style.fontSize = `${px}px`;
}

/**
 * Três tamanhos de letra para o sistema todo (as medidas em rem acompanham). Fica salvo neste navegador.
 * Não mexe em nenhum dado: é só leitura mais confortável para quem tem baixa visão ou lê de longe.
 */
export function TamanhoTexto({ className }: { className?: string }) {
  const [atual, setAtual] = useState<(typeof NIVEIS)[number]["id"]>("normal");

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE);
      const n = NIVEIS.find((x) => x.id === salvo);
      if (n) {
        setAtual(n.id);
        aplicar(n.px);
      }
    } catch {
      /* sem armazenamento: fica no padrão */
    }
  }, []);

  const escolher = (n: (typeof NIVEIS)[number]) => {
    setAtual(n.id);
    aplicar(n.px);
    try {
      window.localStorage.setItem(CHAVE, n.id);
    } catch {
      /* ignorar */
    }
  };

  return (
    <div role="group" aria-label="Tamanho do texto" className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span className="mr-1 text-sm font-semibold text-black">Texto</span>
      {NIVEIS.map((n, i) => (
        <button
          key={n.id}
          type="button"
          onClick={() => escolher(n)}
          aria-pressed={atual === n.id}
          aria-label={n.nome}
          title={n.nome}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border font-bold outline-none focus-visible:ring-2 focus-visible:ring-roxo ${atual === n.id ? "border-roxo bg-roxo text-white" : "border-linha bg-white text-black hover:bg-roxo-50"}`}
          style={{ fontSize: `${14 + i * 4}px` }}
        >
          {n.rotulo}
        </button>
      ))}
    </div>
  );
}
