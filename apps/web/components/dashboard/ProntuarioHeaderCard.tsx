"use client";

import { useState } from "react";
import { FileText, School, User, Calendar, ShieldCheck, GraduationCap, Lock, Pencil, MessageSquareText } from "lucide-react";
import { Badge, type EstadoCaso } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/components/ui/RoleBanner";

export interface ProntuarioHeaderCardProps {
  studentCode: string;
  studentName?: string;
  /** Nome completo liberado pelo servidor para a equipe do caso. Quando vem, aparece direto, sem passar pelo cofre. */
  nomeCompleto?: string | null;
  schoolName: string;
  ageText: string;
  professionalName?: string;
  professionalRole?: string;
  journeyState?: string;
  className?: string;
  /** Série/ano escolar do aluno (dado do cadastro). */
  grade?: string | null;
  /** Nascimento em texto curto (ex.: "mar/2019"). */
  birthText?: string;
  /** Quando informado, a coluna do nome mostra "protegido" e um botão que leva ao Cofre (acesso auditado). */
  onVerNome?: () => void;
  /** Quando informado, mostra o botão para editar os dados do aluno. */
  onEditar?: () => void;
  /**
   * Queixa da escola (texto do RE no Formulário I). `undefined` = não mostrar a linha (perfil sem acesso ou ainda carregando);
   * texto vazio = mostra "Não registrada pelo RE".
   */
  queixaEscola?: string | null;
}

const QUEIXA_LIMITE = 220;

function QueixaDaEscola({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  const limpo = texto.trim();
  const longa = limpo.length > QUEIXA_LIMITE;
  return (
    <div className="mt-3.5 rounded-xl border border-roxo-200/70 bg-roxo-50/60 px-3.5 py-3" data-testid="queixa-da-escola">
      <span className="flex items-center gap-1.5 text-xs font-bold text-roxo-900">
        <MessageSquareText className="h-3.5 w-3.5" aria-hidden /> Queixa da escola
      </span>
      {limpo ? (
        <>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-black">
            {longa && !aberta ? `${limpo.slice(0, QUEIXA_LIMITE).trimEnd()}…` : limpo}
          </p>
          {longa && (
            <button type="button" onClick={() => setAberta((v) => !v)} className="mt-1 text-[11px] font-bold text-roxo underline underline-offset-2 hover:text-roxo-800">
              {aberta ? "Mostrar menos" : "Ler a queixa completa"}
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm italic text-neutral-700">Não registrada pelo RE.</p>
      )}
    </div>
  );
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
  nomeCompleto,
  schoolName,
  ageText,
  professionalName = "Responsável Escolar",
  professionalRole = "ppi",
  journeyState = "rascunho",
  className = "",
  grade,
  birthText,
  onVerNome,
  onEditar,
  queixaEscola,
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
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Prontuário de Saúde Escolar e Acompanhamento
            </span>
          </div>
        </div>
        <Badge estado={estado} className="text-xs">
          {stateLabel}
        </Badge>
      </div>

      {/* Grid com as 5 colunas padronizadas */}
      <div className={`grid grid-cols-2 gap-3.5 text-xs ${onVerNome ? "sm:grid-cols-3 xl:grid-cols-6" : "sm:grid-cols-5"}`}>
        {/* Coluna 1: Nº Prontuário */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-700">
            <FileText className="h-3.5 w-3.5 text-neutral-400" />
            Nº Prontuário
          </span>
          <p className="font-mono font-bold text-black text-sm">{studentCode}</p>
        </div>

        {/* Coluna 2: Nome */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-700">
            <User className="h-3.5 w-3.5 text-neutral-400" />
            Nome
          </span>
          {nomeCompleto ? (
            <p className="font-semibold text-black text-sm break-words" title={nomeCompleto} data-testid="nome-aluno">
              {nomeCompleto}
            </p>
          ) : onVerNome ? (
            <>
              <p className="flex items-center gap-1 font-semibold text-black text-sm">
                <Lock className="h-3.5 w-3.5 text-neutral-700" aria-hidden /> Protegido
              </p>
              <button type="button" onClick={onVerNome} className="text-[11px] font-bold text-roxo underline underline-offset-2 hover:text-roxo-800" data-testid="ver-nome-aluno">
                Ver nome (Cofre, auditado)
              </button>
            </>
          ) : (
            <p className="font-semibold text-black text-sm truncate" title={studentName ?? `Aluno (${studentCode})`}>
              {studentName || `Aluno (${studentCode.slice(-6)})`}
            </p>
          )}
        </div>

        {/* Coluna 3: Escola */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-700">
            <School className="h-3.5 w-3.5 text-neutral-400" />
            Escola
          </span>
          <p className="font-medium text-black truncate" title={schoolName}>
            {schoolName || "Escola Piloto"}
          </p>
        </div>

        {onVerNome && (
          <div className="space-y-1">
            <span className="flex items-center gap-1 font-semibold text-neutral-700">
              <GraduationCap className="h-3.5 w-3.5 text-neutral-400" />
              Série
            </span>
            <p className="font-medium text-black truncate" title={grade ?? undefined}>
              {grade?.trim() ? grade : <span className="italic text-neutral-600">não informada</span>}
            </p>
          </div>
        )}

        {/* Coluna 4: Idade */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-700">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            Idade
          </span>
          <p className="font-medium text-black">
            {ageText || "7–9 anos"}
          </p>
          {birthText && <span className="block text-[10px] text-neutral-700">nasc. {birthText}</span>}
        </div>

        {/* Coluna 5: Profissional */}
        <div className="space-y-1">
          <span className="flex items-center gap-1 font-semibold text-neutral-700">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
            Profissional
          </span>
          <p className="font-medium text-black truncate" title={`${professionalName} (${roleLabel})`}>
            {professionalName}
          </p>
          <span className="block text-[10px] text-neutral-700 truncate">{roleLabel}</span>
        </div>
      </div>
      {queixaEscola !== undefined && <QueixaDaEscola texto={queixaEscola ?? ""} />}
      {onEditar && (
        <div className="mt-3 flex justify-end border-t border-linha/80 pt-3">
          <button type="button" onClick={onEditar} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-linha bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-roxo-50" data-testid="editar-aluno">
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar dados do aluno
          </button>
        </div>
      )}
    </div>
  );
}

export default ProntuarioHeaderCard;
