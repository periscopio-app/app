"use client";

import { useEffect, useState } from "react";

const SPECIALTIES: Record<string, string> = {
  psicopedagogia: "Psicopedagogia",
  medicina: "Medicina",
  fonoaudiologia: "Fonoaudiologia",
  psicologia: "Psicologia",
  neuropsicologia: "Neuropsicologia",
  psicomotricidade: "Psicomotricidade",
  servico_social: "Serviço Social",
};

interface InviteInfo {
  email: string;
  specialty: string | null;
  school: { name: string } | null;
}

export default function ConvitePage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) {
      setError("Link de convite incompleto. Use o link recebido por e-mail.");
      setLoading(false);
      return;
    }
    fetch(`/api/onboarding/validate-invite?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.valid || data.type !== "professional") {
          setError(data.error || "Convite inválido ou expirado.");
        } else {
          setInvite(data);
        }
      })
      .catch(() => setError("Não foi possível validar o convite agora."))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível criar a senha.");
      } else {
        window.location.href = "/login?convite=confirmado";
      }
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div style={{ color: "var(--text-muted)" }}>Validando convite...</div>
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
          <h1>Criar sua senha</h1>
          {invite && (
            <p>
              A escola <strong>{invite.school?.name}</strong> cadastrou você
              {invite.specialty ? (
                <>
                  {" "}
                  em <strong>{SPECIALTIES[invite.specialty] ?? invite.specialty}</strong>
                </>
              ) : null}
              . Crie a senha para liberar o seu acesso.
            </p>
          )}
        </div>

        {error && (
          <div className="alert-box alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {invite && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">E-mail</label>
              <input id="email" type="email" className="form-input" value={invite.email} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
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
              <input
                id="confirm"
                type="password"
                className="form-input"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Salvando..." : "Criar senha e liberar acesso"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
