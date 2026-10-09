"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/Select";
import {
  LocationSelector,
  type LocationValue,
} from "@/components/ui/LocationSelector";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, CheckCircle2, Globe2, Sparkles, MapPin } from "lucide-react";

export default function DemoSelectPage() {
  const [location, setLocation] = useState<LocationValue>({
    countryCode: "BR",
    stateUf: "SP",
    cityName: "Tarumã",
  });

  const [prioridade, setPrioridade] = useState<string>("alta");
  const [especialidade, setEspecialidade] = useState<string>("neuropsicologia");

  return (
    <div className="min-h-screen bg-fundo py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-linha pb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Início
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-roxo-100 border border-roxo px-3 py-1 text-xs font-semibold text-black">
            <Sparkles className="h-3.5 w-3.5 text-roxo" /> shadcn/ui Select Components
          </span>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
            Componentes de Seleção Leves & Cascata Geográfica
          </h1>
          <p className="text-sm text-neutral-600 max-w-2xl">
            Implementação no padrão shadcn/ui sobre Radix UI Primitive. Deixa o layout
            mais leve, fluido e menos poluído, com carregamento dinâmico de Países,
            Estados do Brasil e Municípios.
          </p>
        </div>

        {/* 1. SELETOR EM CASCATA: PAÍS -> ESTADO -> CIDADE */}
        <Card className="p-6 border-linha bg-white/90 shadow-suave rounded-2xl space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roxo-100 text-roxo font-bold">
                  <Globe2 className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-black">
                  Seletor em Cascata de Localização
                </h2>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Ao escolher o país (ex: Brasil), carrega os estados. Ao escolher o estado,
                busca dinamicamente as cidades via JSON/IBGE.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-sucesso bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Reativo & Otimizado
            </span>
          </div>

          <div className="rounded-xl border border-linha/80 bg-fundo/50 p-4">
            <LocationSelector
              value={location}
              onChange={(newVal) => setLocation(newVal)}
            />
          </div>

          {/* Feedback em tempo real */}
          <div className="rounded-xl border border-linha bg-neutral-900 text-neutral-100 p-4 text-xs font-mono space-y-2">
            <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-800 pb-2">
              <span className="flex items-center gap-1.5 font-sans font-semibold text-neutral-300">
                <MapPin className="h-3.5 w-3.5 text-roxo-200" /> Estado Atual da Seleção (JSON)
              </span>
              <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded">live state</span>
            </div>
            <pre className="text-emerald-400 overflow-x-auto py-1">
              {JSON.stringify(location, null, 2)}
            </pre>
          </div>
        </Card>

        {/* 2. DEMONSTRAÇÃO DE SELECTS SHADCN STANDALONE */}
        <Card className="p-6 border-linha bg-white/90 shadow-suave rounded-2xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-black">
              Selects Individuais shadcn/ui no Padrão Periscópio
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Menos ruído visual, cantos arredondados suaves, foco nítido e acessibilidade completa por teclado.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Prioridade */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-600">
                Nível de Prioridade da Triagem
              </label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Prioridade Clínica</SelectLabel>
                    <SelectItem value="baixa">Baixa (Rotina Escolar)</SelectItem>
                    <SelectItem value="media">Média (Acompanhamento)</SelectItem>
                    <SelectItem value="alta">Alta (Avaliação Prioritária)</SelectItem>
                    <SelectItem value="urgente">Urgente (Intervenção Imediata)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Especialidade */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-neutral-600">
                Especialidade de Encaminhamento
              </label>
              <Select value={especialidade} onValueChange={setEspecialidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Núcleo Multiprofissional</SelectLabel>
                    <SelectItem value="neuropsicologia">Neuropsicologia</SelectItem>
                    <SelectItem value="fonoaudiologia">Fonoaudiologia</SelectItem>
                    <SelectItem value="psicopedagogia">Psicopedagogia</SelectItem>
                    <SelectItem value="psicoterapia">Psicoterapia</SelectItem>
                    <SelectItem value="psicomotricidade">Psicomotricidade</SelectItem>
                    <SelectSeparator />
                    <SelectLabel>Apoio</SelectLabel>
                    <SelectItem value="servico_social">Serviço Social</SelectItem>
                    <SelectItem value="consulta_medica">Consulta Médica (MD-1)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
