"use client";

import {
  FOGAP_DESTINOS,
  DIFICULDADES_PERSISTENTES_OPCOES,
  sumarioComPadroes,
  type EscalasSumario,
  type FogapPayload,
} from "@periscopio/shared";
import { ClipboardList } from "lucide-react";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function dataBr(iso?: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  /** Código pseudonimizado do aluno (nunca o nome). */
  studentCode: string | null | undefined;
  birthYear?: number | null;
  birthMonth?: number | null;
  schoolName?: string | null;
  /** Série do cadastro do aluno (vence a do registro antigo). */
  grade?: string | null;
  payload: unknown;
  professionalName?: string | null;
  /** "rascunho": prévia viva para o RE; "enviado": o que o médico recebe. */
  modo?: "rascunho" | "enviado";
  /** Escalas ao vivo (prévia do RE). No envio, vale o retrato gravado em payload.escalas. */
  escalas?: EscalasSumario | null;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 border-b border-linha px-3 py-2 text-xs last:border-b-0 sm:grid-cols-[170px_1fr]">
      <dt className="font-semibold text-black">{rotulo}</dt>
      <dd className="min-w-0 break-words text-black">{children}</dd>
    </div>
  );
}

const vazio = <span className="italic text-neutral-600">não informado</span>;

/**
 * Formulário I — Sumário da Avaliação do RE.
 * O mesmo componente aparece para o RE (ao abrir o aluno, atualizando enquanto preenche)
 * e para o médico (após o encaminhamento), para que os dois vejam exatamente a mesma coisa.
 */
export function SumarioFormularioI({ studentCode, birthYear, birthMonth, schoolName, grade, payload, professionalName, modo = "rascunho", escalas: escalasProp }: Props) {
  const p = (payload && typeof payload === "object" ? payload : {}) as Partial<FogapPayload>;
  const s = sumarioComPadroes(p.secao_sumario as any);
  const enc = (p.secao_encaminhamento ?? { observacoes: "", data: null }) as { observacoes?: string; data?: string | null };
  const nasc = birthYear ? `${birthMonth ? `${MESES[birthMonth - 1] ?? birthMonth}/` : ""}${birthYear}` : "";
  const idade = p.idade_anos != null ? `${p.idade_anos} a${p.idade_meses ? ` ${p.idade_meses} m` : ""}` : "";
  const marcadas = new Set(s.dificuldades_persistentes);
  const extras = s.dificuldades_persistentes.filter((d) => !DIFICULDADES_PERSISTENTES_OPCOES.includes(d));
  const encaminhados = FOGAP_DESTINOS.filter((d) => s.encaminhado?.[d.key]);
  const escalas = escalasProp ?? p.escalas ?? null;
  const outro = s.encaminhado?.outro || s.encaminhado?.outro_nome?.trim();

  return (
    <section aria-label="Sumário da Avaliação do RE (Formulário I)" className="overflow-hidden rounded-2xl border border-roxo/30 bg-white shadow-suave">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-roxo/20 bg-roxo-50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-black">
          <ClipboardList className="h-4 w-4 text-roxo" aria-hidden />
          Formulário I — Sumário da Avaliação do RE
        </h3>
        <span className="rounded-full border border-roxo/30 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-black">
          {modo === "enviado" ? "Enviado ao médico" : "É este sumário que o médico recebe"}
        </span>
      </header>

      <dl>
        <Linha rotulo="Aluno">{studentCode ? <span className="font-mono font-bold">{studentCode}</span> : vazio} <span className="text-neutral-700">(só o código; sem nome)</span></Linha>
        <Linha rotulo="Nascimento / Série">
          {nasc || vazio}{idade && <span className="text-neutral-700"> · {idade}</span>} · Série: {grade?.trim() || s.serie?.trim() || vazio}
        </Linha>
        <Linha rotulo="Escola">{schoolName || vazio}</Linha>
        <Linha rotulo="Queixa do professor">{s.queixa_professor?.trim() ? <span className="whitespace-pre-wrap">{s.queixa_professor}</span> : vazio}</Linha>
        <Linha rotulo="Hipótese do RE (espectro / dimensão)">
          {s.hipotese_espectro?.trim() ? <span className="whitespace-pre-wrap">{s.hipotese_espectro}</span> : vazio}
          <span className="mt-0.5 block text-[11px] text-neutral-700">Registro do profissional; o sistema não diagnostica.</span>
        </Linha>
        <Linha rotulo="Dificuldades persistentes">
          {marcadas.size === 0 ? (
            vazio
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {[...DIFICULDADES_PERSISTENTES_OPCOES.filter((o) => marcadas.has(o)), ...extras].map((d) => (
                <span key={d} className="rounded-lg border border-roxo/30 bg-roxo-100 px-2 py-0.5 text-[11px] font-semibold">{d}</span>
              ))}
            </span>
          )}
        </Linha>
        <Linha rotulo="Escalas">
          {!escalas?.ata && !escalas?.snap4 ? (
            vazio
          ) : (
            <ul className="space-y-1">
              {escalas?.ata ? (
                <li>
                  <strong>ATA</strong>: {escalas.ata.total} de {escalas.ata.max} pontos · {escalas.ata.grupos_com_marca} de {escalas.ata.grupos_total} grupos com comportamento marcado
                  {escalas.ata.antes_36_meses ? " · sinais referidos antes dos 36 meses" : ""}
                </li>
              ) : null}
              {escalas?.snap4 ? (
                <li>
                  <strong>SNAP-IV</strong> (opcional): itens 1 a 9: {escalas.snap4.itens_1_a_9.marcados} de {escalas.snap4.itens_1_a_9.de} marcados “Bastante” ou “Demais” · itens 10 a 18: {escalas.snap4.itens_10_a_18.marcados} de {escalas.snap4.itens_10_a_18.de}
                </li>
              ) : null}
            </ul>
          )}
          <span className="mt-0.5 block text-[11px] text-neutral-700">Pontuação conforme o formulário-fonte; não é diagnóstico.</span>
        </Linha>
        <Linha rotulo="Intervenção do PpI">
          {s.conduta === "sim" ? (
            <span>
              Conduta: <strong>Sim</strong> · Qual: {s.qual || "—"} · Por quanto tempo: {s.tempo || "—"} · Resultado: {s.resultado || "—"}
            </span>
          ) : s.conduta === "nao" ? (
            <span>Conduta: <strong>Não</strong></span>
          ) : (
            vazio
          )}
        </Linha>
        <Linha rotulo="Encaminhado">
          {encaminhados.length === 0 && !outro ? (
            vazio
          ) : (
            <ul className="space-y-0.5">
              {encaminhados.map((d) => (
                <li key={d.key}>Encaminhado ao <strong>{d.label}</strong> em {dataBr(s.encaminhado?.[d.key])}</li>
              ))}
              {outro ? (
                <li>Encaminhado para <strong>{s.encaminhado?.outro_nome?.trim() || "outro"}</strong>{s.encaminhado?.outro ? ` em ${dataBr(s.encaminhado.outro)}` : ""}</li>
              ) : null}
            </ul>
          )}
        </Linha>
        {enc.observacoes?.trim() ? <Linha rotulo="Observações">{<span className="whitespace-pre-wrap">{enc.observacoes}</span>}</Linha> : null}
        <Linha rotulo="Data / RE">
          {dataBr(enc.data) || vazio} · {professionalName || "Responsável Escolar"}
        </Linha>
      </dl>
    </section>
  );
}
