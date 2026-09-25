"use client";

import { useRouter } from "next/navigation";
import { authClient, useSession, signOut } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (isPending) {
    return (
      <div className="auth-container">
        <div style={{ color: "var(--text-muted)", fontSize: "1rem" }}>
          Carregando sessão...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="user-badge">
          <div className="avatar">
            {session?.user?.name ? session.user.name[0].toUpperCase() : "P"}
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {session?.user?.name || "Profissional Periscópio"}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {session?.user?.email || "Conectado via Neon Auth"}
            </p>
          </div>
        </div>

        <button type="button" onClick={handleLogout} className="btn-secondary">
          Sair da Conta
        </button>
      </header>

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "8px" }}>
          Painel de Saúde Mental Escolar
        </h1>
        <p style={{ color: "var(--text-muted)" }}>
          Protocolo NEMT: triagem precoce, intervenção multidisciplinar e encaminhamento.
        </p>
      </div>

      <div className="grid-cards">
        <div className="card">
          <span style={{ fontSize: "1.75rem", display: "block", marginBottom: "8px" }}>📋</span>
          <h3>Triagem FOGAP</h3>
          <p>
            Registro de observações de professores com avaliação de marcos do desenvolvimento infantil.
          </p>
        </div>

        <div className="card">
          <span style={{ fontSize: "1.75rem", display: "block", marginBottom: "8px" }}>⏱️</span>
          <h3>Janela Terapêutica</h3>
          <p>
            Acompanhamento dos 120 dias de intervenção precoce antes de encaminhamentos externos.
          </p>
        </div>

        <div className="card">
          <span style={{ fontSize: "1.75rem", display: "block", marginBottom: "8px" }}>🔒</span>
          <h3>Privacidade & LGPD</h3>
          <p>
            Alunos pseudonimizados com student_code, isolamento municipal (multi-tenant) e auditoria.
          </p>
        </div>
      </div>
    </div>
  );
}
