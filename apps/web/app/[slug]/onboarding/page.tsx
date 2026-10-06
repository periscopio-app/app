"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ProfessionalInput {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  classCode: string;
  specialty: string;
}

export default function SchoolOnboardingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schoolData, setSchoolData] = useState<any>(null);

  const [professionals, setProfessionals] = useState<ProfessionalInput[]>([
    {
      name: "",
      email: "",
      phone: "",
      cpf: "",
      classCode: "",
      specialty: "psicopedagogia",
    },
  ]);

  const apiUrl = "";

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError("Token de convite ausente na URL. Verifique o link recebido por e-mail.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${apiUrl}/api/onboarding/validate-invite?token=${encodeURIComponent(token)}&slug=${encodeURIComponent(slug)}`
        );
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setError(data.error || "Convite inválido ou expirado.");
        } else {
          setSchoolData(data.school);
        }
      } catch (err: any) {
        setError("Não foi possível validar o convite com o servidor.");
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token, slug, apiUrl]);

  const addProfessional = () => {
    setProfessionals([
      ...professionals,
      {
        name: "",
        email: "",
        phone: "",
        cpf: "",
        classCode: "",
        specialty: "fonoaudiologia",
      },
    ]);
  };

  const removeProfessional = (index: number) => {
    if (professionals.length === 1) return;
    setProfessionals(professionals.filter((_, i) => i !== index));
  };

  const updateProfessional = (
    index: number,
    field: keyof ProfessionalInput,
    value: string
  ) => {
    const updated = [...professionals];
    updated[index][field] = value;
    setProfessionals(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/api/onboarding/complete-school`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          professionals,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao concluir onboarding da escola.");
      } else {
        router.push(`/${slug}/login?registered=true`);
      }
    } catch (err: any) {
      setError(err?.message || "Erro de rede ao salvar cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div style={{ color: "var(--text-muted)" }}>Validando Magic Link da Escola...</div>
      </div>
    );
  }

  if (error && !schoolData) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: "480px", textAlign: "center" }}>
          <div className="brand-badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.4)" }}>
            Convite Inválido
          </div>
          <h2 style={{ margin: "16px 0 10px" }}>Acesso Não Autorizado</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" style={{ padding: "40px 16px" }}>
      <div className="auth-card" style={{ maxWidth: "860px" }}>
        <div className="brand-header">
          <div className="brand-badge">
            <span className="pulse"></span>
            Onboarding Institucional • {schoolData?.name}
          </div>
          <h1>Cadastrar Equipe Multiprofissional</h1>
          <p>
            Bem-vindo(a), <strong>{schoolData?.responsavelNome}</strong>! Cadastre os
            profissionais que atuarão no protocolo NEMT da sua escola.
          </p>
        </div>

        {error && (
          <div className="alert-box alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {professionals.map((prof, idx) => (
            <div
              key={idx}
              style={{
                background: "rgba(15, 23, 42, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "20px",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                }}
              >
                <h4 style={{ color: "#60a5fa", fontSize: "0.95rem" }}>
                  Profissional #{idx + 1}
                </h4>
                {professionals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProfessional(idx)}
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "#fca5a5",
                      border: "none",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    ✕ Remover
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">Nome Completo *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Dra. Larissa Mendonça"
                    value={prof.name}
                    onChange={(e) => updateProfessional(idx, "name", e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Especialidade / Perfil *</label>
                  <select
                    className="form-input"
                    value={prof.specialty}
                    onChange={(e) => updateProfessional(idx, "specialty", e.target.value)}
                    style={{ background: "#0f172a" }}
                    required
                  >
                    <option value="psicopedagogia">Psicopedagogo (PpI)</option>
                    <option value="medicina">Médico Triador (MD1)</option>
                    <option value="fonoaudiologia">Fonoaudiólogo</option>
                    <option value="psicologia">Psicólogo</option>
                    <option value="psicomotricidade">Psicomotricista</option>
                    <option value="servico_social">Assistente Social</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">E-mail Profissional (Login) *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="larissa.mendonca@saude.gov.br"
                    value={prof.email}
                    onChange={(e) => updateProfessional(idx, "email", e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="(11) 98765-1122"
                    value={prof.phone}
                    onChange={(e) => updateProfessional(idx, "phone", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">CPF (Apenas números)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="000.000.000-00"
                    value={prof.cpf}
                    onChange={(e) => updateProfessional(idx, "cpf", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Registro / Conselho de Classe</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: CRP 06/123456, CRM 98765"
                    value={prof.classCode}
                    onChange={(e) => updateProfessional(idx, "classCode", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0" }}>
            <button
              type="button"
              onClick={addProfessional}
              className="btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              + Adicionar Outro Profissional
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ width: "auto", padding: "12px 32px" }}
            >
              {submitting ? "Finalizando Onboarding..." : "Concluir Onboarding & Ativar Escola"}
            </button>
          </div>
        </form>

        <div className="lgpd-notice">
          🔒 Todos os profissionais cadastrados estarão vinculados estritamente à instância desta escola.
          Conforme a LGPD, o Psicopedagogo delegará as seções e cada profissional só terá acesso aos dados da sua especialidade.
        </div>
      </div>
    </div>
  );
}
