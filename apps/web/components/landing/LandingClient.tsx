"use client";

import { useEffect } from "react";
import "./landing.css";

export default function LandingClient({ html }: { html: string }) {
  useEffect(() => {
    const root = document.getElementById("piloto-root");
    if (!root) return;
    const btn = root.querySelector<HTMLButtonElement>("#theme");
    const tipo = root.querySelector<HTMLSelectElement>("#tipo");
    const form = root.querySelector<HTMLFormElement>("#form");
    const ok = root.querySelector<HTMLElement>("#ok");
    const cleanups: Array<() => void> = [];

    const onTheme = () => {
      const cur = root.getAttribute("data-theme");
      const dark = cur === "dark" || (!cur && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.setAttribute("data-theme", dark ? "light" : "dark");
    };
    btn?.addEventListener("click", onTheme);
    cleanups.push(() => btn?.removeEventListener("click", onTheme));

    root.querySelectorAll<HTMLElement>("[data-perfil]").forEach((a) => {
      const h = () => { if (tipo) tipo.value = a.getAttribute("data-perfil") ?? ""; };
      a.addEventListener("click", h);
      cleanups.push(() => a.removeEventListener("click", h));
    });

    const onSubmit = (e: Event) => {
      e.preventDefault();
      const bad = ["nome", "email", "org"].some((id) => {
        const el = root.querySelector<HTMLInputElement>("#" + id);
        return !el || !el.value.trim();
      });
      if (!ok) return;
      ok.textContent = bad
        ? "Preencha nome, e-mail e instituição para enviar."
        : "Protótipo: no site publicado, este botão envia o seu pedido para a equipe do Periscópio.";
      ok.className = "ok on";
    };
    form?.addEventListener("submit", onSubmit);
    cleanups.push(() => form?.removeEventListener("submit", onSubmit));

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div
      id="piloto-root"
      className="piloto"
      // Conteúdo estático escrito pela equipe; não recebe entrada de usuário.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
