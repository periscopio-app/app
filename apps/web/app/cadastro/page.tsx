"use client";

import { PasswordInput } from "@/components/PasswordInput";
import Link from "next/link";
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

interface LinkInfo {
  role: string;
  specialty: string | null;
  tenantName: string | null;
  schoolName: string | null;
  email: string | null;
}

/** Cadastro por link unitário: o administrador envia o link, o profissional se cadastra sozinho. */
export default function CadastroPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [classCode, setClassCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    if (!t) {
      setError("Link de cadastro incompleto. Use o endereço inteiro que você recebeu.");
      setLoading(false);
      return;
    }
    fetch(`/api/onboarding/registration-link?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setError(data.error || "Link inválido ou expirado.");
        } else {
          setInfo(data);
          if (data.email) setEmail(data.email);
        }
      })
      .catch(() => setError("Não foi possível validar o link agora. Tente de novo em instantes."))
      .finally(() => setLoading(false));
  }, []);

  const needsClassCode = info?.role === "specialist" || info?.role === "md1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    if (!accepted) return setError("Aceite os termos de uso e a política de privacidade para continuar.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          email,
          phone: phone || undefined,
          classCode: classCode || undefined,
          password,
          acceptedTerms: accepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível concluir o cadastro.");
      } else {
        setDone(true);
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
        <div style={{ color: "var(--text-muted)" }}>Validando o link...</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="brand-header">
            <div className="brand-badge">
              <span className="pulse"></span>
              Periscópio Saúde
            </div>
            <h1>Cadastro concluído</h1>
            <p>Seu acesso está liberado. Entre com o e-mail e a senha que você acabou de criar.</p>
          </div>
          <Link href="/login" className="btn-primary" style={{ display: "block", textAlign: "center" }}>
            Entrar
          </Link>
        </div>
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
          <h1>Criar meu cadastro</h1>
          {info && (
            <p>
              Você foi convidado(a) para a equipe
              {info.tenantName ? (
                <>
                  {" "}
                  de <strong>{info.tenantName}</strong>
                </>
              ) : null}
              {info.specialty ? (
                <>
                  {" "}
                  como <strong>{SPECIALTIES[info.specialty] ?? info.specialty}</strong>
                </>
              ) : null}
              {info.schoolName ? (
                <>
                  {" "}
                  na escola <strong>{info.schoolName}</strong>
                </>
              ) : null}
              . Preencha seus dados para liberar o acesso.
            </p>
          )}
        </div>

        {error && (
          <div className="alert-box alert-error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {info && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Nome completo</label>
              <input id="name" type="text" className="form-input" autoComplete="name" required minLength={3} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">E-mail</label>
              <input id="email" type="email" className="form-input" autoComplete="email" required value={email} readOnly={Boolean(info.email)} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="classCode">
                Registro no conselho (CRM, CRP, CRFa...){needsClassCode ? " *" : ""}
              </label>
              <input id="classCode" type="text" className="form-input" required={needsClassCode} maxLength={50} placeholder="Ex: CRP 06/12345" value={classCode} onChange={(e) => setClassCode(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="phone">Telefone / WhatsApp</label>
              <input id="phone" type="tel" className="form-input" autoComplete="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Senha</label>
              <PasswordInput id="password" className="form-input" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm">Repita a senha</label>
              <PasswordInput id="confirm" className="form-input" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, margin: "4px 0 16px" }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                Li e aceito os <Link href="/termos" target="_blank" style={{ textDecoration: "underline" }}>termos de uso</Link> e a{" "}
                <Link href="/privacidade" target="_blank" style={{ textDecoration: "underline" }}>política de privacidade</Link>.
              </span>
            </label>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Cadastrando..." : "Concluir cadastro"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
