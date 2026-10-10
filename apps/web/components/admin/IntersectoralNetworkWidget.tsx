"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  Clock,
  Building2,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Activity,
  HeartPulse,
} from "lucide-react";

interface IntersectoralSummary {
  totalCasosEncaminhados: number;
  taxaConformidadeLei90d: number;
  distribuicaoPorRede: {
    UBS: number;
    CAPS_IJ: number;
    CAPS_AJ: number;
    CRAS: number;
    CREAS: number;
    CONSELHO_TUTELAR: number;
  };
  alertaPrazos90d: {
    no_prazo: number;
    atencao: number;
    urgente: number;
    prazo_estourado_90d: number;
  };
  casosCriticos: Array<{
    id: string;
    studentCode: string;
    destination: string;
    daysElapsed: number;
    daysRemaining: number;
    slaStatus: string;
    reason: string;
  }>;
}

export default function IntersectoralNetworkWidget() {
  const [data, setData] = useState<IntersectoralSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${apiUrl}/api/intersectoral/monitoring/sla-90d`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  return (
    <div className="rounded-2xl border border-linha bg-white/95 p-6 shadow-sm backdrop-blur-md space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-linha/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-roxo-100 text-roxo font-bold">
              <HeartPulse className="h-4 w-4" />
            </span>
            <h3 className="text-base font-bold text-black">
              Rede Intersetorial de Cuidados (CRAS • CAPS • UBS)
            </h3>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Monitoramento de Acolhimento e Contrarreferência — Lei nº 13.509/2017 & ECA art. 19 § 2º (Prazo de 90 dias)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${apiUrl}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-roxo hover:text-roxo transition-all shadow-sm"
          >
            <BookOpen className="h-3.5 w-3.5 text-roxo" />
            Swagger / Docs API
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-neutral-400 animate-pulse">
          Carregando indicadores da rede intersetorial...
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Métricas Principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-linha/80 bg-neutral-50/60 p-3.5">
              <span className="text-[11px] font-medium text-neutral-500 block">Total Encaminhados</span>
              <span className="text-xl font-bold text-black mt-0.5 block">
                {data.totalCasosEncaminhados}
              </span>
            </div>

            <div className="rounded-xl border border-linha/80 bg-emerald-50/50 p-3.5">
              <span className="text-[11px] font-medium text-emerald-700 block">Conformidade Lei 90d</span>
              <span className="text-xl font-bold text-emerald-800 mt-0.5 block flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {data.taxaConformidadeLei90d}%
              </span>
            </div>

            <div className="rounded-xl border border-linha/80 bg-amber-50/50 p-3.5">
              <span className="text-[11px] font-medium text-amber-700 block">Atenção (30-60d)</span>
              <span className="text-xl font-bold text-amber-800 mt-0.5 block flex items-center gap-1">
                <Clock className="h-4 w-4 text-amber-600" />
                {data.alertaPrazos90d.atencao}
              </span>
            </div>

            <div className="rounded-xl border border-linha/80 bg-rose-50/50 p-3.5">
              <span className="text-[11px] font-medium text-rose-700 block">Urgente (&gt;60d) / Estourado</span>
              <span className="text-xl font-bold text-rose-800 mt-0.5 block flex items-center gap-1">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                {data.alertaPrazos90d.urgente + data.alertaPrazos90d.prazo_estourado_90d}
              </span>
            </div>
          </div>

          {/* Distribuição por Equipamento da Rede */}
          <div className="rounded-xl border border-linha/80 bg-white p-4">
            <span className="text-xs font-semibold text-neutral-700 block mb-2.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-roxo" />
              Equipamentos de Destino (Saúde & Assistência Social)
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
              <div className="rounded-lg bg-neutral-100/70 p-2">
                <div className="text-[10px] text-neutral-500 font-medium">UBS</div>
                <div className="font-bold text-neutral-800 text-sm mt-0.5">{data.distribuicaoPorRede.UBS}</div>
              </div>
              <div className="rounded-lg bg-neutral-100/70 p-2">
                <div className="text-[10px] text-neutral-500 font-medium">CAPS IJ</div>
                <div className="font-bold text-neutral-800 text-sm mt-0.5">{data.distribuicaoPorRede.CAPS_IJ}</div>
              </div>
              <div className="rounded-lg bg-neutral-100/70 p-2">
                <div className="text-[10px] text-neutral-500 font-medium">CAPS AJ</div>
                <div className="font-bold text-neutral-800 text-sm mt-0.5">{data.distribuicaoPorRede.CAPS_AJ}</div>
              </div>
              <div className="rounded-lg bg-neutral-100/70 p-2">
                <div className="text-[10px] text-neutral-500 font-medium">CRAS</div>
                <div className="font-bold text-neutral-800 text-sm mt-0.5">{data.distribuicaoPorRede.CRAS}</div>
              </div>
              <div className="rounded-lg bg-neutral-100/70 p-2">
                <div className="text-[10px] text-neutral-500 font-medium">CREAS</div>
                <div className="font-bold text-neutral-800 text-sm mt-0.5">{data.distribuicaoPorRede.CREAS}</div>
              </div>
              <div className="rounded-lg bg-neutral-100/70 p-2">
                <div className="text-[10px] text-neutral-500 font-medium">C. Tutelar</div>
                <div className="font-bold text-neutral-800 text-sm mt-0.5">{data.distribuicaoPorRede.CONSELHO_TUTELAR}</div>
              </div>
            </div>
          </div>

          {/* Alerta de Casos Prioritários */}
          {data.casosCriticos.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <Activity className="h-3.5 w-3.5 text-amber-600" />
                Casos em Acompanhamento com Prioridade Temporal (Marco 2025):
              </div>
              <div className="space-y-1.5">
                {data.casosCriticos.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs bg-white/90 p-2.5 rounded-lg border border-amber-100"
                  >
                    <div>
                      <span className="font-mono font-bold text-neutral-800">{c.studentCode}</span>
                      <span className="mx-2 text-neutral-300">•</span>
                      <span className="font-medium text-neutral-700">{c.destination}</span>
                      <span className="text-neutral-500 text-[11px] block sm:inline sm:ml-2">
                        {c.reason}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 self-start sm:self-auto">
                      {c.daysElapsed} dias decorridos ({c.daysRemaining}d restantes)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-neutral-500 py-3">
          Rede conectada. Pronto para monitorar acolhimentos intersetoriais em Tarumã e municípios integrados.
        </div>
      )}
    </div>
  );
}
