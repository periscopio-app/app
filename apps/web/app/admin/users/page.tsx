"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  cpf: string | null;
  classCode: string | null;
  specialty: string | null;
  tenantId: string;
  schoolId: string | null;
  schoolName: string | null;
  tenantName: string | null;
  createdAt: string;
}

interface RoleDefinition {
  role: string;
  title: string;
  description: string;
  level: string;
  permissions: string[];
}

const DEFAULT_ROLES: RoleDefinition[] = [
  {
    role: "admin_platform",
    title: "Administrador Master (Plataforma)",
    description: "Acesso total e irrestrito. Pode criar usuários, definir perfis, alterar privilégios e visualizar todas as instâncias e dados da plataforma.",
    level: "master",
    permissions: ["Acesso Global", "Gestão de Usuários e Privilégios", "Todas as Escolas", "Todos os Casos"],
  },
  {
    role: "municipal_manager",
    title: "Gestor(a) Municipal",
    description: "Acesso à rede municipal de ensino. Visualiza relatórios consolidados e indicadores agregados de saúde mental escolar.",
    level: "gestao",
    permissions: ["Visualização Municipal", "Relatórios e Indicadores", "Escolas do Município"],
  },
  {
    role: "school_manager",
    title: "Gestor(a) Escolar / Diretor(a)",
    description: "Coordena a unidade escolar. Recebe fichas de observação de professores e despacha para a triagem técnica.",
    level: "escola",
    permissions: ["Gestão da Unidade", "Revisão de Fichas", "Equipe Escolar"],
  },
  {
    role: "teacher",
    title: "Professor(a)",
    description: "Registra sinais comportamentais e emocionais na Ficha de Observação Escolar sem emitir diagnóstico médico.",
    level: "escola",
    permissions: ["Criar Fichas de Observação", "Histórico de Observações Próprias"],
  },
  {
    role: "ppi",
    title: "Psicopedagogo(a) / PpI",
    description: "Acolhimento da família e estudante, aplicação de escalas validadas e condução da triagem inicial no protocolo NEMT.",
    level: "clinico",
    permissions: ["Triagem NEMT", "Aplicação de Escalas", "Acolhimento Familiar"],
  },
  {
    role: "md1",
    title: "Médico(a) / MD1",
    description: "Estratificação clínica de gravidade, validação médica e tomada de decisão de encaminhamento responsável ao SUS.",
    level: "clinico",
    permissions: ["Estratificação Médica", "Dossiê Clínico", "Encaminhamento SUS"],
  },
  {
    role: "specialist",
    title: "Especialista Clínico",
    description: "Profissional de área correlata (fonoaudiologia, neuropsicologia, etc.) responsável por pareceres específicos.",
    level: "clinico",
    permissions: ["Parecer Técnico Específico", "Avaliação Multidisciplinar"],
  },
  {
    role: "board",
    title: "Board Científico",
    description: "Supervisão acadêmica e consultoria em casos de alta complexidade com dados pseudonimizados.",
    level: "consultoria",
    permissions: ["Supervisão Acadêmica", "Casos Anonimizados"],
  },
  {
    role: "researcher",
    title: "Pesquisador(a)",
    description: "Acompanhamento acadêmico e análise estatística de dados epidemiológicos anonimizados.",
    level: "pesquisa",
    permissions: ["Acesso a Dados Anonimizados", "Métricas de Impacto"],
  },
];

