import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SiteLayout } from "@/components/SiteLayout";

export const metadata: Metadata = {
  title: "O Método — Periscópio",
  description:
    "Conheça a esteira de triagem, protocolo NEMT e a metodologia de saúde mental escolar do Periscópio.",
  openGraph: {
    title: "O Método — Periscópio",
    description:
      "Da observação do professor ao encaminhamento responsável na esteira SUS.",
    type: "website",
  },
};

export default function MetodoPage() {
  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Metodologia Científica"
        title="O Método Periscópio"
        intro="Uma abordagem intersetorial desenvolvida para identificar precocemente o sofrimento emocional em crianças e adolescentes, integrando educação e saúde pública."
      />

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-3xl border border-border bg-card p-8">
            <span className="text-sm font-bold text-black">ETAPA 1</span>
            <h2 className="mt-3 font-display text-xl font-bold text-foreground">Observação Sensível na Escola</h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              O professor e a equipe pedagógica recebem capacitação contínua para reconhecer alterações comportamentais,
              quedas bruscas de rendimento e sinais de isolamento, sem emitir diagnósticos precipitados.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8">
            <span className="text-sm font-bold text-primary">ETAPA 2</span>
            <h2 className="mt-3 font-display text-xl font-bold text-foreground">Triagem Especializada (PpI & MD1)</h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              O profissional de psicologia da rede (PpI) realiza a escuta qualificada com o aluno e a família. Em seguida,
              o caso é estratificado clinicamente com supervisão médica (MD1) conforme critérios de gravidade do protocolo NEMT.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8">
            <span className="text-sm font-bold text-black">ETAPA 3</span>
            <h2 className="mt-3 font-display text-xl font-bold text-foreground">Encaminhamento SUS Responsável</h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Casos com indicação clínica são encaminhados com dossiê estruturado para a rede pública (UBS, CAPSij, CRAS),
              assegurando o respeito à janela terapêutica de 120 dias e evitando que o jovem se perca na fila.
            </p>
          </div>
        </div>

        {/* Pilares do Método */}
        <div className="mt-16 rounded-3xl border border-border bg-card p-8 md:p-12">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Pilares do Protocolo NEMT
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Janela Terapêutica de 120 dias</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Estudos longitudinais demonstram que intervenções realizadas nos primeiros 120 dias após a manifestação
                de sintomas reduzem significativamente o risco de cronificação de transtornos mentais na juventude.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Rastreabilidade e Proteção LGPD</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cada etapa do processo é registrada em prontuário eletrônico seguro com controle estrito de acessos
                baseado em papéis (RBAC), garantindo privacidade absoluta dos dados de menores e familiares.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Supervisão Acadêmica UNIFESP</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A esteira e os critérios de triagem são submetidos a constante revisão científica por especialistas
                em psiquiatria da infância e adolescência da Universidade Federal de São Paulo.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Articulação Intersetorial</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Educação, Saúde e Assistência Social atuam como rede integrada, rompendo com o isolamento das instituições
                e colocando a criança no centro do cuidado.
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-border pt-8">
            <Link
              href="/#piloto"
              className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
            >
              Participar do piloto com sua rede
            </Link>
            <Link
              href="/equipe"
              className="rounded-full border border-border bg-card px-6 py-3 font-semibold text-foreground transition-colors hover:border-primary"
            >
              Conhecer os especialistas do Board →
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
