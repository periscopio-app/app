"use client";

import { useState } from "react";
import {
  FileText,
  Activity,
  ShieldCheck,
  FileSignature,
  Paperclip,
  Video,
  Stethoscope,
  ChevronRight,
} from "lucide-react";
import { ConsentCard } from "./ConsentCard";
import { StudentIdentityVaultCard } from "./StudentIdentityVaultCard";
import { CaseAttachmentsCard } from "./CaseAttachmentsCard";
import { TeaScreeningPanel } from "./TeaScreeningPanel";
import { ExpertMeetingsCard } from "./ExpertMeetingsCard";

export type ProntuarioTabKey =
  | "overview"
  | "tea"
  | "attachments"
  | "vault"
  | "consent"
  | "board"
  | "medical"
  | "clinical_actions";

interface ProntuarioHorizontalTabsProps {
  caseId: string;
  studentId?: string;
  studentCode: string;
  isDoctorOrMaster?: boolean;
  specialtyOnlySummary?: boolean;
  userSpecialty?: string;
  childrenOverview?: React.ReactNode;
  childrenActions?: React.ReactNode;
  /** Ficha do médico, seções B a R (aba "Formulário do Médico"). */
  childrenMedical?: React.ReactNode;
  /** Aba controlada pela tela (ex.: o botão "Encaminhar a especialistas" abre a aba de ações). */
  activeTab?: ProntuarioTabKey;
  onTabChange?: (tab: ProntuarioTabKey) => void;
}

export function ProntuarioHorizontalTabs({
  caseId,
  studentId,
  studentCode,
  isDoctorOrMaster = true,
  specialtyOnlySummary = false,
  userSpecialty,
  childrenOverview,
  childrenActions,
  childrenMedical,
  activeTab: activeTabControlada,
  onTabChange,
}: ProntuarioHorizontalTabsProps) {
  const [abaInterna, setAbaInterna] = useState<ProntuarioTabKey>("overview");
  const activeTab = activeTabControlada ?? abaInterna;
  const setActiveTab = (t: ProntuarioTabKey) => {
    setAbaInterna(t);
    onTabChange?.(t);
  };

  const tabs: Array<{
    id: ProntuarioTabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    visible: boolean;
  }> = [
    {
      id: "overview",
      label: "Visão Geral",
      icon: FileText,
      visible: true,
    },
    {
      id: "medical",
      label: "Formulário do Médico",
      icon: Stethoscope,
      visible: Boolean(childrenMedical),
    },
    {
      id: "tea",
      label: "Triagem TEA",
      icon: Activity,
      badge: "5 Escalas",
      visible: isDoctorOrMaster || !specialtyOnlySummary,
    },
    {
      id: "attachments",
      label: "Exames & Anexos",
      icon: Paperclip,
      // Laudos dos pais: só o médico vê aqui. O RE tem o card no próprio painel; especialistas nunca.
      visible: isDoctorOrMaster,
    },
    {
      id: "board",
      label: "Board & Videochamada",
      icon: Video,
      badge: "Gratuito",
      visible: true,
    },
    {
      id: "consent",
      label: "TCLE & Consentimento",
      icon: FileSignature,
      visible: isDoctorOrMaster,
    },
    {
      id: "vault",
      label: "Cofre de Identidade",
      icon: ShieldCheck,
      badge: "LGPD",
      visible: isDoctorOrMaster,
    },
    {
      id: "clinical_actions",
      label: isDoctorOrMaster ? "Encaminhar a especialistas & Encerrar" : "Meu Parecer",
      icon: Stethoscope,
      visible: Boolean(childrenActions),
    },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="space-y-4">
      {/* Barra de Navegação Horizontal */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-2xs">
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
          {visibleTabs.map(({ id, label, icon: Icon, badge }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex min-h-[44px] items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 ${
                  isActive
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{label}</span>
                {badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-purple-900/40 text-purple-100 border border-purple-400/30"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo Dinâmico da Aba Selecionada */}
      <div className="transition-opacity duration-150">
        {activeTab === "overview" && (
          <div className="space-y-4">
            {childrenOverview || (
              <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                Nenhum dado de visão geral disponível.
              </div>
            )}
          </div>
        )}

        {activeTab === "medical" && childrenMedical && (
          <div className="space-y-4">{childrenMedical}</div>
        )}

        {activeTab === "tea" && (
          <div className="space-y-4">
            <TeaScreeningPanel caseId={caseId} />
          </div>
        )}

        {activeTab === "attachments" && (
          <div className="space-y-4">
            <CaseAttachmentsCard caseId={caseId} />
          </div>
        )}

        {activeTab === "board" && (
          <div className="space-y-4">
            <ExpertMeetingsCard caseId={caseId} studentCode={studentCode} />
          </div>
        )}

        {activeTab === "consent" && (
          <div className="space-y-4">
            <ConsentCard caseId={caseId} studentId={studentId} studentCode={studentCode} />
          </div>
        )}

        {activeTab === "vault" && (
          <div className="space-y-4">
            <StudentIdentityVaultCard studentId={studentId} studentCode={studentCode} />
          </div>
        )}

        {activeTab === "clinical_actions" && childrenActions && (
          <div className="space-y-4">{childrenActions}</div>
        )}
      </div>
    </div>
  );
}

export default ProntuarioHorizontalTabs;
