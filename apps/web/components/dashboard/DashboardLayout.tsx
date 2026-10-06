"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { api } from "@/lib/api";
import {
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
} from "lucide-react";
import { NotificationCenter } from "@/components/dashboard/NotificationCenter";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentSlug, setCurrentSlug] = useState("demo-escola");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ user: { role: string } }>("/api/me")
      .then(({ user }) => setUserRole(user.role))
      .catch(() => null);
  }, []);

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
      router.push("/login");
    } catch (e) {
      console.error("Erro ao fazer logout", e);
    }
  };

  const clinicalItems = [
    { role: "ppi", label: "Avaliação RE (FOGAP)", href: `/${currentSlug}/dashboard/re`, icon: FileText, badge: "RE" },
    { role: "school_manager", label: "Avaliação RE (FOGAP)", href: `/${currentSlug}/dashboard/re`, icon: FileText, badge: "RE" },
    { role: "md1", label: "Painel Médico", href: `/${currentSlug}/dashboard/medico`, icon: Stethoscope, badge: "MD1" },
    { role: "specialist", label: "Portal do Especialista", href: `/${currentSlug}/dashboard/especialista`, icon: Stethoscope, badge: "Parecer" },
  ];

  const visibleClinical = userRole
    ? clinicalItems.filter((i) => i.role === userRole).map(({ role: _r, ...rest }) => ({ ...rest, exact: false }))
    : [];

  const visibleAdmin = userRole === "admin_platform"
    ? [
        { label: "Usuários & Privilégios", href: "/admin/users", icon: ShieldCheck, badge: "Master", exact: false },
        { label: "Provisionar Escola", href: "/admin/setup", icon: Building2, badge: "Setup", exact: false },
      ]
    : [];

  const navItems = [
    ...(visibleClinical.length > 0 ? [{ group: "Fluxo Clínico", items: visibleClinical }] : []),
    ...(visibleAdmin.length > 0 ? [{ group: "Administração", items: visibleAdmin }] : []),
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href.split("#")[0]);
  };

  return (
    <div className="min-h-screen bg-[#F6F9FB] text-[#14202B] flex flex-col md:flex-row font-sans">
      {/* Mobile First Sticky Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#E1E9ED] sticky top-0 z-40 shadow-sm">
        <Link href="/" aria-label="Periscópio — início" className="flex items-center gap-2">
          <img src="/equipe/logo.webp" alt="Logo do Periscópio" className="h-9 w-auto" />
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#682880] bg-[#682880]/10 px-2 py-0.5 rounded-full border border-[#682880]/20">
            NEMT
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 text-[#14202B] hover:text-[#682880] rounded-xl bg-[#F0F9FC] border border-[#E1E9ED] transition active:scale-95"
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation Drawer (Mobile First) */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 max-w-[85vw] md:max-w-none md:w-72 bg-white border-r border-[#E1E9ED]
          flex flex-col justify-between shadow-2xl md:shadow-sm
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo no Canto Superior + Botão Fechar no Mobile */}
          <div className="p-5 border-b border-[#E1E9ED]">
            <div className="flex items-center justify-between">
              <Link href="/" aria-label="Periscópio — início" className="block">
                <img
                  src="/equipe/logo.webp"
                  alt="Logo do Periscópio Saúde"
                  className="h-10 w-auto object-contain hover:opacity-90 transition-opacity"
                />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-[#5B6B78] hover:text-[#14202B] hover:bg-[#F0F9FC]"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#682880] bg-[#682880]/10 px-2.5 py-1 rounded-full border border-[#682880]/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Protocolo NEMT Escolar
              </span>
            </div>

            {/* School / Tenant Switcher Info */}
            <div className="mt-3 p-2.5 rounded-xl bg-[#F0F9FC] border border-[#E1E9ED] flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <School className="w-4 h-4 text-[#682880] shrink-0" />
                <span className="text-xs font-bold text-[#14202B] truncate">
                  {currentSlug === "demo-escola" ? "Escola Municipal Demo" : currentSlug}
                </span>
              </div>
              <span className="text-[10px] text-[#5B6B78] uppercase font-mono font-bold">Tenant</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex-1 space-y-6">
            {navItems.map((group) => (
              <div key={group.group}>
                <h3 className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#5B6B78] mb-2">
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
                        className={`
                          flex items-center justify-between px-3.5 py-3 md:py-2.5 rounded-xl text-sm font-semibold transition-all group
                          ${
                            active
                              ? "bg-[#682880] text-white shadow-sm"
                              : "text-[#5B6B78] hover:text-[#14202B] hover:bg-[#F0F9FC]"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-5 h-5 md:w-4 md:h-4 transition-colors ${
                              active ? "text-white" : "text-[#5B6B78] group-hover:text-[#682880]"
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              active
                                ? "bg-white/20 text-white border-white/30"
                                : "bg-[#F0F9FC] text-[#5B6B78] border-[#E1E9ED]"
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
            <div className="p-3.5 rounded-2xl bg-[#F0F9FC] border border-[#E1E9ED]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#682880]">
                <Sparkles className="w-4 h-4 text-[#682880]" />
                <span>Janela Terapêutica</span>
              </div>
              <p className="text-[11px] text-[#5B6B78] mt-1 leading-relaxed">
                Acompanhamento de 120 dias e triagem precoce antes do encaminhamento ao SUS.
              </p>
            </div>
          </nav>

          {/* User Profile & Footer */}
          <div className="p-4 border-t border-[#E1E9ED] bg-[#FAFCFE]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-[#682880] text-white font-bold flex items-center justify-center shrink-0 text-sm shadow-sm">
                  {session?.user?.name ? session.user.name[0].toUpperCase() : "P"}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-[#14202B] truncate">
                    {session?.user?.name || "Profissional Periscópio"}
                  </div>
                  <div className="text-[11px] text-[#5B6B78] truncate">
                    {session?.user?.email || "Conectado via Neon Auth"}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sair da Conta"
                className="p-2 rounded-lg text-[#5B6B78] hover:text-[#B42318] hover:bg-[#FDECEA] transition"
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
          <div className="flex items-center gap-3 w-96 bg-[#F6F9FB] border border-[#E1E9ED] rounded-xl px-3 py-2 text-xs text-[#14202B]">
            <Search className="w-4 h-4 text-[#5B6B78]" />
            <input
              type="text"
              placeholder="Buscar aluno (ID LGPD), protocolo ou parecer..."
              className="bg-transparent border-none outline-none w-full text-[#14202B] placeholder-[#5B6B78]"
            />
          </div>

          <div className="flex items-center gap-3">
            <NotificationCenter />
            <Link
              href={`/${currentSlug}/dashboard/re`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#682880] hover:bg-[#52206A] text-white shadow-sm transition"
            >
              <span>+ Novo Prontuário</span>
            </Link>
            <a
              href="https://wa.me/5511984444994"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F0F9FC] hover:bg-[#E1E9ED] text-[#14202B] border border-[#E1E9ED] transition"
            >
              <span>Suporte</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#5B6B78]" />
            </a>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
