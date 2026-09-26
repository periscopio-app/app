"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface DelegatedSection {
  id: string;
  caseId: string;
  specialty: string;
  status: string;
  notes: string;
  summary: any;
  studentCode: string;
  birthYear: number;
}

export default function EspecialistaDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const [school, setSchool] = useState<any>(null);
  const [emailInput, setEmailInput] = useState("");
  const [assignedSections, setAssignedSections] = useState<DelegatedSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<DelegatedSection | null>(null);

  // Form de sumarização clínica da especialidade
  const [summaryText, setSummaryText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchool() {
      try {
        const res = await fetch(`${apiUrl}/api/schools/by-slug/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (res.ok && data.school) setSchool(data.school);
      } catch (e) {
        console.error("Erro ao carregar escola", e);
      }
    }
    loadSchool();
  }, [slug, apiUrl]);

  const handleFetchSections = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailInput) return;
    setLoading(true);
    setSaveSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/api/cases/my-delegated-sections?email=${encodeURIComponent(emailInput)}`);
      const data = await res.json();
      if (res.ok) {
        setAssignedSections(data.assignedSections || []);
        if (data.assignedSections && data.assignedSections.length > 0) {
          selectSection(data.assignedSections[0]);
        }
      } else {
        alert(data.error || "Profissional não encontrado nesta escola.");
      }
    } catch (err) {
      alert("Erro ao buscar seções.");
    } finally {
      setLoading(false);
    }
  };

  const selectSection = (sec: DelegatedSection) => {
    setActiveSection(sec);
    setSummaryText(sec.summary?.clinicalNotes || sec.notes || "");
    setSaveSuccess(null);
  };

  const handleSaveSummary = async (markAsCompleted = false) => {
    if (!activeSection) return;
    setSaving(true);
    setSaveSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/api/cases/sections/${activeSection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: {
            clinicalNotes: summaryText,
            specialty: activeSection.specialty,
            savedAt: new Date().toISOString(),
          },
          markAsCompleted,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSaveSuccess(markAsCompleted ? "Sumarização concluída e salva no prontuário!" : "Rascunho salvo com sucesso.");
        // Atualiza status local
        setAssignedSections(
          assignedSections.map((s) =>
            s.id === activeSection.id
              ? { ...s, status: markAsCompleted ? "concluido" : "em_andamento" }
              : s
          )
        );
      } else {
        alert("Erro ao salvar sumarização.");
      }
    } catch (e) {
      alert("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: "1050px" }}>
      <header className="dashboard-header">
        <div>
          <div className="brand-badge">
            <span className="pulse"></span>
            {school?.name} • Portal do Especialista
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "6px" }}>
            Sumarização Clínica por Especialidade
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Você tem acesso restrito <strong>apenas às seções delegadas à sua especialidade</strong>.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href={`/${slug}/dashboard/psicopedagogo`} className="btn-secondary" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
            ← Painel Psicopedagogo
          </Link>
          <Link href={`/${slug}/login`} className="btn-secondary" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
            Sair
          </Link>
        </div>
      </header>

      {/* Identificação do profissional */}
      <div className="card" style={{ marginBottom: "24px", padding: "16px 20px" }}>
        <form onSubmit={handleFetchSections} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Digite seu E-mail Cadastrado na Escola</label>
            <input
              type="email"
              className="form-input"
              placeholder="ex: fonoaudiologia@saude.gov.br"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" style={{ width: "auto", padding: "12px 24px", height: "46px" }}>
            {loading ? "Buscando..." : "Carregar Minhas Seções"}
          </button>
        </form>
      </div>

      {assignedSections.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
          {/* Coluna Esquerda: Lista de seções atribuídas */}
          <div className="card" style={{ padding: "18px" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "14px" }}>
              Casos Atribuídos ({assignedSections.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {assignedSections.map((sec) => (
                <div
                  key={sec.id}
                  onClick={() => selectSection(sec)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: activeSection?.id === sec.id ? "rgba(59, 130, 246, 0.2)" : "rgba(0,0,0,0.25)",
                    border: `1px solid ${activeSection?.id === sec.id ? "var(--primary)" : "rgba(255,255,255,0.06)"}`,
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "0.95rem" }}>{sec.studentCode}</strong>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        padding: "2px 8px",
                        borderRadius: "99px",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        background: sec.status === "concluido" ? "rgba(16, 185, 129, 0.2)" : "rgba(234, 179, 8, 0.2)",
                        color: sec.status === "concluido" ? "#6ee7b7" : "#fde047",
                      }}
                    >
                      {sec.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Especialidade: <strong>{sec.specialty.toUpperCase()}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna Direita: Editor de Sumarização Clínica */}
          {activeSection && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div className="brand-badge" style={{ fontSize: "0.72rem" }}>
                    Seção: {activeSection.specialty.toUpperCase()}
                  </div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: "4px" }}>
                    Prontuário do Aluno: {activeSection.studentCode}
                  </h2>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Ano de Nascimento: {activeSection.birthYear}
                  </p>
                </div>

                <span
                  style={{
                    fontSize: "0.78rem",
                    padding: "4px 10px",
                    borderRadius: "99px",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    background: activeSection.status === "concluido" ? "rgba(16, 185, 129, 0.2)" : "rgba(234, 179, 8, 0.2)",
                    color: activeSection.status === "concluido" ? "#6ee7b7" : "#fde047",
                  }}
                >
                  {activeSection.status}
                </span>
              </div>

              {saveSuccess && (
                <div className="alert-box alert-success" style={{ fontSize: "0.85rem" }}>
                  <span>✓</span>
                  <span>{saveSuccess}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Sumarização Clínica & Parecer da Especialidade ({activeSection.specialty}) *
                </label>
                <textarea
                  className="form-input"
                  rows={8}
                  style={{ resize: "vertical", lineHeight: "1.5" }}
                  placeholder={`Descreva aqui as observações clínicas, marcos avaliados, evolução e recomendações terapêuticas da ${activeSection.specialty}...`}
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveSummary(false)}
                  className="btn-secondary"
                >
                  {saving ? "Salvando..." : "Salvar Rascunho"}
                </button>
                <button
                  type="button"
                  disabled={saving || !summaryText}
                  onClick={() => handleSaveSummary(true)}
                  className="btn-primary"
                  style={{ width: "auto", padding: "10px 24px" }}
                >
                  {saving ? "Finalizando..." : "Concluir Sumarização"}
                </button>
              </div>

              <div className="lgpd-notice" style={{ marginTop: "20px" }}>
                🔒 Este parecer fará parte do Prontuário Multidisciplinar Consolidado da escola.
                Assegure que nenhum identificador direto não autorizado conste no texto livre.
              </div>
            </div>
          )}
        </div>
      ) : (
        emailInput && !loading && (
          <div className="card" style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--text-muted)" }}>
              Nenhuma seção de prontuário delegada para o e-mail informado nesta escola.
            </p>
          </div>
        )
      )}
    </div>
  );
}
