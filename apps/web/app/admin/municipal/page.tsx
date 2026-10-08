"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Clock,
  ShieldCheck,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Filter,
  Download,
  Hospital,
  School,
} from "lucide-react";

interface SchoolNetworkData {
  id: string;
  name: string;
  totalStudents: number;
  screenedStudents: number;
  triagemPercent: number;
  casesActive: number;
  slaOnTimePercent: number;
  susReferrals: number;
  status: "Excelente" | "Regular" | "Atenção";
}

const DEMO_SCHOOLS_NETWORK: SchoolNetworkData[] = [
  {
    id: "sch-1",
    name: "E.M. Prof. Darcy Ribeiro",
    totalStudents: 450,
    screenedStudents: 410,
    triagemPercent: 91,
    casesActive: 18,
    slaOnTimePercent: 95,
    susReferrals: 4,
    status: "Excelente",
  },
  {
    id: "sch-2",
    name: "E.M. Paulo Freire",
    totalStudents: 380,
    screenedStudents: 320,
    triagemPercent: 84,
    casesActive: 14,
    slaOnTimePercent: 90,
    susReferrals: 3,
    status: "Excelente",
  },
  {
    id: "sch-3",
    name: "E.M. Cecília Meireles",
    totalStudents: 520,
    screenedStudents: 390,
    triagemPercent: 75,
    casesActive: 22,
    slaOnTimePercent: 82,
    susReferrals: 7,
    status: "Regular",
  },
  {
    id: "sch-4",
    name: "E.M. Mario Quintana",
    totalStudents: 300,
    screenedStudents: 210,
    triagemPercent: 70,
    casesActive: 11,
    slaOnTimePercent: 78,
    susReferrals: 2,
    status: "Atenção",
  },
];

