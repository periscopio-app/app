"use client";

import { useState } from "react";
import Link from "next/link";

export default function PrimeiroAcessoPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Não foi possível enviar agora. Tente novamente.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-header">
          <div className="brand-badge">
            <span className="pulse"></span>
            Periscópio Saúde
          </div>
          <h1>Primeiro acesso ou nova senha</h1>
          <p>Informe o e-mail cadastrado e enviaremos um link para você escolher a sua senha.</p>
        </div>

        {error && (
          <div className="alert-box alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {sent ? (
          <div className="alert-box alert-success">
            <span>✓</span>
            <span>
              Se este e-mail estiver cadastrado, o link chegará em instantes. Confira também a
              caixa de spam. O link vale por 1 hora.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                E-mail cadastrado
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                autoComplete="email"
                placeholder="seu.email@municipio.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <Link href="/login">Voltar para a entrada</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
