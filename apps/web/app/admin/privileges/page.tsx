"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, RotateCcw, Save, Search, ShieldAlert, SlidersHorizontal, User } from "lucide-react";
import { api, ApiError } from "@/lib/api";

// ─── tipos (espelham /api/admin/privileges/*) ───────────────────────────────

interface RoleCol { key: string; label: string }
interface GroupDef { key: string; label: string }
interface DefaultCell { allowed: boolean; partial: boolean }
interface CapDef {
  key: string;
  group: string;
  label: string;
  description: string;
  sensitive: boolean;
  locked: boolean;
  defaultSpecialties: string[] | null;
  defaults: Record<string, DefaultCell>;
}
interface Catalog { roles: RoleCol[]; groups: GroupDef[]; capabilities: CapDef[]; tenants: { id: string; name: string }[] }
interface MatrixCell { default: boolean; partial: boolean; override: boolean | null; inherited: boolean | null; effective: boolean }
interface Matrix { scope: string; cells: { capability: string; byRole: Record<string, MatrixCell> }[] }
interface PersonRow { id: string; name: string; email: string; role: string; roleLabel: string; specialty: string | null; schoolName: string | null; overrides: number }
interface PersonCap {
  key: string; group: string; label: string; description: string; sensitive: boolean; locked: boolean;
  default: boolean; roleOverride: boolean | null; userOverride: boolean | null; effective: boolean; source: string;
}
interface PersonDetail { user: { id: string; name: string; email: string; roleLabel: string; specialty: string | null }; capabilities: PersonCap[] }
interface AuditEvent { id: string; action: string; userEmail: string | null; payload: Record<string, unknown> | null; createdAt: string }
interface Pending { role: string; capability: string; allowed: boolean | null }
interface NeedConfirm { items: { role: string; capability: string }[]; run: () => Promise<void> }

const SPECIALTY_LABEL: Record<string, string> = {
  servico_social: "Assistência Social",
  fonoaudiologia: "Fonoaudiologia",
  psicologia: "Psicologia",
  neuropsicologia: "Neuropsicologia",
};

const cellKey = (cap: string, role: string) => `${cap}|${role}`;

// ─── página ─────────────────────────────────────────────────────────────────

