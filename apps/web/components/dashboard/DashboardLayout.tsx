"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import {
  LayoutDashboard,
  FileText,
  Stethoscope,
  ShieldCheck,
  Building2,
  GraduationCap,
  LogOut,
  Menu,
  X,
  School,
  Sparkles,
  Search,
  ArrowUpRight,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentSlug, setCurrentSlug] = useState("demo-escola");

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

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (e) {
      console.error("Erro ao fazer logout", e);
    }
  };

  const navItems = [
    {
      group: "Módulos Principais",
      items: [
        {
          label: "Visão Geral",
          href: "/dashboard",
          icon: LayoutDashboard,
          badge: null,
          exact: true,
        },
        {
          label: "Gestão Clínica (PpI)",
          href: `/${currentSlug}/dashboard/psicopedagogo`,
          icon: FileText,
          badge: "NEMT",
          exact: false,
        },
        {
          label: "Portal do Especialista",
          href: `/${currentSlug}/dashboard/especialista`,
          icon: Stethoscope,
          badge: "Parecer",
          exact: false,
        },
        {
          label: "Capacitação & LMS",
          href: `/${currentSlug}/dashboard/psicopedagogo#lms`,
          icon: GraduationCap,
          badge: "Cursos",
          exact: false,
        },
      ],
    },
    {
      group: "Administração & RBAC",
      items: [
        {
          label: "Usuários & Privilégios",
          href: "/admin/users",
          icon: ShieldCheck,
          badge: "Master",
          exact: false,
        },
        {
          label: "Provisionar Escola",
          href: "/admin/setup",
          icon: Building2,
          badge: "Setup",
          exact: false,
        },
      ],
    },
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href.split("#")[0]);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f1f5f9] flex flex-col md:flex-row font-sans">
      {/* Mobile Header Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0f172a] border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm">
            P
          </div>
          <span className="font-bold text-white text-base">Periscópio Saúde</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          aria-label="Alternar Menu de Navegação"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Overlay Backdrop for Mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 bg-[#0c1220] border-r border-slate-800/80
          flex flex-col justify-between
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Brand & System Status */}
          <div className="p-5 border-b border-slate-800/60">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center font-extrabold text-white text-lg shadow-lg shadow-purple-900/30 group-hover:scale-105 transition-transform">
                P
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base tracking-tight">Periscópio</span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    Saúde
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Protocolo NEMT Escolar
                </p>
              </div>
            </Link>

            {/* School / Tenant Switcher Info */}
            <div className="mt-4 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <School className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-300 truncate">
                  {currentSlug === "demo-escola" ? "Escola Municipal Demo" : currentSlug}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Tenant</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex-1 space-y-6">
            {navItems.map((group) => (
              <div key={group.group}>
                <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
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
                          flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                          ${
                            active
                              ? "bg-purple-600/20 text-purple-200 border border-purple-500/30 shadow-sm"
                              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-4 h-4 transition-colors ${
                              active ? "text-purple-400" : "text-slate-500 group-hover:text-slate-300"
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              active
                                ? "bg-purple-500/30 text-purple-300 border-purple-400/40"
                                : "bg-slate-800 text-slate-400 border-slate-700"
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
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-purple-950/40 border border-purple-500/20">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Janela Terapêutica</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Protocolo de 120 dias para acompanhamento e triagem precoce antes do encaminhamento SUS.
              </p>
            </div>
          </nav>

          {/* User Profile & Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-[#0a0f1c]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-200 font-bold flex items-center justify-center shrink-0">
                  {session?.user?.name ? session.user.name[0].toUpperCase() : "P"}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-slate-200 truncate">
                    {session?.user?.name || "Profissional Periscópio"}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {session?.user?.email || "Conectado via Neon Auth"}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sair da Conta"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Utility Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-[#0c1220]/80 backdrop-blur-md border-b border-slate-800/60 sticky top-0 z-30">
          <div className="flex items-center gap-3 w-96 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar aluno (ID LGPD), protocolo ou parecer..."
              className="bg-transparent border-none outline-none w-full text-slate-200 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={`/${currentSlug}/dashboard/psicopedagogo`}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/20 transition"
            >
              <span>+ Novo Prontuário</span>
            </Link>
            <a
              href="https://wa.me/5511984444994"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <span>Suporte Técnico</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
