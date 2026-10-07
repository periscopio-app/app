"use client";

import { PasswordInput } from "@/components/PasswordInput";
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
            <PasswordInput
              id="password"
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
