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

    const toggleRawBtn = root.querySelector<HTMLButtonElement>("#toggle-pro-raw");
    const visualView = root.querySelector<HTMLElement>("#team-visual-view");
    const rawView = root.querySelector<HTMLElement>("#team-raw-view");
    const labelRaw = root.querySelector<HTMLElement>("#label-raw");
    const labelCards = root.querySelector<HTMLElement>("#label-cards");

    const onToggleRaw = () => {
      if (!visualView || !rawView) return;
      const isRaw = rawView.style.display !== "none";
      if (isRaw) {
        rawView.style.display = "none";
        visualView.style.display = "block";
        if (labelRaw) labelRaw.style.display = "inline";
        if (labelCards) labelCards.style.display = "none";
      } else {
        rawView.style.display = "block";
        visualView.style.display = "none";
        if (labelRaw) labelRaw.style.display = "none";
        if (labelCards) labelCards.style.display = "inline";
      }
    };
    toggleRawBtn?.addEventListener("click", onToggleRaw);
    cleanups.push(() => toggleRawBtn?.removeEventListener("click", onToggleRaw));

    root.querySelectorAll<HTMLElement>("[data-perfil]").forEach((a) => {
      const h = () => { if (tipo) tipo.value = a.getAttribute("data-perfil") ?? ""; };
      a.addEventListener("click", h);
      cleanups.push(() => a.removeEventListener("click", h));
    });

    const onSubmit = async (e: Event) => {
      e.preventDefault();
      const nomeInput = root.querySelector<HTMLInputElement>("#nome");
      const emailInput = root.querySelector<HTMLInputElement>("#email");
      const orgInput = root.querySelector<HTMLInputElement>("#org");
      const tipoSelect = root.querySelector<HTMLSelectElement>("#tipo");
      const msgTextarea = root.querySelector<HTMLTextAreaElement>("#msg");
      const submitBtn = root.querySelector<HTMLButtonElement>("button[type='submit']");

      const nome = nomeInput?.value.trim() ?? "";
      const email = emailInput?.value.trim() ?? "";
      const org = orgInput?.value.trim() ?? "";
      const tipoVal = tipoSelect?.value.trim() ?? "";
      const msg = msgTextarea?.value.trim() ?? "";

      if (!nome || !email || !org) {
        if (!ok) return;
        ok.textContent = "Por favor, preencha nome, e-mail e instituição para enviar.";
        ok.className = "ok on";
        ok.style.background = "var(--gold-soft)";
        ok.style.color = "var(--gold-ink)";
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Enviando...";
      }

      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome,
            email,
            instituicao: org,
            tipo: tipoVal,
            msg,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao processar envio.");
        }

        if (ok) {
          ok.textContent = "✅ Candidatura recebida com sucesso! A equipe do Periscópio entrará em contato em breve.";
          ok.className = "ok on";
          ok.style.background = "var(--ok-soft)";
          ok.style.color = "var(--ok-ink)";
        }
        form?.reset();
      } catch (err: any) {
        if (ok) {
          ok.textContent = err?.message || "Ocorreu um erro ao enviar. Tente novamente mais tarde.";
          ok.className = "ok on";
          ok.style.background = "#fee2e2";
          ok.style.color = "#991b1b";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Enviar candidatura";
        }
      }
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
