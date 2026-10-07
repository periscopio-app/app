"use client";

import { PasswordInput } from "@/components/PasswordInput";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function RedefinirSenhaPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) {
      setError("Link incompleto. Use o link recebido por e-mail.");
      setLoading(false);
      return;
    }
    fetch(`/api/access/validate?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.valid) setError(data.error || "Link inválido ou expirado.");
        else setInfo({ email: data.email, name: data.name });
      })
      .catch(() => setError("Não foi possível validar o link agora."))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/access/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Não foi possível salvar a senha.");
      else window.location.href = "/login?convite=confirmado";
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div style={{ color: "var(--text-muted)" }}>Validando link...</div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-header">
          <div className="brand-badge">
            <span className="pulse"></span>
            Periscópio Saúde
          </div>
          <h1>Defina a sua senha</h1>
          {info && <p>Olá, {info.name}. Escolha a senha que você vai usar para entrar.</p>}
        </div>

        {error && (
          <div className="alert-box alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {info ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">E-mail</label>
              <input id="email" type="email" className="form-input" value={info.email} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Nova senha</label>
              <PasswordInput
                id="password"
                className="form-input"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm">Repita a senha</label>
              <PasswordInput
                id="confirm"
                className="form-input"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Salvando..." : "Salvar senha"}
            </button>
          </form>
        ) : (
          <div className="auth-footer">
            <p>
              <Link href="/primeiro-acesso">Pedir um novo link</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
