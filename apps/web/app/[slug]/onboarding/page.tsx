"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCpf, formatPhone, validateCpf } from "@periscopio/shared";

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
  const [responsavelPassword, setResponsavelPassword] = useState("");
  const [responsavelPasswordConfirm, setResponsavelPasswordConfirm] = useState("");

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
    if (responsavelPassword.length < 8) {
      setError("A sua senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (responsavelPassword !== responsavelPasswordConfirm) {
      setError("As senhas não conferem.");
      return;
    }

    // Validações estritas dos profissionais
    for (let i = 0; i < professionals.length; i++) {
      const p = professionals[i];
      const num = i + 1;
      if (!p.name || p.name.trim().length < 3) {
        setError(`O nome do Profissional #${num} é obrigatório (mínimo 3 caracteres).`);
        return;
      }
      if (!p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
        setError(`O e-mail profissional do Profissional #${num} é inválido.`);
        return;
      }
      const rawPhone = p.phone.replace(/\D/g, "");
      if (rawPhone.length < 10) {
        setError(`O telefone/WhatsApp do Profissional #${num} é obrigatório com DDD.`);
        return;
      }
      if (!validateCpf(p.cpf)) {
        setError(`O CPF do Profissional #${num} é obrigatório e deve ser um CPF válido.`);
        return;
      }
      if (!p.classCode || p.classCode.trim().length < 2) {
        setError(`O Registro / Conselho de Classe do Profissional #${num} é obrigatório (ex: CRP, CRM, CRFa, CBO).`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/api/onboarding/complete-school`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          responsavelPassword,
          professionals,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao concluir onboarding da escola.");
      } else {
        router.push("/login?convite=confirmado");
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
          <div className="form-group">
            <label className="form-label" htmlFor="resp-password">
              Crie a sua senha de acesso (mín. 8 caracteres)
            </label>
            <input
              id="resp-password"
              type="password"
              className="form-input"
              autoComplete="new-password"
              minLength={8}
              required
              value={responsavelPassword}
              onChange={(e) => setResponsavelPassword(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label" htmlFor="resp-password-confirm">
              Repita a senha
            </label>
            <input
              id="resp-password-confirm"
              type="password"
              className="form-input"
              autoComplete="new-password"
              minLength={8}
              required
              value={responsavelPasswordConfirm}
              onChange={(e) => setResponsavelPasswordConfirm(e.target.value)}
            />
          </div>

          {professionals.map((prof, idx) => (
            <div
              key={idx}
              style={{
                background: "#ffffff",
                border: "1.5px solid #e2e8f0",
                borderRadius: "14px",
                padding: "20px",
                marginBottom: "20px",
                position: "relative",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <h4 style={{ color: "#0f172a", fontSize: "0.98rem", fontWeight: 700 }}>
                  Profissional #{idx + 1}
                </h4>
                {professionals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProfessional(idx)}
                    style={{
                      background: "#fee2e2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    ✕ Remover
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: "#0f172a", fontWeight: 600 }}>Nome Completo *</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ background: "#ffffff", color: "#0f172a", border: "1.5px solid #cbd5e1" }}
                    placeholder="Ex: Dra. Larissa Mendonça"
                    value={prof.name}
                    onChange={(e) => updateProfessional(idx, "name", e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: "#0f172a", fontWeight: 600 }}>Especialidade / Perfil *</label>
                  <select
                    className="form-input"
                    value={prof.specialty}
                    onChange={(e) => updateProfessional(idx, "specialty", e.target.value)}
                    style={{ background: "#ffffff", color: "#0f172a", border: "1.5px solid #cbd5e1" }}
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
                  <label className="form-label" style={{ color: "#0f172a", fontWeight: 600 }}>E-mail Profissional (Login) *</label>
                  <input
                    type="email"
                    className="form-input"
                    style={{ background: "#ffffff", color: "#0f172a", border: "1.5px solid #cbd5e1" }}
                    placeholder="larissa.mendonca@saude.gov.br"
                    value={prof.email}
                    onChange={(e) => updateProfessional(idx, "email", e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: "#0f172a", fontWeight: 600 }}>Telefone / WhatsApp *</label>
                  <input
                    type="tel"
                    className="form-input"
                    style={{ background: "#ffffff", color: "#0f172a", border: "1.5px solid #cbd5e1" }}
                    placeholder="(11) 98765-1122"
                    value={prof.phone}
                    onChange={(e) => updateProfessional(idx, "phone", formatPhone(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: "#0f172a", fontWeight: 600 }}>CPF (11 dígitos) *</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{
                      background: "#ffffff",
                      color: "#0f172a",
                      border: prof.cpf.length === 14 && !validateCpf(prof.cpf) ? "1.5px solid #ef4444" : "1.5px solid #cbd5e1",
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={prof.cpf}
                    onChange={(e) => updateProfessional(idx, "cpf", formatCpf(e.target.value))}
                    required
                  />
                  {prof.cpf.length === 14 && !validateCpf(prof.cpf) && (
                    <span style={{ color: "#dc2626", fontSize: "0.75rem", marginTop: "4px", display: "block" }}>
                      ⚠️ CPF com dígito verificador inválido.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: "#0f172a", fontWeight: 600 }}>Registro / Conselho de Classe *</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ background: "#ffffff", color: "#0f172a", border: "1.5px solid #cbd5e1" }}
                    placeholder="Ex: CRP 06/123456, CRM 98765, CRFa 1234"
                    value={prof.classCode}
                    onChange={(e) => updateProfessional(idx, "classCode", e.target.value)}
                    required
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
