"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useCapabilities, resetMe } from "@/lib/capabilities";
import { BarChart3, MapPinned,
  FileText,
  Stethoscope,
  ShieldCheck,
  Building2,
  LogOut,
  Menu,
  X,
  School,
  Sparkles,
  Search,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  ShieldAlert,
  SlidersHorizontal,
  Activity,
  HelpCircle,
  UserRound,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";
import { ProfessionalConsentModal } from "@/components/dashboard/ProfessionalConsentModal";
import { SupportWidget } from "@/components/dashboard/SupportWidget";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Menu retrátil no desktop: libera largura para os formulários. Lembrado neste navegador.
  const [collapsed, setCollapsed] = useState(false);
  // Tela cheia: esconde o menu por inteiro (desktop) e deixa o conteúdo ocupar toda a largura.
  const [oculto, setOculto] = useState(false);
  const [currentSlug, setCurrentSlug] = useState("demo-escola");
  const { me, has, hasAny, ready } = useCapabilities();
  const userRole = me?.role ?? null;
  // Nome e foto editados em "Meu painel" aparecem aqui na hora, sem recarregar a página.
  const [perfilEditado, setPerfilEditado] = useState<{ name?: string; avatarUrl?: string | null } | null>(null);
  useEffect(() => {
    const aoAtualizar = (e: Event) => setPerfilEditado((e as CustomEvent<{ name?: string; avatarUrl?: string | null }>).detail ?? null);
    window.addEventListener("perfil-atualizado", aoAtualizar);
    return () => window.removeEventListener("perfil-atualizado", aoAtualizar);
  }, []);
  const nomeExibido = perfilEditado?.name ?? me?.name ?? session?.user?.name ?? "Profissional Periscópio";
  const fotoExibida = perfilEditado ? perfilEditado.avatarUrl ?? null : me?.avatarUrl ?? null;

  // Infer slug from URL if user is in /[slug]/...
  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (
      segments.length > 0 &&
      segments[0] !== "dashboard" &&
      segments[0] !== "admin" &&
      segments[0] !== "login"
    ) {
      setCurrentSlug(segments[0]);
    }
  }, [pathname]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("periscopio.menu.recolhido") === "1") setCollapsed(true);
      if (window.localStorage.getItem("periscopio.menu.oculto") === "1") setOculto(true);
    } catch {
      /* sem armazenamento: segue expandido */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("periscopio.menu.recolhido", next ? "1" : "0");
      } catch {
        /* ignorado */
      }
      return next;
    });
  };

  const toggleOculto = () => {
    setOculto((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("periscopio.menu.oculto", next ? "1" : "0");
      } catch {
        /* ignorado */
      }
      return next;
    });
  };

  // Handle ESC key press to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    try {
      await signOut();
      resetMe();
      // Recarrega por completo: nenhum dado do perfil anterior fica na memória do navegador.
      window.location.assign("/login");
    } catch (e) {
      console.error("Erro ao fazer logout", e);
    }
  };

  // O menu segue as CAIXINHAS do Administrador Master (privilégios), não só o perfil.
  const visibleClinical = [
    { show: has("fogap.fill"), label: "Avaliação RE (FOGAP)", href: `/${currentSlug}/dashboard/re`, icon: FileText, badge: "RE" },
    { show: has("management.view"), label: "Sumário e encaminhados", href: `/${currentSlug}/dashboard/gestao`, icon: ClipboardList },
    { show: has("case.delegate"), label: "Painel Médico", href: `/${currentSlug}/dashboard/medico`, icon: Stethoscope, badge: "MD1" },
    { show: has("section.read"), label: "Portal do Especialista", href: `/${currentSlug}/dashboard/especialista`, icon: Stethoscope, badge: "Parecer" },
    { show: hasAny(["board.request", "board.manage"]), label: "Agenda do Board", href: `/${currentSlug}/dashboard/agenda`, icon: CalendarClock, badge: "Board" },
    { show: hasAny(["pilot.indicators.view", "pilot.indicators.case.view"]), label: "Indicadores do piloto", href: `/${currentSlug}/dashboard/indicadores`, icon: Activity },
    { show: has("bi.view"), label: "BI do gestor", href: `/${currentSlug}/dashboard/bi`, icon: BarChart3 },
    { show: has("population.view"), label: "Mapa de prevalência", href: `/${currentSlug}/dashboard/mapa`, icon: MapPinned },
  ]
    .filter((i) => i.show)
    .map(({ show: _s, ...rest }) => ({ badge: undefined as string | undefined, ...rest, exact: false }));
  const isSuper =
    userRole === "admin_platform" ||
    userRole === "adm_master" ||
    session?.user?.email === "bruno@oceanoazul.dev.br" ||
    (session?.user?.email ? session.user.email.endsWith("@oceanoazul.dev.br") : false);

  const visibleAdmin = [
    { show: has("privileges.manage"), label: "Privilégios (caixinhas)", href: "/admin/privileges", icon: SlidersHorizontal },
    { show: has("system.observability.view"), label: "Saúde do sistema", href: "/admin/saude", icon: Activity },
    { show: has("users.manage") || isSuper, label: "Usuários & Perfis", href: "/admin/users", icon: ShieldCheck },
    { show: has("lgpd.manage") || isSuper, label: "Governança & DPO LGPD", href: "/admin/lgpd", icon: ShieldCheck },
    { show: isSuper, label: "Suporte & Chamados", href: "/admin/suporte", icon: HelpCircle },
    { show: isSuper, label: "Boletins & Newsletter", href: "/admin/newsletter", icon: FileText },
    { show: has("schools.provision") || isSuper, label: "Provisionar Escola", href: "/admin/setup", icon: Building2 },
  ]
    .filter((i) => i.show)
    .map(({ show: _s, ...rest }) => ({ badge: undefined as string | undefined, ...rest, exact: false }));

  // Bloqueio de navegação por privilégio (a API é quem decide de verdade; isto só evita uma tela vazia).
  const requiredForRoute = (path: string): string[] | null => {
    if (path.includes("/dashboard/re")) return ["fogap.fill", "fogap.read"];
    if (path.includes("/dashboard/medico")) return ["case.delegate", "prontuario.consolidado.read"];
    if (path.includes("/dashboard/especialista")) return ["section.read"];
    if (path.includes("/dashboard/gestao")) return ["management.view"];
    if (path.includes("/dashboard/agenda")) return ["board.request", "board.manage"];
    if (path.includes("/dashboard/indicadores")) return ["pilot.indicators.view", "pilot.indicators.case.view"];
    if (path.includes("/dashboard/bi")) return ["bi.view"];
    if (path.includes("/dashboard/mapa")) return ["population.view"];
    if (path.startsWith("/admin/privileges")) return ["privileges.manage"];
    if (path.startsWith("/admin/saude")) return ["system.observability.view"];
    if (path.startsWith("/admin/users")) return ["users.manage"];
    if (path.startsWith("/admin/lgpd")) return ["lgpd.manage"];
    if (path.startsWith("/admin/setup")) return ["schools.provision"];
    return null;
  };

  const needed = requiredForRoute(pathname);
  const isBlocked = ready && !!me && !isSuper && !!needed && !hasAny(needed);

  // "Meu painel" existe para todo perfil, inclusive o professor, que não tem outra tela nesta versão.
  const minhaConta = ready && me
    ? [{ group: "Minha conta", items: [{ label: "Meu painel", href: `/${currentSlug}/dashboard/meu-painel`, icon: UserRound, badge: undefined as string | undefined, exact: false }] }]
    : [];

  const navItems = [
    ...minhaConta,
    ...(visibleClinical.length > 0 ? [{ group: "Fluxo Clínico", items: visibleClinical }] : []),
    ...(visibleAdmin.length > 0 ? [{ group: "Administração", items: visibleAdmin }] : []),
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href.split("#")[0]);
  };

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-black flex flex-col md:flex-row font-sans">
      {/* Mobile First Sticky Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#E1E9ED] sticky top-0 z-40 shadow-sm">
        <Link href="/" aria-label="Periscópio — início" className="flex items-center gap-2">
          <img src="/equipe/logo.webp" alt="Logo do Periscópio" className="h-9 w-auto" />
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-black bg-[#682880]/10 px-2 py-0.5 rounded-full border border-[#682880]/20">
            NEMT
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 text-black hover:text-black rounded-xl bg-[#F0F9FC] border border-[#E1E9ED] transition active:scale-95"
            aria-label={mobileMenuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Overlay Backdrop for Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-200/70 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation Drawer (Mobile First) */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 max-w-[85vw] md:max-w-none ${collapsed ? "md:w-[68px]" : "md:w-72"} bg-white border-r border-[#E1E9ED]
          flex flex-col justify-between shadow-2xl md:shadow-sm
          transform transition-all duration-300 ease-in-out md:overflow-hidden
          ${oculto ? "md:hidden" : ""}
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo no Canto Superior + Botão Fechar no Mobile */}
          <div className={`p-5 border-b border-[#E1E9ED] ${collapsed ? "md:p-3" : ""}`}>
            <div className="flex items-center justify-between">
              <Link href="/" aria-label="Periscópio — início" className={`block ${collapsed ? "md:mx-auto" : ""}`}>
                <img
                  src="/equipe/logo.webp"
                  alt="Logo do Periscópio Saúde"
                  className={`h-10 object-contain hover:opacity-90 transition-opacity ${collapsed ? "md:w-9 md:object-left md:h-9" : "w-auto"}`}
                />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-neutral-800 hover:text-black hover:bg-[#F0F9FC]"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`mt-3 flex items-center justify-between ${collapsed ? "md:hidden" : ""}`}>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-black bg-[#682880]/10 px-2.5 py-1 rounded-full border border-[#682880]/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Protocolo NEMT Escolar
              </span>
            </div>

            {/* School / Tenant Switcher Info */}
            <div className={`mt-3 p-2.5 rounded-xl bg-[#F0F9FC] border border-[#E1E9ED] flex items-center justify-between ${collapsed ? "md:hidden" : ""}`}>
              <div className="flex items-center gap-2 overflow-hidden">
                <School className="w-4 h-4 text-black shrink-0" />
                <span className="text-xs font-bold text-black truncate">
                  {currentSlug === "demo-escola" ? "Escola Municipal Demo" : currentSlug}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className={`p-4 flex-1 space-y-6 ${collapsed ? "md:p-2" : ""}`}>
            {navItems.map((group) => (
              <div key={group.group}>
                <h3 className={`px-3 text-[11px] font-extrabold uppercase tracking-wider text-neutral-800 mb-2 ${collapsed ? "md:hidden" : ""}`}>
                  {group.group}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href, item.exact);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        title={collapsed ? item.label : undefined}
                        aria-label={item.label}
                        className={`
                          ${collapsed ? "md:justify-center md:px-2" : ""}
                          flex items-center justify-between px-3.5 py-3 md:py-2.5 rounded-xl text-sm font-semibold transition-all group
                          ${
                            active
                              ? "bg-roxo-100 border border-roxo text-black shadow-sm"
                              : "text-neutral-800 hover:text-black hover:bg-[#F0F9FC]"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-5 h-5 md:w-4 md:h-4 transition-colors ${
                              active ? "text-black" : "text-neutral-800 group-hover:text-black"
                            }`}
                          />
                          <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`${collapsed ? "md:hidden" : ""} text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              active
                                ? "bg-white/20 text-black border-white/30"
                                : "bg-[#F0F9FC] text-neutral-800 border-[#E1E9ED]"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quick Access Card */}
            <div className={`p-3.5 rounded-2xl bg-[#F0F9FC] border border-[#E1E9ED] ${collapsed ? "md:hidden" : ""}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <Sparkles className="w-4 h-4 text-black" />
                <span>Janela Terapêutica</span>
              </div>
              <p className="text-[11px] text-neutral-800 mt-1 leading-relaxed">
                Acompanhamento de 120 dias e triagem precoce antes do encaminhamento ao SUS.
              </p>
            </div>
          </nav>

          {/* User Profile & Footer */}
          <div className={`p-4 border-t border-[#E1E9ED] bg-[#FAFCFE] ${collapsed ? "md:p-2" : ""}`}>
            <div className={`flex items-center justify-between ${collapsed ? "md:flex-col md:gap-2" : ""}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <Link href={`/${currentSlug}/dashboard/meu-painel`} aria-label="Abrir Meu painel" title="Meu painel" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roxo focus-visible:ring-offset-2">
                  <Avatar nome={nomeExibido} url={fotoExibida} tamanho="sm" />
                </Link>
                <div className={`overflow-hidden ${collapsed ? "md:hidden" : ""}`}>
                  <div className="text-xs font-bold text-black truncate">
                    {nomeExibido}
                  </div>
                  <div className="text-[11px] text-neutral-800 truncate">
                    {session?.user?.email || "Conectado via Neon Auth"}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sair da Conta"
                className="p-2 rounded-lg text-neutral-800 hover:text-black hover:bg-[#FDECEA] transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Utility Header (Desktop) */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white/90 backdrop-blur-md border-b border-[#E1E9ED] sticky top-0 z-30 shadow-sm">
          <div className="mr-3 flex items-center gap-2">
            {!oculto && (
              <button
                type="button"
                onClick={toggleCollapsed}
                data-testid="menu-retratil"
                className="p-2.5 rounded-xl bg-[#F0F9FC] border border-[#E1E9ED] text-black hover:bg-[#E1E9ED] transition"
                aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral para ícones"}
                aria-expanded={!collapsed}
                title={collapsed ? "Expandir menu" : "Recolher menu (só ícones)"}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleOculto}
              data-testid="menu-tela-cheia"
              className="inline-flex items-center gap-1.5 p-2.5 rounded-xl bg-[#F0F9FC] border border-[#E1E9ED] text-black text-xs font-semibold hover:bg-[#E1E9ED] transition"
              aria-label={oculto ? "Mostrar o menu lateral" : "Tela cheia: esconder o menu lateral"}
              aria-pressed={oculto}
              title={oculto ? "Mostrar o menu" : "Tela cheia (esconde o menu e usa toda a largura)"}
            >
              {oculto ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              <span className="hidden lg:inline">{oculto ? "Mostrar menu" : "Tela cheia"}</span>
            </button>
          </div>
          <div className="flex items-center gap-3 w-96 bg-[#F6F9FB] border border-[#E1E9ED] rounded-xl px-3 py-2 text-xs text-black">
            <Search className="w-4 h-4 text-neutral-800" />
            <input
              type="text"
              placeholder="Buscar aluno (ID LGPD), protocolo ou parecer..."
              className="bg-transparent border-none outline-none w-full text-black placeholder-[#5B6B78]"
            />
          </div>

          <div className="flex items-center gap-3">
            <NotificationCenter />
            {/* Só aparece para quem pode cadastrar aluno e abrir caso (RE). */}
            {has("student.register") && has("fogap.fill") && (
              <Link
                href={`/${currentSlug}/dashboard/re`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-roxo-100 border border-roxo hover:bg-roxo-200 text-black shadow-sm transition"
              >
                <span>+ Novo Prontuário</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-support-widget", { detail: { tab: "rag" } }));
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F0F9FC] hover:bg-[#E1E9ED] text-black border border-[#E1E9ED] transition cursor-pointer"
              title="Central de Suporte & Autoatendimento com IA RAG"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#007A99]" />
              <span>Suporte</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className={`flex-1 p-4 md:p-8 mx-auto w-full ${oculto ? "max-w-none md:px-6" : collapsed ? "max-w-[1600px]" : "max-w-7xl"}`}>
          {isBlocked ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md mx-auto text-center shadow-sm space-y-4 my-12 animate-fadeIn">
              <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-black">Acesso Restrito por Perfil</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Este painel é restrito aos papéis funcionais autorizados. Seu perfil não possui privilégios de acesso a esta seção.
              </p>
              <button
                onClick={() => router.push(`/${currentSlug}/dashboard`)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#682880] text-white hover:bg-[#531e66] transition"
              >
                Ir para o Painel Autorizado
              </button>
            </div>
          ) : (
            <>
              <ProfessionalConsentModal />
              {children}
            </>
          )}
        </div>
      </main>
      <SupportWidget />
    </div>
  );
}
