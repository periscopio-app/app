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
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import CourseCatalog from "@/components/lms/CourseCatalog";

export default function DashboardHubPage() {
  const { data: session } = useSession();
  const [currentSlug] = useState("demo-escola");

  const userName = session?.user?.name || "Profissional Periscópio";

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#F0F9FC] via-[#F6F9FB] to-white border border-[#E1E9ED] p-8 md:p-10 shadow-sm">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#682880]/10 text-[#682880] border border-[#682880]/20 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#682880]" />
            <span>Protocolo NEMT • Saúde Mental Escolar</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-[#14202B] tracking-tight font-display">
            Olá, {userName}! 👋
          </h1>
          <p className="mt-3 text-[#5B6B78] text-sm md:text-base leading-relaxed">
            Seja bem-vindo(a) ao painel unificado do <strong>Projeto Periscópio</strong>. Gerencie prontuários multiprofissionais, pareceres de especialistas, triagem precoce e a matriz de privilégios de acesso.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${currentSlug}/dashboard/psicopedagogo`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#682880] hover:bg-[#52206A] text-white shadow-sm transition"
            >
              <FileText className="w-4 h-4" />
              <span>Painel do Psicopedagogo (PpI)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href={`/${currentSlug}/dashboard/especialista`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white hover:bg-[#F0F9FC] text-[#14202B] border border-[#E1E9ED] transition"
            >
              <Stethoscope className="w-4 h-4 text-[#682880]" />
              <span>Portal do Especialista</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E1E9ED] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-[#5B6B78]">
            <span className="text-xs font-bold uppercase tracking-wider">Prontuários NEMT</span>
            <ClipboardList className="w-4 h-4 text-[#682880]" />
          </div>
          <div className="text-2xl font-extrabold text-[#14202B]">12 Casos</div>
          <p className="text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Triagem inicial concluída</span>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1E9ED] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-[#5B6B78]">
            <span className="text-xs font-bold uppercase tracking-wider">Janela Terapêutica</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#14202B]">120 Dias</div>
          <p className="text-[11px] text-[#5B6B78]">Acompanhamento pré-encaminhamento</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1E9ED] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-[#5B6B78]">
            <span className="text-xs font-bold uppercase tracking-wider">Pareceres Pendentes</span>
            <Stethoscope className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#14202B]">5 Especialidades</div>
          <p className="text-[11px] text-amber-700 font-medium">Fono, Psicologia, Medicina, etc.</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1E9ED] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-[#5B6B78]">
            <span className="text-xs font-bold uppercase tracking-wider">Conformidade LGPD</span>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#14202B]">100% Pseudonimizado</div>
          <p className="text-[11px] text-[#5B6B78]">Isolamento por escola / município</p>
        </div>
      </div>

      {/* System Modules Showcase Grid */}
      <div>
        <h2 className="text-xl font-extrabold text-[#14202B] font-display mb-4">
          Módulos do Sistema Periscópio
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Painel do Psicopedagogo */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1E9ED] flex flex-col justify-between hover:shadow-md hover:border-[#682880]/30 transition group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#682880]/10 text-[#682880] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#14202B] mb-2">Painel do Psicopedagogo (PpI)</h3>
              <p className="text-xs text-[#5B6B78] leading-relaxed mb-4">
                Gestão completa de estudantes com cadastro pseudonimizado (LGPD), abertura de prontuário e delegação de seções para a equipe multiprofissional.
              </p>
            </div>
            <Link
              href={`/${currentSlug}/dashboard/psicopedagogo`}
              className="inline-flex items-center justify-between pt-4 border-t border-[#E1E9ED] text-xs font-bold text-[#682880] hover:text-[#52206A] transition"
            >
              <span>Acessar Módulo PpI</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 2: Portal do Especialista */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1E9ED] flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#14202B] mb-2">Portal do Especialista Clínico</h3>
              <p className="text-xs text-[#5B6B78] leading-relaxed mb-4">
                Ambiente seguro para fonoaudiólogos, psicólogos, médicos (MD1) e psicomotricistas emitirem pareceres e registrarem observações clínicas.
              </p>
            </div>
            <Link
              href={`/${currentSlug}/dashboard/especialista`}
              className="inline-flex items-center justify-between pt-4 border-t border-[#E1E9ED] text-xs font-bold text-blue-600 hover:text-blue-800 transition"
            >
              <span>Acessar Pareceres</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 3: Gestão de Usuários & RBAC */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1E9ED] flex flex-col justify-between hover:shadow-md hover:border-emerald-300 transition group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#14202B] mb-2">Usuários & Privilégios (RBAC)</h3>
              <p className="text-xs text-[#5B6B78] leading-relaxed mb-4">
                Controle de acessos master da plataforma. Cadastre novos usuários, altere níveis de privilégio (Admin, Gestor Escolar, Médico, etc.) e revogue permissões.
              </p>
            </div>
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-between pt-4 border-t border-[#E1E9ED] text-xs font-bold text-emerald-600 hover:text-emerald-800 transition"
            >
              <span>Gerenciar Usuários</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 4: Provisionar Escola */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1E9ED] flex flex-col justify-between hover:shadow-md hover:border-amber-300 transition group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#14202B] mb-2">Provisionar Escola (Setup)</h3>
              <p className="text-xs text-[#5B6B78] leading-relaxed mb-4">
                Configure novas unidades escolares na rede municipal, defina slugs de acoplamento e inicialize a equipe pedagógica responsável.
              </p>
            </div>
            <Link
              href="/admin/setup"
              className="inline-flex items-center justify-between pt-4 border-t border-[#E1E9ED] text-xs font-bold text-amber-600 hover:text-amber-800 transition"
            >
              <span>Configurar Escola</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 5: Capacitação LMS */}
          <div className="p-6 rounded-2xl bg-white border border-[#E1E9ED] flex flex-col justify-between hover:shadow-md hover:border-indigo-300 transition group lg:col-span-2">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#14202B] mb-2">Capacitação & Cursos LMS (NEMT)</h3>
              <p className="text-xs text-[#5B6B78] leading-relaxed mb-4">
                Acesse o catálogo de cursos e treinamentos em saúde mental escolar, aplicação de protocolos de observação e condutas clínicas padronizadas.
              </p>
            </div>
            <a
              href={`/${currentSlug}/dashboard/psicopedagogo#lms`}
              className="inline-flex items-center justify-between pt-4 border-t border-[#E1E9ED] text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
            >
              <span>Ver Catálogo de Cursos</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Integrated LMS Section */}
      <div className="pt-6 border-t border-[#E1E9ED]">
        <h2 className="text-xl font-extrabold text-[#14202B] font-display mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#682880]" />
          <span>Cursos & Trilhas de Formação Integradas</span>
        </h2>
        <CourseCatalog />
      </div>
    </div>
  );
}
