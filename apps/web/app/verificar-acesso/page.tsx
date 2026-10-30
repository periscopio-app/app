"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function VerificarAcessoPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    void sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendOtp() {
    setSending(true);
    setError(null);
    try {
      await authClient.twoFactor.sendOtp();
      setSentAt(new Date());
    } catch {
      setError("Não foi possível enviar o código. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.trim().length < 6) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.twoFactor.verifyOtp({ code: otp.trim() });
      if (res.error) {
        const msg =
          res.error.code === "OTP_HAS_EXPIRED"
            ? "Código expirado. Solicite um novo código."
            : res.error.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"
              ? "Muitas tentativas. Solicite um novo código."
              : res.error.code === "ACCOUNT_TEMPORARILY_LOCKED"
                ? "Conta temporariamente bloqueada. Aguarde e tente de novo."
                : "Código inválido. Verifique e tente de novo.";
        setError(msg);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Ocorreu um erro na verificação. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-header">
          <div className="brand-badge">
            <span className="pulse"></span>
            Periscópio Saúde
          </div>
          <h1>Verificação de acesso</h1>
          <p>Autenticação em dois fatores</p>
        </div>

        <p className="text-sm text-center" style={{ color: "#5B6B78", marginBottom: "1rem" }}>
          {sending
            ? "Enviando código para seu e-mail…"
            : sentAt
              ? `Código enviado para o seu e-mail cadastrado. Válido por 10 minutos.`
              : "Preparando envio do código…"}
        </p>

        {error && (
          <div className="alert-box alert-error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label className="form-label" htmlFor="otp-code">
              Código de 6 dígitos
            </label>
            <input
              ref={inputRef}
              id="otp-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className="form-input"
              style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: "1.5rem" }}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="one-time-code"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.trim().length < 6}
            className="btn-primary"
          >
            {loading ? "Verificando…" : "Confirmar acesso"}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: "1rem" }}>
          <p>
            Não recebeu?{" "}
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={sending}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#682880", fontWeight: 600, padding: 0 }}
            >
              {sending ? "Enviando…" : "Reenviar código"}
            </button>
          </p>
        </div>

        <div className="lgpd-notice">
          🔒 Código de uso único enviado para o e-mail cadastrado. Não compartilhe com ninguém.
        </div>
      </div>
    </div>
  );
}
