"use client";

import { useState } from "react";

interface FormState {
  status: "idle" | "loading" | "success" | "error";
  message: string;
}

export function InterestForm() {
  const [state, setState] = useState<FormState>({ status: "idle", message: "" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "loading", message: "" });

    const form = e.currentTarget;
    const data = {
      nome: (form.elements.namedItem("nome") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      escola: (form.elements.namedItem("escola") as HTMLInputElement).value,
      cargo: (form.elements.namedItem("cargo") as HTMLSelectElement).value,
    };

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const res = await fetch(`${apiUrl}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Erro ao enviar");
      }

      setState({ status: "success", message: "Recebemos seu interesse! Entraremos em contato em breve." });
      form.reset();
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Erro inesperado. Tente novamente.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="interest-form">
      <h3 className="form-title">Quero conhecer o piloto</h3>
      <p className="form-subtitle">Sua escola pode ser uma das primeiras a transformar o cuidado em saúde mental.</p>

      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="nome">Nome completo</label>
          <input id="nome" name="nome" type="text" placeholder="Ana Silva" required />
        </div>

        <div className="form-group">
          <label htmlFor="email">E-mail institucional</label>
          <input id="email" name="email" type="email" placeholder="ana@escola.edu.br" required />
        </div>

        <div className="form-group">
          <label htmlFor="escola">Escola ou município</label>
          <input id="escola" name="escola" type="text" placeholder="EMEF João XXIII — São Paulo/SP" required />
        </div>

        <div className="form-group">
          <label htmlFor="cargo">Seu papel</label>
          <select id="cargo" name="cargo" required>
            <option value="">Selecione...</option>
            <option value="gestor_escolar">Gestor(a) escolar</option>
            <option value="secretaria_educacao">Secretaria de Educação</option>
            <option value="professor">Professor(a)</option>
            <option value="psicologo">Psicólogo(a) / PpI</option>
            <option value="medico">Médico(a) / MD1</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>

      {state.status === "success" && (
        <div className="form-feedback success">{state.message}</div>
      )}
      {state.status === "error" && (
        <div className="form-feedback error">{state.message}</div>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={state.status === "loading"}
        style={{ width: "100%", marginTop: "8px" }}
      >
        {state.status === "loading" ? "Enviando..." : "Quero participar do piloto →"}
      </button>

      <p className="form-lgpd">
        🔒 Seus dados são usados apenas para contato. Conformidade LGPD garantida.
      </p>
    </form>
  );
}
