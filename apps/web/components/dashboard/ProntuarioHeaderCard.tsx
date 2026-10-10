import { FileText, School, User, Calendar, ShieldCheck } from "lucide-react";
import { Badge, type EstadoCaso } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/components/ui/RoleBanner";

export interface ProntuarioHeaderCardProps {
  studentCode: string;
  studentName?: string;
  schoolName: string;
  ageText: string;
  professionalName?: string;
  professionalRole?: string;
  journeyState?: string;
  className?: string;
}

const JOURNEY_ESTADOS: Record<string, EstadoCaso> = {
  rascunho: "rascunho",
  enviado_re: "enviado",
  revisao_medica: "revisao",
  delegado: "delegado",
  retornado: "retorno",
  encerrado: "encerrado",
};

const JOURNEY_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_re: "Enviado pelo RE",
  revisao_medica: "Revisão Médica",
  delegado: "Delegado ao Núcleo",
  retornado: "Retornado",
  encerrado: "Encerrado",
};

export function ProntuarioHeaderCard({
  studentCode,
  studentName,
  schoolName,
  ageText,
  professionalName = "Responsável Escolar",
  professionalRole = "ppi",
  journeyState = "rascunho",
  className = "",
}: ProntuarioHeaderCardProps) {
  const roleLabel = ROLE_LABELS[professionalRole] ?? professionalRole;
  const estado = JOURNEY_ESTADOS[journeyState] ?? "rascunho";
  const stateLabel = JOURNEY_LABELS[journeyState] ?? journeyState;

  return (
    <div
      className={`rounded-2xl border border-linha bg-linear-to-b from-white to-slate-50/50 p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha/80 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-roxo-50 text-roxo-900 border border-roxo-200/60">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Prontuário de Saúde Escolar e Acompanhamento
            </span>
          </div>
        </div>
        <Badge estado={estado} className="text-xs">
          {stateLabel}
        </Badge>
      </div>

      {/* Grid com as 5 colunas padronizadas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 text-xs">
        {/* Coluna 1: Nº Prontuário */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-500">
            <FileText className="h-3.5 w-3.5 text-neutral-400" />
            Nº Prontuário
          </span>
          <p className="font-mono font-bold text-black text-sm">{studentCode}</p>
        </div>

        {/* Coluna 2: Nome */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-500">
            <User className="h-3.5 w-3.5 text-neutral-400" />
            Nome
          </span>
          <p className="font-semibold text-black text-sm truncate" title={studentName ?? `Aluno (${studentCode})`}>
            {studentName || `Aluno (${studentCode.slice(-6)})`}
          </p>
        </div>

        {/* Coluna 3: Escola */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-500">
            <School className="h-3.5 w-3.5 text-neutral-400" />
            Escola
          </span>
          <p className="font-medium text-black truncate" title={schoolName}>
            {schoolName || "Escola Piloto"}
          </p>
        </div>

        {/* Coluna 4: Idade */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-500">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            Idade
          </span>
          <p className="font-medium text-black">
            {ageText || "7–9 anos"}
          </p>
        </div>

        {/* Coluna 5: Profissional */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
            Profissional
          </span>
          <p className="font-medium text-black truncate" title={`${professionalName} (${roleLabel})`}>
            {professionalName}
          </p>
          <span className="block text-[10px] text-neutral-500 truncate">{roleLabel}</span>
        </div>
      </div>
    </div>
  );
}

export default ProntuarioHeaderCard;