export default function MunicipalDashboardPage() {
  const [schools] = useState<SchoolNetworkData[]>(DEMO_SCHOOLS_NETWORK);
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredSchools = schools.filter((s) => {
    if (filterStatus === "all") return true;
    return s.status.toLowerCase() === filterStatus.toLowerCase();
  });

  return (
    <div className="space-y-8">
      {/* Top Header & Municipal Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E1E9ED] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold bg-[#682880]/10 text-black border border-[#682880]/20 mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Gestão Municipal Integrada • Saúde & Educação</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-black font-display">
            Dashboard da Rede Municipal & SLA
          </h1>
          <p className="text-xs md:text-sm text-neutral-800 mt-1">
            Visão consolidada para acompanhamento das taxas de triagem precoce, cumprimento da Janela Terapêutica de 120 dias e encaminhamentos ao SUS.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => alert("Relatório Executivo exportado em PDF/CSV com sucesso!")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#F0F9FC] hover:bg-[#E1E9ED] text-black border border-[#E1E9ED] transition"
          >
            <Download className="w-4 h-4 text-black" />
            <span>Exportar Relatório</span>
          </button>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-roxo-100 border border-roxo hover:bg-roxo-200 text-black shadow-sm transition"
          >
            <span>Gerenciar Rede (RBAC)</span>
          </Link>
        </div>
      </div>

      {/* Global Municipal KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E1E9ED] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-neutral-800">
            <span className="text-xs font-bold uppercase tracking-wider">Rede Municipal</span>
            <School className="w-4 h-4 text-black" />
          </div>
          <div className="text-2xl font-extrabold text-black">24 Unidades</div>
          <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>100% integradas ao sistema NEMT</span>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1E9ED] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-neutral-800">
            <span className="text-xs font-bold uppercase tracking-wider">Taxa Global de Triagem</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-black">82.4%</div>
          <p className="text-[11px] text-blue-700 font-semibold">1.340 de 1.650 alunos triados</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1E9ED] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-neutral-800">
            <span className="text-xs font-bold uppercase tracking-wider">SLA Janela Terapêutica</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-black">91.5% no Prazo</div>
          <p className="text-[11px] text-neutral-800">Tempo médio: 42 dias (SLA máx: 120d)</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E1E9ED] space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-neutral-800">
            <span className="text-xs font-bold uppercase tracking-wider">Encaminhamentos SUS</span>
            <Hospital className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-black">16 Casos</div>
          <p className="text-[11px] text-neutral-800">Com Dossiê Clínico MD1 validado</p>
        </div>
      </div>

      {/* Interactive Charts Section (Tailwind & SVG) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Taxas de Triagem por Escola na Rede */}
        <div className="p-6 rounded-2xl bg-white border border-[#E1E9ED] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-black">Taxa de Cobertura de Triagem (%)</h3>
              <p className="text-xs text-neutral-800">Percentual de triagem efetuada por escola da rede</p>
            </div>
            <span className="text-xs font-bold text-black bg-[#682880]/10 px-2.5 py-1 rounded-full">
              Meta: 80%
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {schools.map((sch) => (
              <div key={sch.id} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-black">{sch.name}</span>
                  <span className="text-black">{sch.triagemPercent}% ({sch.screenedStudents}/{sch.totalStudents})</span>
                </div>
                <div className="w-full bg-[#F6F9FB] border border-[#E1E9ED] h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      sch.triagemPercent >= 85
                        ? "bg-emerald-600"
                        : sch.triagemPercent >= 75
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${sch.triagemPercent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: SLA da Janela Terapêutica & Encaminhamentos */}
        <div className="p-6 rounded-2xl bg-white border border-[#E1E9ED] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-black">Distribuição dos Encaminhamentos ao SUS</h3>
              <p className="text-xs text-neutral-800">Destino dos casos após janela de intervenção escolar</p>
            </div>
            <Activity className="w-4 h-4 text-black" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[#F6F9FB] border border-[#E1E9ED] space-y-1">
              <span className="text-[11px] font-bold text-neutral-800 uppercase">Atenção Primária / UBS</span>
              <div className="text-xl font-extrabold text-black">62% (10 casos)</div>
              <span className="text-[10px] text-emerald-700 font-semibold">Cuidado compartilhado</span>
            </div>

            <div className="p-4 rounded-xl bg-[#F6F9FB] border border-[#E1E9ED] space-y-1">
              <span className="text-[11px] font-bold text-neutral-800 uppercase">CAPSi / Saúde Mental</span>
              <div className="text-xl font-extrabold text-black">25% (4 casos)</div>
              <span className="text-[10px] text-amber-700 font-semibold">Casos complexos</span>
            </div>

            <div className="p-4 rounded-xl bg-[#F6F9FB] border border-[#E1E9ED] space-y-1">
              <span className="text-[11px] font-bold text-neutral-800 uppercase">Especialidades Pediátricas</span>
              <div className="text-xl font-extrabold text-black">13% (2 casos)</div>
              <span className="text-[10px] text-blue-700 font-semibold">Neuropediatria</span>
            </div>

            <div className="p-4 rounded-xl bg-[#F6F9FB] border border-[#E1E9ED] space-y-1">
              <span className="text-[11px] font-bold text-neutral-800 uppercase">Acompanhamento em Sala</span>
              <div className="text-xl font-extrabold text-black">84% (Restante)</div>
              <span className="text-[10px] text-emerald-700 font-semibold">Resolução na escola</span>
            </div>
          </div>
        </div>
      </div>

      {/* Network Schools Table */}
      <div className="p-6 rounded-2xl bg-white border border-[#E1E9ED] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-black">Rede de Unidades Escolares Integradas</h3>
            <p className="text-xs text-neutral-800">Métricas de triagem, casos ativos e cumprimento do SLA de 120 dias</p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-800" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#F6F9FB] border border-[#E1E9ED] text-xs font-bold text-black"
            >
              <option value="all">Todas as Escolas ({schools.length})</option>
              <option value="Excelente">Status Excelente</option>
              <option value="Regular">Status Regular</option>
              <option value="Atenção">Status Atenção</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FB] text-neutral-800 uppercase font-bold tracking-wider border-b border-[#E1E9ED]">
              <tr>
                <th className="px-4 py-3">Unidade Escolar</th>
                <th className="px-4 py-3">Alunos / Triados</th>
                <th className="px-4 py-3">Cobertura (%)</th>
                <th className="px-4 py-3">Casos Ativos</th>
                <th className="px-4 py-3">SLA 120d (%)</th>
                <th className="px-4 py-3">Ref. SUS</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E9ED]">
              {filteredSchools.map((sch) => (
                <tr key={sch.id} className="hover:bg-[#F0F9FC] transition">
                  <td className="px-4 py-3 font-bold text-black">{sch.name}</td>
                  <td className="px-4 py-3 text-neutral-800">{sch.screenedStudents} / {sch.totalStudents}</td>
                  <td className="px-4 py-3 font-extrabold text-black">{sch.triagemPercent}%</td>
                  <td className="px-4 py-3 text-black font-bold">{sch.casesActive}</td>
                  <td className="px-4 py-3 text-emerald-700 font-bold">{sch.slaOnTimePercent}%</td>
                  <td className="px-4 py-3 text-neutral-800">{sch.susReferrals} casos</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                        sch.status === "Excelente"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : sch.status === "Regular"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      {sch.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
