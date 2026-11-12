"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";

export type TenantOption = { id: string; name: string };
export type SchoolOption = { id: string; name: string; tenantId: string };

type LinkItem = {
  id: string;
  label: string | null;
  role: string | null;
  specialty: string | null;
  email: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  tenantName: string | null;
  schoolName: string | null;
  status: "pending" | "used" | "expired";
  url: string | null;
};

const SPECIALTIES: Record<string, string> = {
  fonoaudiologia: "Fonoaudiologia",
  neuropsicologia: "Neuropsicologia",
  psicologia: "Psicologia",
  psicopedagogia: "Psicopedagogia",
  psicomotricidade: "Psicomotricidade",
  servico_social: "Serviço Social",
};

const ROLE_OPTIONS = [
  { value: "specialist", label: "Especialista clínico" },
  { value: "md1", label: "Médico(a)" },
  { value: "ppi", label: "RE — Responsável Escolar" },
];

const STATUS_LABEL: Record<LinkItem["status"], string> = { pending: "Aguardando cadastro", used: "Cadastro feito", expired: "Expirado / revogado" };
const STATUS_CLASS: Record<LinkItem["status"], string> = {
  pending: "bg-amber-500/15 text-amber-800 border-amber-500/40",
  used: "bg-emerald-500/15 text-emerald-800 border-emerald-500/40",
  expired: "bg-slate-500/15 text-slate-700 border-slate-500/40",
};

const inputClass = "w-full px-3 py-2 rounded-xl bg-white border border-[#E1E9ED] text-sm text-black focus:outline-none focus:border-blue-500";

export function RegistrationLinksModal({
  tenants,
  schools,
  onClose,
}: {
  tenants: TenantOption[];
  schools: SchoolOption[];
  onClose: () => void;
}) {
  const [tenantId, setTenantId] = useState(tenants.length === 1 ? tenants[0].id : "");
  const [role, setRole] = useState("specialist");
  const [specialty, setSpecialty] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ url: string; expiresAt: string; label: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);

  const loadLinks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/registration-links", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setLinks(data.links ?? []);
    } catch {
      // a lista é auxiliar: não bloqueia a criação
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const schoolsOfTenant = schools.filter((s) => s.tenantId === tenantId);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 2500);
    } catch {
      setError("Não consegui copiar sozinho: selecione o link e copie com Ctrl+C.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/registration-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tenantId,
          role,
          specialty: role === "specialist" ? specialty || undefined : undefined,
          schoolId: schoolId || undefined,
          label: label || undefined,
          email: email || undefined,
          expiresInDays: days,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar o link.");
      setCreated({ url: data.url, expiresAt: data.expiresAt, label });
      setLabel("");
      setEmail("");
      loadLinks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revogar este link? Quem ainda não se cadastrou não conseguirá mais usá-lo.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/registration-links/${id}/revoke`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível revogar.");
      loadLinks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const whatsapp = (url: string, who: string | null) =>
    `https://wa.me/?text=${encodeURIComponent(`${who ? `Olá, ${who}! ` : "Olá! "}Este é o seu link para se cadastrar no Periscópio Saúde (vale para uma pessoa só): ${url}`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-200/70 backdrop-blur-sm">
      <div className="bg-white border border-[#E1E9ED] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex justify-between items-center pb-4 border-b border-[#E1E9ED]">
          <div>
            <h3 className="text-lg font-bold text-black">Link de cadastro de profissional</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Gere um link por pessoa e envie por onde preferir. Ela abre, informa o próprio e-mail (qualquer domínio) e cria a senha.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-600 hover:text-black" aria-label="Fechar">✕</button>
        </div>

        {error && <div role="alert" className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-sm">⚠️ {error}</div>}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="rl-tenant">Instância (município) *</label>
              <select id="rl-tenant" required value={tenantId} onChange={(e) => { setTenantId(e.target.value); setSchoolId(""); }} className={inputClass}>
                <option value="">Selecione...</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="rl-role">Perfil *</label>
              <select id="rl-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {role === "specialist" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="rl-spec">Especialidade *</label>
                <select id="rl-spec" required value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={inputClass}>
                  <option value="">Selecione...</option>
                  {Object.entries(SPECIALTIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="rl-school">
                Escola{role === "ppi" ? " *" : ""}
              </label>
              <select id="rl-school" required={role === "ppi"} value={schoolId} onChange={(e) => setSchoolId(e.target.value)} disabled={!tenantId} className={inputClass}>
                <option value="">{role === "ppi" ? "Selecione a escola..." : "Sem escola (núcleo)"}</option>
                {schoolsOfTenant.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="rl-label">Para quem é <span className="font-normal text-slate-500">(só para você se organizar)</span></label>
              <input id="rl-label" type="text" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Dra. Mariana — fono" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="rl-email">E-mail fixo</label>
              <input id="rl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="deixe vazio para a pessoa informar" className={inputClass} />
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="rl-days">Validade</label>
              <select id="rl-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputClass}>
                {[1, 3, 7, 15, 30].map((d) => <option key={d} value={d}>{d} {d === 1 ? "dia" : "dias"}</option>)}
              </select>
            </div>
            <Button type="submit" disabled={submitting} variant="secondary" size="md">
              {submitting ? "Gerando..." : "Gerar link"}
            </Button>
          </div>
        </form>

        {created && (
          <div className="mt-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm font-semibold text-emerald-800">Link gerado. Vale para um cadastro e expira em {new Date(created.expiresAt).toLocaleDateString("pt-BR")}.</p>
            <input readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} aria-label="Link de cadastro" className={`${inputClass} mt-2 font-mono text-xs`} />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" onClick={() => copy(created.url)} variant="secondary" size="sm">{copied === created.url ? "Copiado ✓" : "Copiar link"}</Button>
              <a href={whatsapp(created.url, created.label || null)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E1E9ED] text-slate-700 hover:bg-[#F0F9FC]">
                Enviar por WhatsApp
              </a>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h4 className="text-sm font-bold text-black">Links gerados</h4>
          {links.length === 0 ? (
            <p className="mt-2 text-xs text-slate-600">Nenhum link gerado ainda.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[#E1E9ED] border border-[#E1E9ED] rounded-xl">
              {links.map((l) => (
                <li key={l.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-black">{l.label || "(sem identificação)"}</div>
                    <div className="text-slate-600">
                      {ROLE_OPTIONS.find((r) => r.value === l.role)?.label ?? l.role}
                      {l.specialty ? ` · ${SPECIALTIES[l.specialty] ?? l.specialty}` : ""} · {l.tenantName}
                      {l.schoolName ? ` · ${l.schoolName}` : ""}
                      {l.email ? ` · ${l.email}` : ""}
                    </div>
                    <div className="text-slate-500">Criado em {new Date(l.createdAt).toLocaleDateString("pt-BR")}{l.status === "pending" ? ` · vale até ${new Date(l.expiresAt).toLocaleDateString("pt-BR")}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full border font-semibold ${STATUS_CLASS[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                    {l.url && (
                      <>
                        <Button type="button" onClick={() => copy(l.url!)} variant="outline" size="sm">{copied === l.url ? "Copiado ✓" : "Copiar"}</Button>
                        <Button type="button" onClick={() => revoke(l.id)} variant="danger" size="sm">Revogar</Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
