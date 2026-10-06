"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SchoolLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isJustRegistered = searchParams.get("registered") === "true";

  const [school, setSchool] = useState<any>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const apiUrl = "";

  useEffect(() => {
    async function loadSchool() {
      try {
        const res = await fetch(`${apiUrl}/api/schools/by-slug/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (res.ok && data.school) {
          setSchool(data.school);
        } else {
          setError("Instância da escola não encontrada.");
        }
      } catch (err: any) {
        setError("Erro ao carregar dados da escola.");
      } finally {
        setLoadingSchool(false);
      }
    }
    loadSchool();
  }, [slug, apiUrl]);

  const handleGoogleLogin = async () => {
    try {
      setAuthLoading(true);
      setError(null);
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `/${slug}/dashboard`,
      });
    } catch (err: any) {
      setError(err?.message || "Erro ao conectar com Google.");
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthLoading(true);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
        callbackURL: `/${slug}/dashboard`,
      });

      if (res.error) {
        setError(res.error.message || "Credenciais inválidas.");
      } else {
        router.push(`/${slug}/dashboard`);
      }
    } catch (err: any) {
      setError(err?.message || "Falha na autenticação.");
    } finally {
      setAuthLoading(false);
    }
  };

  if (loadingSchool) {
    return (
      <div className="auth-container">
        <div style={{ color: "var(--text-muted)" }}>Carregando ambiente da escola...</div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-header">
          <div className="brand-badge">
            <span className="pulse"></span>
            {school?.name || "Periscópio Saúde"}
          </div>
          <h1>Portal do Profissional</h1>
          <p>Ambiente seguro e exclusivo da escola</p>
        </div>

        {isJustRegistered && (
          <div className="alert-box alert-success">
            <span>✓</span>
            <span>Equipe cadastrada com sucesso! Realize o login para acessar o prontuário.</span>
          </div>
        )}

        {error && (
          <div className="alert-box alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={authLoading}
          className="btn-google"
          id="btn-google-school-login"
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
          {authLoading ? "Conectando..." : "Entrar com o Google"}
        </button>

        <div className="divider">
          <span>ou e-mail profissional</span>
        </div>

        <form onSubmit={handleEmailLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              E-mail Cadastrado
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="seu.email@saude.gov.br"
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
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="btn-primary"
            id="btn-school-submit"
          >
            {authLoading ? "Autenticando..." : "Entrar na Escola"}
          </button>
        </form>

        <div className="lgpd-notice">
          🔒 Acesso restrito a profissionais autorizados desta instituição.
          Isolamento municipal e governança clínica conforme a LGPD.
        </div>
      </div>
    </div>
  );
}
