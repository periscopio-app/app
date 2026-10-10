"use client";

import {
  G3_ITENS,
  FOGAP_COMPORTAMENTOS,
  DIFICULDADES_PERSISTENTES_OPCOES,
  type FogapPayload,
} from "@periscopio/shared";
import { CheckCircle2, AlertCircle, HelpCircle, FileText, UserCheck, Calendar } from "lucide-react";

interface FogapViewerProps {
  payload: unknown;
  status?: string;
  submittedAt?: string | null;
}

export function FogapViewer({ payload, status, submittedAt }: FogapViewerProps) {
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

  const grupo = p.grupo_id ? p.grupo_id.toUpperCase() : "G3 (6 a 9 anos e 11 meses)";

  const devAnswers = p.respostas_desenvolvimento || {};
  const compAnswers = p.respostas_comportamentos || {};
  const difs = p.dificuldades_persistem || [];
  const intervencao = p.intervencao_professor;

  return (
    <div className="space-y-6">
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

      {/* 1. Marcos do Desenvolvimento Infantil */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#682880]" />
            1. Marcos do Desenvolvimento Infantil ({grupo})
          </h4>
          <span className="text-[11px] font-semibold text-slate-500">15 itens avaliados</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {G3_ITENS.map((item) => {
            const resp = devAnswers[item.id];
            return (
              <div key={item.id} className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/50">
                <span className="text-slate-800 leading-snug">
                  <strong className="text-slate-900 font-mono mr-1.5">{item.id}.</strong>
                  {item.texto}
                </span>
                <span className="shrink-0">
                  {resp === "adequada" ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Adequada
                    </span>
                  ) : resp === "inadequada" ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Inadequada
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500">
                      Não preenchido
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Comportamentos Disfuncionais */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            2. Comportamentos Disfuncionais (Últimos 6 meses)
          </h4>
          <span className="text-[11px] font-semibold text-slate-500">15 itens avaliados</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {FOGAP_COMPORTAMENTOS.map((comp) => {
            const resp = compAnswers[comp.id];
            const val = typeof resp === "string" ? resp : (resp as any)?.resposta;
            return (
              <div key={comp.id} className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/50">
                <span className="text-slate-800 leading-snug">
                  <strong className="text-slate-900 font-mono mr-1.5">{comp.id}.</strong>
                  {comp.texto}
                </span>
                <span className="shrink-0">
                  {val === "sim" ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      Sim
                    </span>
                  ) : val === "nao" ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                      Não
                    </span>
                  ) : val === "historico_insuficiente" ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                      Histórico Insuficiente
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500">
                      Não preenchido
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Observações do Professor e Intervenções Escolares */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-blue-600" />
            Dificuldades que Persistem
          </h4>
          {difs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {difs.map((d: string) => (
                <span
                  key={d}
                  className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#682880]/10 text-black border border-[#682880]/20"
                >
                  {d}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Nenhuma dificuldade específica assinalada.</p>
          )}

          {p.dificuldade_outra_texto && (
            <div className="pt-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <strong className="text-black">Outra dificuldade:</strong> {p.dificuldade_outra_texto}
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            Intervenção do Professor
          </h4>
          {intervencao?.houve_conduta ? (
            <div className="space-y-2 text-xs">
              <div className="text-slate-800">
                <strong className="text-black">Conduta adotada:</strong> {intervencao.qual_conduta || "Não detalhado"}
              </div>
              <div className="text-slate-800">
                <strong className="text-black">Duração:</strong> {intervencao.tempo_intervencao || "Não informado"}
              </div>
              <div className="text-slate-800">
                <strong className="text-black">Resultado obtido:</strong> {intervencao.resultado || "Não informado"}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Nenhuma intervenção formal prévia documentada pelo docente.</p>
          )}
        </div>
      </div>

      {/* 4. Encaminhamento para a RE */}
      {p.encaminhamento && (
        <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 space-y-2 text-xs">
          <h4 className="font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-indigo-700" />
            Encaminhamento da Escola para a RE
          </h4>
          <p className="text-slate-800 leading-relaxed font-sans">
            {p.encaminhamento.observacoes || "Sem observações adicionais anexadas."}
          </p>
          {p.encaminhamento.data_encaminhamento && (
            <span className="text-[11px] text-slate-500 block pt-1">
              Data de registro: {p.encaminhamento.data_encaminhamento}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
