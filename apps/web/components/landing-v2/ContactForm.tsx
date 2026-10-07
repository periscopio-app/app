"use client";

import { useState, type FormEvent } from "react";

const WHATSAPP_NUMBER = "5511984444994";

export function ContactForm() {
  const [erro, setErro] = useState("");

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") ?? "").trim().slice(0, 100);
    const instituicao = String(f.get("instituicao") ?? "").trim().slice(0, 150);
    const mensagem = String(f.get("mensagem") ?? "").trim().slice(0, 1000);
    if (!nome || !mensagem) {
      setErro("Preencha seu nome e a mensagem.");
      return;
    }
    setErro("");
    const texto = `Olá, gostaria de saber mais sobre o Projeto Periscópio! Sou ${nome}${instituicao ? ` (${instituicao})` : ""}.\n\n${mensagem}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  }

  const campo =
    "w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={enviar} className="space-y-3">
      <p className="text-sm">Campos com * são obrigatórios. Ao enviar, a mensagem abre pronta no seu WhatsApp.</p>
      <label className="block text-sm font-semibold">
        Nome *
        <input name="nome" required maxLength={100} placeholder="Seu nome" className={`${campo} mt-1 font-normal`} />
      </label>
      <label className="block text-sm font-semibold">
        Instituição ou município
        <input name="instituicao" maxLength={150} placeholder="Opcional" className={`${campo} mt-1 font-normal`} />
      </label>
      <label className="block text-sm font-semibold">
        Mensagem *
        <textarea
          name="mensagem"
          required
          maxLength={1000}
          rows={4}
          placeholder="Como gostaria de apoiar ou conhecer o programa?"
          className={`${campo} mt-1 font-normal`}
        />
      </label>
      {erro && <p className="text-sm font-medium text-erro">{erro}</p>}
      <button
        type="submit"
        className="w-full rounded-full bg-empatia px-6 py-3 font-semibold text-white shadow-lift transition hover:-translate-y-0.5"
      >
        Enviar pelo WhatsApp
      </button>
    </form>
  );
}
