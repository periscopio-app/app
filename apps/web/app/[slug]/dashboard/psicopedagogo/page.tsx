"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface Student {
  id: string;
  studentCode: string;
  birthYear: number;
}

interface Professional {
  id: string;
  name: string;
  specialty: string;
  role: string;
}

export default function PsicopedagogoDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const [school, setSchool] = useState<any>(null);
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [professionalsList, setProfessionalsList] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form para cadastrar aluno
  const [birthYear, setBirthYear] = useState(2016);
  const [studentSuccess, setStudentSuccess] = useState<string | null>(null);

  // Modal / Form para abrir caso e delegar seções
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [delegations, setDelegations] = useState<{ [specialty: string]: string }>({
    fonoaudiologia: "",
    medicina: "",
    psicologia: "",
    psicomotricidade: "",
    servico_social: "",
  });
  const [delegationSuccess, setDelegationSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Busca dados da escola
        const schoolRes = await fetch(`${apiUrl}/api/schools/by-slug/${encodeURIComponent(slug)}`);
        const schoolData = await schoolRes.json();
        if (schoolRes.ok && schoolData.school) {
          setSchool(schoolData.school);

          // 2. Busca alunos da escola
          const studentsRes = await fetch(`${apiUrl}/api/schools/${schoolData.school.id}/students`);
          const sData = await studentsRes.json();
          if (studentsRes.ok) setStudentsList(sData.students || []);

          // 3. Busca profissionais da escola
          const profsRes = await fetch(`${apiUrl}/api/schools/${schoolData.school.id}/professionals`);
          const pData = await profsRes.json();
          if (profsRes.ok) setProfessionalsList(pData.professionals || []);
        }
      } catch (err) {
        console.error("Erro ao carregar dados", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, apiUrl]);

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setStudentSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/api/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: school.id,
          birthYear: Number(birthYear),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStudentSuccess(`Aluno cadastrado com sucesso! ID Pseudonimizado: ${data.student.studentCode}`);
        setStudentsList([...studentsList, data.student]);
      }
    } catch (err: any) {
      alert("Erro ao cadastrar aluno");
    }
  };

  const handleOpenCaseAndDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert("Selecione um aluno");
      return;
    }
    setDelegationSuccess(null);

    try {
      // 1. Abre o Caso
      const caseRes = await fetch(`${apiUrl}/api/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
        }),
      });
      const caseData = await caseRes.json();

      if (!caseRes.ok) {
        alert("Erro ao abrir caso");
        return;
      }

      // 2. Delega as seções preenchidas
      const delegationList = Object.entries(delegations)
        .filter(([_, profId]) => Boolean(profId))
        .map(([specialty, professionalId]) => ({
          specialty,
          professionalId,
          notes: `Seção de ${specialty} delegada pelo Psicopedagogo`,
        }));

      if (delegationList.length > 0) {
        await fetch(`${apiUrl}/api/cases/${caseData.case.id}/delegate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delegations: delegationList }),
        });
      }

      setDelegationSuccess(`Prontuário aberto com sucesso! ${delegationList.length} seções foram delegadas para a equipe multiprofissional.`);
    } catch (err) {
      alert("Erro ao delegar prontuário.");
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div style={{ color: "var(--text-muted)" }}>Carregando painel do Psicopedagogo...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ maxWidth: "1100px" }}>
      <header className="dashboard-header">
        <div>
          <div className="brand-badge">
            <span className="pulse"></span>
            {school?.name} • Painel do Psicopedagogo (PpI)
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "6px" }}>
            Gestão Clínica & Prontuário Multidisciplinar
          </h1>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href={`/${slug}/dashboard/especialista`} className="btn-secondary" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
            Visão do Especialista →
          </Link>
          <Link href={`/${slug}/login`} className="btn-secondary" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
            Sair
          </Link>
        </div>
      </header>

      {/* Grid: 1. Cadastro de Alunos (Pseudonimizado LGPD) | 2. Abertura e Delegação de Caso */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "24px", marginBottom: "30px" }}>
        {/* Card 1: Cadastro de Aluno */}
        <div className="card">
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>👤</span> Cadastrar Novo Aluno
          </h3>
          <p style={{ marginBottom: "16px", fontSize: "0.84rem" }}>
            Em conformidade com a <strong>LGPD</strong>, não coletamos nome nem CPF de alunos. O sistema gera automaticamente um código pseudonimizado.
          </p>

          {studentSuccess && (
            <div className="alert-box alert-success" style={{ fontSize: "0.82rem" }}>
              <span>✓</span>
              <span>{studentSuccess}</span>
            </div>
          )}

          <form onSubmit={handleRegisterStudent}>
            <div className="form-group">
              <label className="form-label">Ano de Nascimento *</label>
              <input
                type="number"
                min="2005"
                max="2025"
                value={birthYear}
                onChange={(e) => setBirthYear(Number(e.target.value))}
                className="form-input"
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ padding: "10px" }}>
              Gerar Código & Cadastrar Aluno
            </button>
          </form>

          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "20px 0" }} />

          <h4 style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "10px" }}>
            Alunos Cadastrados ({studentsList.length}):
          </h4>
          <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {studentsList.map((st) => (
              <div
                key={st.id}
                style={{
                  background: "rgba(0,0,0,0.25)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.85rem",
                }}
              >
                <strong>{st.studentCode}</strong>
                <span style={{ color: "var(--text-muted)" }}>Nasc: {st.birthYear}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Abertura de Caso & Delegação por Especialidade */}
        <div className="card">
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📋</span> Abrir Caso & Delegar Sumarização
          </h3>
          <p style={{ marginBottom: "16px", fontSize: "0.84rem" }}>
            Selecione o aluno e delegue a parte correspondente do prontuário para cada profissional da equipe.
          </p>

          {delegationSuccess && (
            <div className="alert-box alert-success" style={{ fontSize: "0.82rem" }}>
              <span>✓</span>
              <span>{delegationSuccess}</span>
            </div>
          )}

          <form onSubmit={handleOpenCaseAndDelegate}>
            <div className="form-group">
              <label className="form-label">Selecione o Aluno *</label>
              <select
                className="form-input"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                style={{ background: "#0f172a" }}
                required
              >
                <option value="">Selecione um código de aluno...</option>
                {studentsList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.studentCode} (Nasc: {st.birthYear})
                  </option>
                ))}
              </select>
            </div>

            <h4 style={{ fontSize: "0.88rem", color: "#60a5fa", margin: "14px 0 10px" }}>
              Delegação de Seções por Especialidade:
            </h4>

            {/* Delegações */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { id: "fonoaudiologia", label: "Fonoaudiologia" },
                { id: "medicina", label: "Medicina (MD1)" },
                { id: "psicologia", label: "Psicologia" },
                { id: "psicomotricidade", label: "Psicomotricidade" },
                { id: "servico_social", label: "Serviço Social" },
              ].map((spec) => (
                <div key={spec.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{spec.label}:</span>
                  <select
                    className="form-input"
                    value={delegations[spec.id]}
                    onChange={(e) =>
                      setDelegations({
                        ...delegations,
                        [spec.id]: e.target.value,
                      })
                    }
                    style={{ background: "#0f172a", padding: "8px 10px", fontSize: "0.82rem" }}
                  >
                    <option value="">Não delegar nesta etapa</option>
                    {professionalsList
                      .filter((p) => !p.specialty || p.specialty === spec.id || p.role === spec.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.specialty || p.role})
                        </option>
                      ))}
                    {/* Fallback de todos os profissionais caso especialidade não coincida exatamente */}
                    {professionalsList.map((p) => (
                      <option key={`all-${p.id}`} value={p.id}>
                        {p.name} ({p.specialty})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: "18px", padding: "10px" }}>
              Abrir Caso & Delegar Seções
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
