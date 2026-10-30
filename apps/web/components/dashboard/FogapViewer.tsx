"use client";

import { faixaEmUso, type FogapPayload } from "@periscopio/shared";
import { CheckCircle2 } from "lucide-react";
import { SumarioFormularioI } from "@/components/dashboard/SumarioFormularioI";
import { FogapDesenvolvimento, type RespostasDesenvolvimento } from "@/components/re/FogapDesenvolvimento";

interface FogapViewerProps {
  payload: unknown;
  status?: string;
  submittedAt?: string | null;
  /** Dados do caso para o cabeçalho do Formulário I (sempre o código; nunca o nome). */
  studentCode?: string | null;
  birthYear?: number | null;
  birthMonth?: number | null;
  grade?: string | null;
  schoolName?: string | null;
  professionalName?: string | null;
  somenteSumario?: boolean;
}

export function FogapViewer({ payload, status, submittedAt, studentCode, birthYear, birthMonth, grade, schoolName, professionalName, somenteSumario = false }: FogapViewerProps) {
  if (!payload || typeof payload !== "object") {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
        Nenhum dado estruturado da FOGAP foi localizado para este caso.
      </div>
    );
  }

  const p = payload as Partial<FogapPayload> & Record<string, any>;

  // Se for payload no formato FogapPayload
  const idadeStr =
    p.idade_anos != null
      ? `${p.idade_anos} ano(s)${p.idade_meses != null ? ` e ${p.idade_meses} mês(es)` : ""}`
      : (p.idade as string) || "Idade não informada";

  const faixa = faixaEmUso({ faixa_fogap: p.faixa_fogap, total_meses: p.total_meses });
  const respostas = (p.respostas_desenvolvimento ?? {}) as RespostasDesenvolvimento;
  const temItens = faixa !== null && p.respostas_desenvolvimento !== undefined;

  const grupo = p.grupo ? String(p.grupo).toUpperCase() : "Grupo não definido";

  return (
    <div className="space-y-6">
      {/* Formulário I: o sumário do RE, igual ao que ele viu ao preencher. */}
      <SumarioFormularioI
        studentCode={studentCode}
        birthYear={birthYear}
        birthMonth={birthMonth}
        grade={grade}
        schoolName={schoolName}
        payload={payload}
        professionalName={professionalName}
        modo="enviado"
      />

      {/* Respostas item a item do RE (o médico recebe o registro integral, somente leitura) */}
      {temItens && (
        <FogapDesenvolvimento faixa={faixa} faixaSugerida={null} respostas={respostas} readOnly onFaixa={() => {}} onResponder={() => {}} />
      )}
      {!temItens && (
        <p className="rounded-xl border border-ceu-300 bg-ceu-50 p-3 text-sm text-black" role="status">
          {somenteSumario
            ? "Os formulários A a H (itens item a item do FOGAP) ficam disponíveis para o médico responsável."
            : "Os itens de desenvolvimento não foram preenchidos neste caso."}
        </p>
      )}

      {/* Resumo do Cabeçalho FOGAP */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-slate-500 block font-medium">Faixa Etária / Grupo:</span>
          <strong className="text-black text-sm">{grupo} • {idadeStr}</strong>
        </div>
        <div>
          <span className="text-slate-500 block font-medium">Situação da Avaliação:</span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full mt-0.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status ? status.toUpperCase() : "ENVIADO"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block font-medium">Data do Envio:</span>
          <span className="text-black font-semibold">
            {submittedAt ? new Date(submittedAt).toLocaleDateString("pt-BR") : "Recentemente"}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-neutral-700">
        {temItens && !somenteSumario
          ? "Sumário (Formulário I) e as respostas item a item do FOGAP, como o RE enviou. Os formulários A a H estão em “Tudo o que a escola registrou”."
          : "Sumário (Formulário I) do RE. Os formulários A a H estão em “Tudo o que a escola registrou”."}
      </p>
    </div>
  );
}
