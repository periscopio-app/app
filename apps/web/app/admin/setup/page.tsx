"use client";

import { useState } from "react";
import Link from "next/link";
import IntersectoralNetworkWidget from "@/components/admin/IntersectoralNetworkWidget";
import { LocationSelector, type LocationValue } from "@/components/ui/LocationSelector";
import { CepInput } from "@/components/ui/CepInput";

export default function SysAdminSetupPage() {
  const [nomeEscola, setNomeEscola] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [slug, setSlug] = useState("");
  const [location, setLocation] = useState<LocationValue>({ countryCode: "BR", stateUf: "SP", cityName: "" });
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdData, setCreatedData] = useState<{
    magicLink: string;
    school: any;
    emailStatus: string;
  } | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNomeEscola(val);
    if (!slug || slug === autoSlug(nomeEscola)) {
      setSlug(autoSlug(val));
    }
  };

  const autoSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const apiUrl = "";

    try {
      const res = await fetch(`${apiUrl}/api/admin/instances`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeEscola,
          cnpj,
          slug,
          country: location.countryCode,
          state: location.stateUf,
          city: location.cityName,
          responsavelNome,
          responsavelEmail,
          responsavelTelefone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao criar instância da escola.");
      } else {
        setCreatedData({
          magicLink: data.magicLink,
          school: data.school,
          emailStatus: data.emailStatus,
        });
      }
    } catch (err: any) {
      setError(err?.message || "Falha de conexão com a API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container flex-col gap-6" style={{ padding: "40px 16px" }}>
      <div className="auth-card" style={{ maxWidth: "720px" }}>
        <div className="brand-header">
          <div className="brand-badge">
            <span className="pulse"></span>
            Painel SysAdmin • Setup B2B
          </div>
          <h1>Provisionar Nova Escola</h1>
          <p>Crie uma instância White Label isolada com slug personalizada e Magic Link.</p>
        </div>

        {error && (
          <div className="alert-box alert-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {createdData ? (
          <div style={{ textAlign: "center" }}>
            <div className="alert-box alert-success" style={{ marginBottom: "20px" }}>
              <span>✓</span>
              <span>
                Instância da escola <strong>{createdData.school.name}</strong> provisionada com sucesso!
              </span>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "18px", borderRadius: "12px", textAlign: "left", marginBottom: "20px" }}>
              <p style={{ fontSize: "0.85rem", color: "#1e293b", marginBottom: "6px" }}>
                <strong style={{ color: "#0f172a" }}>Slug da Escola:</strong> <code style={{ background: "#e2e8f0", color: "#0f172a", padding: "2px 6px", borderRadius: "4px" }}>{createdData.school.slug}</code>
              </p>
              <p style={{ fontSize: "0.85rem", color: "#1e293b", marginBottom: "6px" }}>
                <strong style={{ color: "#0f172a" }}>E-mail do Responsável:</strong> {createdData.school.responsavelEmail}
              </p>
              <p style={{ fontSize: "0.85rem", color: "#1e293b", marginBottom: "14px" }}>
                <strong style={{ color: "#0f172a" }}>Status de Envio de E-mail:</strong> {createdData.emailStatus}
              </p>

              <label className="form-label" style={{ color: "#0f172a", fontWeight: 600 }}>Magic Link de Onboarding Gerado:</label>
              <input
                type="text"
                readOnly
                value={createdData.magicLink}
                className="form-input"
                style={{ fontSize: "0.85rem", background: "#ffffff", color: "#0f172a", border: "1.5px solid #cbd5e1", fontWeight: 500 }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <a
                href={createdData.magicLink}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ textDecoration: "none", width: "auto", padding: "10px 20px" }}
              >
                Abrir Onboarding da Escola
              </a>
              <button
                type="button"
                onClick={() => {
                  setCreatedData(null);
                  setNomeEscola("");
                  setCnpj("");
                  setSlug("");
                  setResponsavelNome("");
                  setResponsavelEmail("");
                  setResponsavelTelefone("");
                }}
                className="btn-secondary"
              >
                Provisionar Outra Escola
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="nomeEscola">
                Nome da Instituição / Escola *
              </label>
              <input
                id="nomeEscola"
                type="text"
                className="form-input"
                placeholder="Ex: Colégio Municipal Santos Dumont"
                value={nomeEscola}
                onChange={handleNameChange}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cnpj">
                  CNPJ *
                </label>
                <input
                  id="cnpj"
                  type="text"
                  className="form-input"
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="slug">
                  Slug Personalizada (URL) *
                </label>
                <input
                  id="slug"
                  type="text"
                  className="form-input"
                  placeholder="ex: santos-dumont"
                  value={slug}
                  onChange={(e) => setSlug(autoSlug(e.target.value))}
                  required
                />
              </div>
            </div>

            <div style={{ background: "rgba(59, 130, 246, 0.08)", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem", color: "#93c5fd", marginBottom: "18px" }}>
              🌐 <strong>Acesso Exclusivo White Label:</strong> <code>https://app.projetoperiscopio.com.br/{slug || "slug-da-escola"}</code>
            </div>

            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label className="form-label" style={{ marginBottom: "6px", display: "block" }}>
                Buscar Endereço por CEP (ViaCEP Oficial)
              </label>
              <CepInput
                placeholder="00000-000"
                onAddressFound={(addr) => {
                  setLocation({
                    countryCode: "BR",
                    stateUf: addr.uf,
                    cityName: addr.localidade,
                  });
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "18px" }}>
              <label className="form-label" style={{ marginBottom: "8px", display: "block" }}>
                Localização Geográfica da Instituição (País, Estado e Município)
              </label>
              <LocationSelector
                value={location}
                onChange={(newLoc) => setLocation(newLoc)}
              />
            </div>

            <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "20px 0" }} />

            <h3 style={{ fontSize: "1rem", color: "#ffffff", marginBottom: "14px" }}>
              Dados do Responsável Escolar (Receberá o Magic Link)
            </h3>

            <div className="form-group">
              <label className="form-label" htmlFor="responsavelNome">
                Nome Completo do Responsável *
              </label>
              <input
                id="responsavelNome"
                type="text"
                className="form-input"
                placeholder="Ex: Prof. Roberto Alencar (Diretor)"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="responsavelEmail">
                  E-mail do Responsável *
                </label>
                <input
                  id="responsavelEmail"
                  type="email"
                  className="form-input"
                  placeholder="roberto@escola.gov.br"
                  value={responsavelEmail}
                  onChange={(e) => setResponsavelEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="responsavelTelefone">
                  Telefone / WhatsApp
                </label>
                <input
                  id="responsavelTelefone"
                  type="tel"
                  className="form-input"
                  placeholder="(11) 98765-4321"
                  value={responsavelTelefone}
                  onChange={(e) => setResponsavelTelefone(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ marginTop: "12px" }}
            >
              {loading ? "Criando Instância e Enviando Magic Link..." : "Criar Instância & Enviar Magic Link"}
            </button>
          </form>
        )}

        <div className="auth-footer" style={{ marginTop: "24px" }}>
          <Link href="/" style={{ color: "var(--text-muted)" }}>
            ← Voltar para o Início
          </Link>
        </div>
      </div>

      {/* Rede Intersetorial (CRAS, CAPS, UBS e Acolhimento 90 dias) */}
      <div className="w-full max-w-[720px]">
        <IntersectoralNetworkWidget />
      </div>
    </div>
  );
}
