"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import {
  FileText,
  Stethoscope,
  ShieldCheck,
  Building2,
  GraduationCap,
  ClipboardList,
  Clock,
  Shield,
  ArrowRight,
  Sparkles,
  Users,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import CourseCatalog from "@/components/lms/CourseCatalog";

export default function DashboardHubPage() {
  const { data: session, isPending } = useSession();
  const [currentSlug, setCurrentSlug] = useState("demo-escola");

  const userName = session?.user?.name || "Profissional Periscópio";
  const userEmail = session?.user?.email || "Conectado via Neon Auth";

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-slate-900 border border-purple-500/20 p-8 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-purple-600/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Protocolo NEMT • Saúde Mental Escolar</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-display">
            Olá, {userName}! 👋
          </h1>
          <p className="mt-3 text-slate-300 text-sm md:text-base leading-relaxed">
            Seja bem-vindo(a) ao painel unificado do <strong>Projeto Periscópio</strong>. Gerencie prontuários multiprofissionais, pareceres de especialistas, triagem precoce e a matriz de privilégios de acesso.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${currentSlug}/dashboard/psicopedagogo`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950/50 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Abrir Painel do Psicopedagogo (PpI)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href={`/${currentSlug}/dashboard/especialista`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Stethoscope className="w-4 h-4 text-purple-400" />
              <span>Portal do Especialista</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Prontuários NEMT</span>
            <ClipboardList className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">12 Casos</div>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>Triagem inicial concluída</span>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Janela Terapêutica</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">120 Dias</div>
          <p className="text-[11px] text-slate-400">Acompanhamento pré-encaminhamento</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Pareceres Pendentes</span>
            <Stethoscope className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">5 Especialidades</div>
          <p className="text-[11px] text-amber-400">Fono, Psicologia, Medicina, etc.</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Conformidade LGPD</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">100% Pseudonimizado</div>
          <p className="text-[11px] text-slate-400">Isolamento por escola / município</p>
        </div>
      </div>

      {/* System Modules Showcase Grid */}
      <div>
        <h2 className="text-xl font-bold text-white font-display mb-4">
          Módulos do Sistema Periscópio
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Painel do Psicopedagogo */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between hover:border-purple-500/40 transition group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Painel do Psicopedagogo (PpI)</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Gestão completa de estudantes com cadastro pseudonimizado (LGPD), abertura de prontuário e delegação de seções para a equipe multiprofissional.
              </p>
            </div>
            <Link
              href={`/${currentSlug}/dashboard/psicopedagogo`}
              className="inline-flex items-center justify-between pt-4 border-t border-white/5 text-xs font-semibold text-purple-300 hover:text-white transition"
            >
              <span>Acessar Módulo PpI</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 2: Portal do Especialista */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between hover:border-purple-500/40 transition group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Portal do Especialista Clínico</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Ambiente seguro para fonoaudiólogos, psicólogos, médicos (MD1) e psicomotricistas emitirem pareceres e registrarem observações clínicas.
              </p>
            </div>
            <Link
              href={`/${currentSlug}/dashboard/especialista`}
              className="inline-flex items-center justify-between pt-4 border-t border-white/5 text-xs font-semibold text-blue-300 hover:text-white transition"
            >
              <span>Acessar Pareceres</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 3: Gestão de Usuários & RBAC */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between hover:border-purple-500/40 transition group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Usuários & Privilégios (RBAC)</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Controle de acessos master da plataforma. Cadastre novos usuários, altere níveis de privilégio (Admin, Gestor Escolar, Médico, etc.) e revogue permissões.
              </p>
            </div>
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-between pt-4 border-t border-white/5 text-xs font-semibold text-emerald-300 hover:text-white transition"
            >
              <span>Gerenciar Usuários</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 4: Provisionar Escola */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between hover:border-purple-500/40 transition group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Provisionar Escola (Setup)</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Configure novas unidades escolares na rede municipal, defina slugs de acoplamento e inicialize a equipe pedagógica responsável.
              </p>
            </div>
            <Link
              href="/admin/setup"
              className="inline-flex items-center justify-between pt-4 border-t border-white/5 text-xs font-semibold text-amber-300 hover:text-white transition"
            >
              <span>Configurar Escola</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 5: Capacitação LMS */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between hover:border-purple-500/40 transition group lg:col-span-2">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Capacitação & Cursos LMS (NEMT)</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Acesse o catálogo de cursos e treinamentos em saúde mental escolar, aplicação de protocolos de observação e condutas clínicas padronizadas.
              </p>
            </div>
            <a
              href={`/${currentSlug}/dashboard/psicopedagogo#lms`}
              className="inline-flex items-center justify-between pt-4 border-t border-white/5 text-xs font-semibold text-indigo-300 hover:text-white transition"
            >
              <span>Ver Catálogo de Cursos</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Integrated LMS Section */}
      <div className="pt-6 border-t border-white/10">
        <h2 className="text-xl font-bold text-white font-display mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-400" />
          <span>Cursos & Trilhas de Formação Integradas</span>
        </h2>
        <CourseCatalog />
      </div>
    </div>
  );
}