export default function AdminUsersPage() {
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modal Novo Usuário
  const [modalOpen, setModalOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoRole, setNovoRole] = useState("school_manager");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoConselho, setNovoConselho] = useState("");
  const [novaEspecialidade, setNovaEspecialidade] = useState("");
  const [novaEscola, setNovaEscola] = useState("");
  const [schoolsList, setSchoolsList] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Modal Edição de Perfil
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const ROLES_WITH_SCHOOL = ["ppi", "specialist", "school_manager", "teacher"];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Não foi possível carregar os usuários. Verifique se sua sessão tem perfil de Administrador Master.");
      }
      const data = await res.json();
      setUsersList(data.users || []);
    } catch (err: any) {
      setError(err.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/admin/schools`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setSchoolsList(data.schools || []);
    } catch {
      // não bloqueia o carregamento da página
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSchools();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFeedbackSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: novoNome,
          email: novoEmail,
          role: novoRole,
          password: novaSenha || undefined,
          phone: novoTelefone || undefined,
          classCode: novoConselho || undefined,
          specialty: novaEspecialidade || undefined,
          schoolId: novaEscola || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar usuário.");
      }

      setFeedbackSuccess(`Usuário ${novoEmail} criado com sucesso com perfil ${novoRole}!`);
      setModalOpen(false);
      setNovoNome("");
      setNovoEmail("");
      setNovaSenha("");
      setNovoTelefone("");
      setNovoConselho("");
      setNovaEspecialidade("");
      setNovaEscola("");
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      setError(null);
      const res = await fetch(`${apiUrl}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar perfil.");
      setFeedbackSuccess("Perfil de privilégios atualizado com sucesso!");
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!confirm(`Tem certeza que deseja revogar o acesso de ${user.name} (${user.email})?`)) return;
    try {
      setError(null);
      const res = await fetch(`${apiUrl}/api/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao remover usuário.");
      setFeedbackSuccess(`Acesso de ${user.email} revogado com sucesso.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin_platform":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "md1":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "ppi":
        return "bg-teal-500/20 text-teal-300 border-teal-500/40";
      case "school_manager":
      case "municipal_manager":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-[#f8fafc] p-6 md:p-12 font-sans">
      <div className="mx-auto max-w-6xl">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Painel Master
              </span>
              <span className="text-xs text-slate-400">Controle de Acessos & RBAC</span>
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold font-display">
              Gestão de Usuários & Privilégios
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Usuários Master têm controle irrestrito: visualize tudo, crie novas contas e determine as permissões de acesso ao sistema.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/setup"
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
            >
              Provisionar Escola
            </Link>
            <button
              onClick={() => setModalOpen(true)}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition"
            >
              + Novo Usuário
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {feedbackSuccess && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <span>✓ {feedbackSuccess}</span>
            <button onClick={() => setFeedbackSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}
        {error && (
          <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Filters & Search */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-white/5">
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs text-slate-400 whitespace-nowrap">Filtrar Perfil:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todos os Perfis ({usersList.length})</option>
              {roles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Carregando usuários da plataforma...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">Nenhum usuário encontrado para esta busca.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">Perfil & Privilégios</th>
                    <th className="px-6 py-4">Unidade / Escola</th>
                    <th className="px-6 py-4">Criado em</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((u) => {
                    const roleInfo = roles.find((r) => r.role === u.role);
                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="text-xs text-slate-400">{u.email}</div>
                          {u.classCode && (
                            <div className="text-[11px] text-blue-400 mt-0.5">{u.classCode}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(
                              u.role
                            )}`}
                          >
                            {roleInfo?.title || u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {u.schoolName || (u.role === "admin_platform" ? "Plataforma Global (Todas)" : "Geral")}
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setEditRole(u.role);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                          >
                            Alterar Perfil
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Roles & Privilege Matrix Reference */}
        <div className="mt-12">
          <h2 className="text-lg font-bold font-display text-white mb-4">
            Catálogo de Perfis e Matriz de Privilégios
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <div key={r.role} className="p-5 rounded-2xl border border-white/10 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleBadgeColor(r.role)}`}>
                    {r.role}
                  </span>
                  <span className="text-[11px] text-slate-500 uppercase">{r.level}</span>
                </div>
                <h3 className="mt-3 font-semibold text-white text-sm">{r.title}</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{r.description}</p>
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-1.5">
                  {r.permissions.map((p) => (
                    <span key={p} className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                      ✓ {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Novo Usuário */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#121826] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">Criar Novo Usuário</h3>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCreateUser} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Ex: Dra. Mariana Silva"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Institucional *</label>
                  <input
                    type="email"
                    required
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="mariana@escola.gov.br"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Perfil & Privilégios *</label>
                  <select
                    value={novoRole}
                    onChange={(e) => setNovoRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {roles.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.title} ({r.role})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {roles.find((r) => r.role === novoRole)?.description}
                  </p>
                </div>

                {ROLES_WITH_SCHOOL.includes(novoRole) && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Escola / Unidade <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={novaEscola}
                      onChange={(e) => setNovaEscola(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione a escola...</option>
                      {schoolsList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Senha Inicial
                      <span className="ml-1 text-slate-500 font-normal">(deixe vazio para gerar)</span>
                    </label>
                    <input
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={novoTelefone}
                      onChange={(e) => setNovoTelefone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Registro de Classe (CRM, CRP)</label>
                    <input
                      type="text"
                      value={novoConselho}
                      onChange={(e) => setNovoConselho(e.target.value)}
                      placeholder="Ex: CRM-SP 12345"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Especialidade Clínica</label>
                    <input
                      type="text"
                      value={novaEspecialidade}
                      onChange={(e) => setNovaEspecialidade(e.target.value)}
                      placeholder="Ex: Psiquiatria Infantil"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50"
                  >
                    {submitting ? "Criando..." : "Salvar Usuário"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Alterar Perfil */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#121826] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Alterar Perfil de Acesso</h3>
              <p className="mt-1 text-sm text-slate-400">
                Usuário: <strong>{editingUser.name}</strong> ({editingUser.email})
              </p>

              <div className="mt-6">
                <label className="block text-xs font-semibold text-slate-300 mb-2">Novo Perfil / Privilégio</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {roles.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.title} ({r.role})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-400">
                  {roles.find((r) => r.role === editRole)?.description}
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateRole(editingUser.id, editRole)}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg"
                >
                  Confirmar Alteração
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
