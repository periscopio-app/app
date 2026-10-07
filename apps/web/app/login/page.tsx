"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const convite = new URLSearchParams(window.location.search).get("convite");
    if (convite === "confirmado") {
      setSuccessMsg("Senha criada! Entre com o seu e-mail e a nova senha.");
    }
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch (err: any) {
      setError(err?.message || "Falha ao autenticar com o Google. Tente novamente.");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      });
      if (res.error) {
        setError("E-mail ou senha incorretos, ou acesso ainda não liberado.");
      } else {
        setSuccessMsg("Conectado com sucesso!");
        setTimeout(() => router.push("/dashboard"), 500);
      }
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro na autenticação.");
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
          <h1>Entrar no Sistema</h1>
          <p>Plataforma de Saúde Mental Escolar (NEMT)</p>
        </div>

        {error && (
          <div className="alert-box alert-error flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="alert-box alert-success">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="btn-google"
          id="btn-google-login"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {loading ? "Conectando..." : "Continuar com o Google"}
        </button>

        <div className="divider">
          <span>ou via e-mail</span>
        </div>

        <form onSubmit={handleEmailAuth}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              E-mail Institucional
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="seu.email@municipio.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            id="btn-submit-auth"
          >
            {loading ? "Processando..." : "Acessar Plataforma"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Acesso por cadastro. Se você já foi cadastrado e ainda não tem senha,
            ou esqueceu a sua,{" "}
            <Link href="/primeiro-acesso">receba um link por e-mail</Link>.
          </p>
        </div>

        <div className="lgpd-notice">
          🔒 Dados protegidos conforme a LGPD em infraestrutura segura (Neon sa-east-1).
          Acesso restrito a profissionais autorizados.
        </div>
      </div>
    </div>
  );
}
