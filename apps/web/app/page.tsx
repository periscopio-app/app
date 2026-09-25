import Link from "next/link";

export default function HomePage() {
  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: "560px", textAlign: "center" }}>
        <div className="brand-header">
          <div className="brand-badge">
            <span className="pulse"></span>
            Periscópio Saúde
          </div>
          <h1 style={{ fontSize: "2rem", marginBottom: "12px" }}>
            Plataforma Digital de Saúde Mental Escolar
          </h1>
          <p style={{ fontSize: "1rem", lineHeight: "1.6" }}>
            Esteira integrada do protocolo NEMT: da observação na escola à intervenção
            precoce multidisciplinar e encaminhamento responsável.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", margin: "28px 0" }}>
          <Link href="/login" className="btn-primary" style={{ textDecoration: "none", width: "auto", padding: "12px 28px" }}>
            Acessar Plataforma
          </Link>
          <Link href="/dashboard" className="btn-secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Ver Painel
          </Link>
        </div>

        <div className="lgpd-notice" style={{ marginTop: "24px" }}>
          🔒 Multi-tenant isolado por município • Pseudonimização total de alunos • Conformidade LGPD
        </div>
      </div>
    </div>
  );
}

