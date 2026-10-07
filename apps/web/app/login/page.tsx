"use client";

import { PasswordInput } from "@/components/PasswordInput";
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });
      if (res.error) {
        setError(
          res.error.status === 429
            ? "Muitas tentativas. Aguarde um minuto e tente de novo."
            : "E-mail ou senha incorretos. Se você ainda não criou sua senha, use o link abaixo.",
        );
      } else {
        router.push("/dashboard");
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
            <PasswordInput
              id="password"
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
            {loading ? "Entrando… (o servidor pode levar alguns segundos)" : "Acessar Plataforma"}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Acesso por cadastro. <Link href="/primeiro-acesso">Primeiro acesso ou esqueci a senha</Link>:
            receba um link no e-mail cadastrado.
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
