import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SiteLayout } from "@/components/SiteLayout";

export const metadata: Metadata = {
  title: "Reconhecimentos — Periscópio",
  description:
    "Premiações e marcos institucionais do Periscópio: OPAS, OMS, UNIFESP e Lei Municipal nº 1199/2016.",
  openGraph: {
    title: "Reconhecimentos — Periscópio",
    description:
      "Premiações internacionais e validação acadêmica do Programa Periscópio.",
    type: "website",
  },
};

const items = [
  {
    org: "OPAS · Organização Pan-Americana da Saúde",
    ano: "Prêmio 2017",
    titulo: "Prêmio de Inovação em Atenção Primária à Saúde",
    texto:
      "Reconhecimento concedido pela OPAS/OMS pelas práticas inovadoras de articulação intersetorial entre saúde pública e educação no enfrentamento do sofrimento emocional na infância e adolescência.",
  },
  {
    org: "OMS · Organização Mundial da Saúde",
    ano: "Recomendação 2018",
    titulo: "Modelo Recomendado de Intervenção Precoce",
    texto:
      "Citado como exemplo de política pública integrada, com estratégias preventivas de triagem precoce que aproximam a escola da atenção primária e evitam a medicalização indevida.",
  },
  {
    org: "UNIFESP · Universidade Federal de São Paulo",
    ano: "Desde 2018",
    titulo: "Supervisão Científica e Acadêmica",
    texto:
      "Acompanhamento técnico-científico com o Departamento de Psiquiatria da UNIFESP, fornecendo supervisão clínica aos casos de maior complexidade e validação metodológica aos protocolos aplicados.",
  },
  {
    org: "Poder Executivo e Legislativo de Tarumã / SP",
    ano: "Lei nº 1199/2016",
    titulo: "Institucionalização como Política Pública Municipal",
    texto:
      "Promulgação de lei pioneira que tornou o Programa Periscópio diretriz permanente da rede municipal de educação e saúde de Tarumã, garantindo continuidade e estabilidade orçamentária ao projeto.",
  },
];

export default function ReconhecimentosPage() {
  return (
    <SiteLayout>
      <PageHeader
        eyebrow="Trajetória & Certificações"
        title="Reconhecimentos e Marcos Institucionais"
        intro="Mais de uma década e meia de evidências acumuladas, premiações internacionais e impacto direto na vida de milhares de alunos e famílias."
      />

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.org} className="rounded-3xl border border-border bg-card p-8">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-roxo">{item.org}</span>
                <span className="rounded-full bg-primary/20 px-3 py-1 font-bold text-primary">{item.ano}</span>
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold text-foreground">{item.titulo}</h2>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{item.texto}</p>
            </article>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-border bg-card p-8 text-center md:p-12">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Leve essa experiência comprovada para a sua rede
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            O Periscópio Digital reúne toda essa bagagem histórica em uma plataforma web moderna, segura e pronta para
            escalar no seu município.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/#piloto"
              className="rounded-full bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
            >
              Inscrever minha escola no piloto
            </Link>
            <Link
              href="/equipe"
              className="rounded-full border border-border bg-card px-8 py-3.5 font-semibold text-foreground transition-colors hover:border-primary"
            >
              Conhecer a equipe científica →
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