export default function AdminPrivilegesPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [scope, setScope] = useState<string>("global");
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [pending, setPending] = useState<Record<string, boolean | null>>({});
  const [tab, setTab] = useState<"perfil" | "pessoa" | "historico">("perfil");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<NeedConfirm | null>(null);
  const [reason, setReason] = useState("");

  // pessoa
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [personBusy, setPersonBusy] = useState<string | null>(null);

  // histórico
  const [events, setEvents] = useState<AuditEvent[]>([]);

  const capByKey = useMemo(() => new Map((catalog?.capabilities ?? []).map((c) => [c.key, c])), [catalog]);

  const loadMatrix = useCallback(async (s: string) => {
    try {
      setMatrix(await api.get<Matrix>(`/api/admin/privileges/matrix?scope=${s}`));
      setPending({});
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar a matriz.");
    }
  }, []);

  useEffect(() => {
    api.get<Catalog>("/api/admin/privileges/catalog").then(setCatalog).catch((e) =>
      setError(e instanceof ApiError ? e.message : "Não foi possível carregar o catálogo de privilégios.")
    );
  }, []);

  useEffect(() => {
    void loadMatrix(scope);
  }, [scope, loadMatrix]);

  const searchPeople = useCallback(async (q: string) => {
    try {
      const r = await api.get<{ users: PersonRow[] }>(`/api/admin/privileges/users?q=${encodeURIComponent(q)}`);
      setPeople(r.users);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível buscar pessoas.");
    }
  }, []);

  useEffect(() => {
    if (tab === "pessoa") void searchPeople(query);
    if (tab === "historico") {
      api.get<{ events: AuditEvent[] }>("/api/admin/privileges/audit").then((r) => setEvents(r.events)).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── matriz por perfil ────────────────────────────────────────────────────

  const cellOf = (cap: string, role: string): MatrixCell | undefined =>
    matrix?.cells.find((c) => c.capability === cap)?.byRole[role];

  const baseline = (c: MatrixCell) => c.inherited ?? c.default;

  const shown = (cap: string, role: string): { checked: boolean; indeterminate: boolean; changed: boolean; pendingDirty: boolean } => {
    const c = cellOf(cap, role);
    if (!c) return { checked: false, indeterminate: false, changed: false, pendingDirty: false };
    const p = pending[cellKey(cap, role)];
    if (p !== undefined) {
      const v = p === null ? baseline(c) : p;
      return { checked: v, indeterminate: false, changed: p !== null, pendingDirty: true };
    }
    return {
      checked: c.effective,
      indeterminate: c.partial,
      changed: c.override !== null,
      pendingDirty: false,
    };
  };

  const toggle = (cap: string, role: string) => {
    const c = cellOf(cap, role);
    if (!c) return;
    const cur = shown(cap, role).checked;
    const next = !cur;
    const key = cellKey(cap, role);
    // Voltou ao que já está salvo? Descarta a alteração pendente.
    const stored = c.override;
    const nextPending: boolean | null = next === baseline(c) && !c.partial ? null : next;
    setPending((prev) => {
      const copy = { ...prev };
      const same = nextPending === stored;
      if (same) delete copy[key];
      else copy[key] = nextPending;
      return copy;
    });
    setOk(null);
  };

  const pendingList: Pending[] = Object.entries(pending).map(([k, allowed]) => {
    const [capability, role] = k.split("|");
    return { capability, role, allowed };
  });

  const save = async (confirmSensitive = false) => {
    if (pendingList.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/admin/privileges/roles", {
        changes: pendingList.map((p) => ({ scope, role: p.role, capability: p.capability, allowed: p.allowed })),
        confirmSensitive,
        reason: reason.trim() || undefined,
      });
      setConfirm(null);
      setReason("");
      setOk(`${pendingList.length} alteração(ões) salva(s). Já valem na próxima ação de cada pessoa.`);
      await loadMatrix(scope);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.body as { needsConfirmation?: boolean })?.needsConfirmation) {
        const items = ((e.body as { sensitive?: { role: string; capability: string }[] }).sensitive ?? []);
        setConfirm({ items, run: () => save(true) });
      } else {
        setError(e instanceof ApiError ? e.message : "Não foi possível salvar.");
      }
    } finally {
      setSaving(false);
    }
  };

  const resetScope = async () => {
    if (!matrix) return;
    const changes: { scope: string; role: string; capability: string; allowed: null }[] = [];
    for (const row of matrix.cells) {
      for (const [role, cell] of Object.entries(row.byRole)) {
        if (cell.override !== null) changes.push({ scope, role, capability: row.capability, allowed: null });
      }
    }
    if (changes.length === 0) {
      setOk("Nada para restaurar: este escopo já está no padrão de fábrica.");
      return;
    }
    if (!window.confirm(`Voltar ${changes.length} caixinha(s) ao padrão de fábrica neste escopo?`)) return;
    setSaving(true);
    try {
      await api.put("/api/admin/privileges/roles", { changes, reason: "restaurar padrão" });
      setOk("Padrão de fábrica restaurado.");
      await loadMatrix(scope);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível restaurar.");
    } finally {
      setSaving(false);
    }
  };

  // ── por pessoa ───────────────────────────────────────────────────────────

  const openPerson = async (id: string) => {
    try {
      setPerson(await api.get<PersonDetail>(`/api/admin/privileges/users/${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível abrir a pessoa.");
    }
  };

  const setPersonCap = async (cap: PersonCap, allowed: boolean | null, confirmSensitive = false) => {
    if (!person) return;
    setPersonBusy(cap.key);
    setError(null);
    try {
      await api.put(`/api/admin/privileges/users/${person.user.id}`, { capability: cap.key, allowed, confirmSensitive });
      await openPerson(person.user.id);
      setOk("Exceção da pessoa salva.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && (e.body as { needsConfirmation?: boolean })?.needsConfirmation) {
        if (window.confirm(`"${cap.label}" é dado sensível. Liberar mesmo assim para ${person.user.name}? A mudança fica registrada na auditoria.`)) {
          setPersonBusy(null);
          return setPersonCap(cap, allowed, true);
        }
      } else {
        setError(e instanceof ApiError ? e.message : "Não foi possível salvar.");
      }
    } finally {
      setPersonBusy(null);
    }
  };

  // ── render ───────────────────────────────────────────────────────────────

  const roles = catalog?.roles ?? [];
  const groups = catalog?.groups ?? [];
  const dirty = pendingList.length;
  const scopeName = scope === "global" ? "todas as redes" : (catalog?.tenants.find((t) => t.id === scope)?.name ?? "rede");

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-black p-4 sm:p-6 md:p-10 font-sans">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col gap-3 pb-6 border-b border-[#E1E9ED]">
          <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-black w-fit">
            <ArrowLeft className="w-3.5 h-3.5" /> Usuários & Perfis
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-700 border border-blue-500/30">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Administrador Master
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">Privilégios do piloto</h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            Marque o que cada perfil pode ver e fazer. A mudança vale na próxima ação de cada pessoa. Isolamento entre redes e escolas
            continua valendo sempre, mesmo com a caixinha marcada. Tudo fica registrado na auditoria.
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Fechar aviso">✕</button>
          </div>
        )}
        {ok && (
          <div role="status" className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-sm flex justify-between">
            <span>{ok}</span>
            <button onClick={() => setOk(null)} aria-label="Fechar aviso">✕</button>
          </div>
        )}

        <div role="tablist" aria-label="Modo de configuração" className="mt-6 flex gap-2 flex-wrap">
          {([
            ["perfil", "Por perfil"],
            ["pessoa", "Por pessoa (exceções)"],
            ["historico", "Histórico de mudanças"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                tab === k ? "bg-ceu-100 border-ceu-700 text-black" : "bg-white border-[#E1E9ED] text-slate-700 hover:bg-[#F0F9FC]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ───────── Por perfil ───────── */}
        {tab === "perfil" && (
          <section className="mt-6" aria-label="Matriz de privilégios por perfil">
            <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between bg-white p-4 rounded-2xl border border-[#E1E9ED]">
              <div className="flex flex-col gap-1">
                <label htmlFor="scope" className="text-xs font-semibold text-slate-700">Vale para</label>
                <select
                  id="scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  disabled={dirty > 0}
                  className="px-3 py-2 rounded-xl bg-white border border-[#E1E9ED] text-sm min-w-64"
                >
                  <option value="global">Todas as redes (regra geral)</option>
                  {catalog?.tenants.map((t) => (
                    <option key={t.id} value={t.id}>Só a rede: {t.name}</option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500">A regra de uma rede específica vence a regra geral. {dirty > 0 && "Salve ou descarte para trocar de escopo."}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPending({})}
                  disabled={dirty === 0 || saving}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#F0F9FC] border border-[#E1E9ED] disabled:opacity-40"
                >
                  Descartar
                </button>
                <button
                  onClick={resetScope}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-[#E1E9ED] hover:bg-[#F0F9FC] disabled:opacity-40"
                >
                  <RotateCcw className="w-4 h-4" /> Voltar tudo ao padrão
                </button>
                <button
                  onClick={() => save(false)}
                  disabled={dirty === 0 || saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl bg-ceu-100 border border-ceu-700 hover:bg-ceu-300 disabled:opacity-40"
                >
                  <Save className="w-4 h-4" /> {saving ? "Salvando…" : `Salvar${dirty ? ` (${dirty})` : ""}`}
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-600" aria-label="Legenda">
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />diferente do padrão de fábrica</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />alteração ainda não salva</span>
              <span><ShieldAlert className="inline w-3 h-3 text-rose-600 mr-1" />dado sensível: pede confirmação ao liberar</span>
              <span><Lock className="inline w-3 h-3 mr-1" />exclusivo do Administrador Master</span>
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E1E9ED] bg-white">
              <table className="w-full text-sm border-collapse min-w-[1100px]">
                <thead className="sticky top-0 z-10 bg-[#F0F9FC]">
                  <tr>
                    <th scope="col" className="text-left p-3 font-semibold w-[34%]">O que a pessoa pode</th>
                    {roles.map((r) => (
                      <th key={r.key} scope="col" className="p-2 text-center font-semibold text-xs leading-tight align-bottom">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!catalog || !matrix ? (
                    <tr><td colSpan={roles.length + 1} className="p-10 text-center text-slate-600">Carregando…</td></tr>
                  ) : (
                    groups.map((g) => {
                      const caps = catalog.capabilities.filter((c) => c.group === g.key);
                      if (caps.length === 0) return null;
                      return (
                        <Fragment key={g.key}>
                          <tr className="bg-[#F6F9FB]">
                            <th colSpan={roles.length + 1} scope="colgroup" className="text-left px-3 py-2 text-xs uppercase tracking-wider text-slate-600">
                              {g.label}
                            </th>
                          </tr>
                          {caps.map((cap) => (
                            <tr key={cap.key} className="border-t border-[#EEF3F6] hover:bg-[#FAFCFD]">
                              <th scope="row" className="text-left p-3 font-normal align-top">
                                <div className="flex items-start gap-1.5">
                                  {cap.locked && <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-label="Exclusivo do Administrador Master" />}
                                  {cap.sensitive && <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600" aria-label="Dado sensível" />}
                                  <div>
                                    <div className="font-semibold">{cap.label}</div>
                                    <div className="text-[11px] text-slate-500">{cap.description}</div>
                                  </div>
                                </div>
                              </th>
                              {roles.map((r) => {
                                const s = shown(cap.key, r.key);
                                const cell = cellOf(cap.key, r.key);
                                const disabled = cap.locked || saving;
                                const specialtyHint =
                                  r.key === "specialist" && cap.defaultSpecialties
                                    ? `Padrão: só ${cap.defaultSpecialties.map((x) => SPECIALTY_LABEL[x] ?? x).join(" e ")}. Marcar libera para todas as especialidades.`
                                    : "";
                                return (
                                  <td key={r.key} className="p-2 text-center">
                                    <label className="inline-flex items-center justify-center relative cursor-pointer min-w-8 min-h-8">
                                      <input
                                        type="checkbox"
                                        className="w-5 h-5 accent-[#682880] disabled:opacity-50"
                                        checked={s.checked}
                                        disabled={disabled}
                                        ref={(el) => {
                                          if (el) el.indeterminate = s.indeterminate;
                                        }}
                                        onChange={() => toggle(cap.key, r.key)}
                                        aria-label={`${r.label} — ${cap.label}`}
                                        title={
                                          cap.locked
                                            ? "Exclusivo do Administrador Master"
                                            : `${specialtyHint} Padrão de fábrica: ${cell?.default ? "marcado" : "desmarcado"}`.trim()
                                        }
                                      />
                                      {s.pendingDirty ? (
                                        <span aria-hidden className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500" />
                                      ) : s.changed ? (
                                        <span aria-hidden className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
                                      ) : null}
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Editando: <strong>{scopeName}</strong>. A caixinha “meio marcada” no perfil Especialista significa “depende da especialidade” (padrão do piloto).
            </p>
          </section>
        )}

        {/* ───────── Por pessoa ───────── */}
        {tab === "pessoa" && (
          <section className="mt-6 grid gap-4 lg:grid-cols-[340px_1fr]" aria-label="Exceções por pessoa">
            <div className="bg-white rounded-2xl border border-[#E1E9ED] p-4 h-fit">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchPeople(query);
                }}
                className="flex gap-2"
              >
                <label htmlFor="q" className="sr-only">Buscar pessoa por nome ou e-mail</label>
                <input
                  id="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nome ou e-mail"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#E1E9ED] text-sm"
                />
                <button className="px-3 py-2 rounded-xl bg-ceu-100 border border-ceu-700" aria-label="Buscar">
                  <Search className="w-4 h-4" />
                </button>
              </form>
              <ul className="mt-3 max-h-[60vh] overflow-y-auto divide-y divide-[#EEF3F6]">
                {people.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Ninguém encontrado.</li>}
                {people.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => openPerson(p.id)}
                      className={`w-full text-left py-2.5 px-2 rounded-lg hover:bg-[#F0F9FC] ${person?.user.id === p.id ? "bg-[#F0F9FC]" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-sm">{p.name}</span>
                        {p.overrides > 0 && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            {p.overrides} exceção(ões)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 pl-6">{p.roleLabel}{p.schoolName ? ` · ${p.schoolName}` : ""}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-[#E1E9ED] p-4">
              {!person ? (
                <p className="p-10 text-center text-sm text-slate-500">Escolha uma pessoa à esquerda para liberar ou bloquear algo só para ela.</p>
              ) : (
                <>
                  <div className="pb-3 border-b border-[#E1E9ED]">
                    <h2 className="text-lg font-bold">{person.user.name}</h2>
                    <p className="text-xs text-slate-600">{person.user.email} · {person.user.roleLabel}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      A caixinha mostra o que a pessoa <strong>pode hoje</strong>. Mudar cria uma exceção só dela; “voltar ao padrão” remove a exceção.
                    </p>
                  </div>
                  {groups.map((g) => {
                    const caps = person.capabilities.filter((c) => c.group === g.key);
                    if (caps.length === 0) return null;
                    return (
                      <div key={g.key} className="mt-4">
                        <h3 className="text-xs uppercase tracking-wider text-slate-600 mb-1">{g.label}</h3>
                        <ul className="divide-y divide-[#EEF3F6]">
                          {caps.map((c) => (
                            <li key={c.key} className="py-2 flex items-start gap-3">
                              <input
                                id={`pc-${c.key}`}
                                type="checkbox"
                                className="mt-1 w-5 h-5 accent-[#682880]"
                                checked={c.effective}
                                disabled={c.locked || personBusy === c.key}
                                onChange={() => setPersonCap(c, !c.effective)}
                              />
                              <label htmlFor={`pc-${c.key}`} className="flex-1 cursor-pointer">
                                <div className="text-sm font-semibold flex items-center gap-1.5">
                                  {c.locked && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                                  {c.sensitive && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                                  {c.label}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {c.description}
                                  {" · "}
                                  {c.source === "user" ? (
                                    <span className="text-amber-700 font-semibold">exceção desta pessoa</span>
                                  ) : c.source === "role" ? (
                                    "regra do perfil"
                                  ) : c.source === "locked" ? (
                                    "exclusivo do Administrador Master"
                                  ) : (
                                    "padrão de fábrica"
                                  )}
                                </div>
                              </label>
                              {c.userOverride !== null && (
                                <button
                                  onClick={() => setPersonCap(c, null)}
                                  className="text-xs underline text-slate-600 hover:text-black whitespace-nowrap"
                                >
                                  voltar ao padrão
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </section>
        )}

        {/* ───────── Histórico ───────── */}
        {tab === "historico" && (
          <section className="mt-6 bg-white rounded-2xl border border-[#E1E9ED] overflow-x-auto" aria-label="Histórico de mudanças">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F0F9FC]">
                <tr><th className="p-3">Quando</th><th className="p-3">Quem</th><th className="p-3">O que</th><th className="p-3">Para</th></tr>
              </thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhuma mudança registrada ainda.</td></tr>}
                {events.map((e) => {
                  const p = e.payload ?? {};
                  const cap = capByKey.get(String(p.capability ?? ""));
                  return (
                    <tr key={e.id} className="border-t border-[#EEF3F6]">
                      <td className="p-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="p-3">{e.userEmail ?? "—"}</td>
                      <td className="p-3">
                        {cap?.label ?? String(p.capability ?? "")}
                        {e.action.endsWith(".sensitive") && <ShieldAlert className="inline w-3.5 h-3.5 ml-1 text-rose-600" aria-label="Dado sensível" />}
                        <div className="text-[11px] text-slate-500">
                          {e.action.startsWith("privilege.user_set") ? "exceção por pessoa" : `perfil ${String(p.role ?? "")}`}
                          {p.scope && p.scope !== "global" ? " · rede específica" : ""}
                        </div>
                      </td>
                      <td className="p-3">{p.to === true ? "Liberado" : p.to === false ? "Bloqueado" : "Voltou ao padrão"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {/* Confirmação de dado sensível */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="confirm-title" className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" /> Liberar dado sensível?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Você está liberando informação clínica ou identificável para perfis que não a viam por padrão. Faça isso só com base legal e
              finalidade definidas pelo piloto. A mudança fica na auditoria.
            </p>
            <ul className="mt-3 max-h-40 overflow-y-auto text-sm list-disc pl-5">
              {confirm.items.map((i) => (
                <li key={cellKey(i.capability, i.role)}>
                  <strong>{roles.find((r) => r.key === i.role)?.label ?? i.role}</strong> poderá: {capByKey.get(i.capability)?.label ?? i.capability}
                </li>
              ))}
            </ul>
            <label htmlFor="why" className="mt-4 block text-xs font-semibold">Motivo (opcional, vai para a auditoria)</label>
            <input
              id="why"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-[#E1E9ED] text-sm"
              placeholder="Ex.: acordado com a coordenação do piloto"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#F0F9FC] border border-[#E1E9ED]">
                Cancelar
              </button>
              <button
                onClick={() => void confirm.run()}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              >
                Confirmar e liberar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
