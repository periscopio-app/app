import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/SiteLayout";

export const Route = createFileRoute("/reconhecimentos")({
  head: () => ({
    meta: [
      { title: "Reconhecimentos — Periscópio" },
      { name: "description", content: "Lei municipal, prêmio da OPAS e recomendação da OMS: os marcos do Programa Periscópio." },
      { property: "og:title", content: "Reconhecimentos — Periscópio" },
      { property: "og:description", content: "Premiado pela OPAS em 2017 e recomendado pela OMS em 2018." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reconhecimentos,
});

const marcos = [
  {
    a: "2013",
    t: "Núcleo Educacional Multidisciplinar de Tarumã",
    d: "Decreto municipal que cria o núcleo multidisciplinar de apoio às escolas.",
    link: "https://leismunicipais.com.br/a1/sp/t/taruma/decreto/2013/140/1393/-dispoe-sobre-a-criacao-do-nucleo-educacional-multidisciplinar-de-tarumanemt-e-da-outras-providencias",
  },
  {
    a: "2015",
    t: "Aprovado pela Câmara Municipal",
    d: "O Saúde Mental na Escola passa a ser um dos serviços de saúde de Tarumã.",
  },
  {
    a: "2016",
    t: "Lei Municipal nº 1199/2016",
    d: "Política pública municipal de atenção integral que inclui as ações preventivas do Periscópio.",
    link: "https://leismunicipais.com.br/a1/sp/t/taruma/lei-ordinaria/2016/120/1199/lei-ordinaria-dispoe-sobre-a-implementacao-e-organizacao-da-politica-publica-municipal-de-atencao-integral-a-usuarios-de-alcool-e-outras-drogas-e-da-outras-providencias",
  },
  {
    a: "2017",
    t: "Prêmio OPAS",
    d: "Selecionado entre as experiências significativas de promoção da saúde pela Organização Pan-Americana da Saúde.",
    link: "https://www.paho.org/es/noticias/15-9-2017-13-iniciativas-seleccionadas-concurso-experiencias-significativas-promocion",
  },
  {
    a: "2018",
    t: "Recomendação da OMS",
    d: "A Organização Mundial da Saúde destaca a experiência de Tarumã como modelo para replicação.",
    link: "https://www.who.int/news-room/feature-stories/detail/tackling-the-harmful-effects-of-alcohol--locally-in-the-city-of-tarum---brazil",
  },
];

function Reconhecimentos() {
  return (
    <SiteLayout>
      <main>
        <PageHeader
          eyebrow="Reconhecimentos"
          title="Uma experiência reconhecida no Brasil e no mundo"
          intro="Da lei municipal às organizações internacionais de saúde, os marcos que validam o Periscópio."
        />
        <section className="mx-auto max-w-4xl px-5 pb-24">
          <div className="space-y-5">
            {marcos.map((m) => (
              <article key={m.a} className="grid gap-4 rounded-3xl border border-border bg-card p-8 md:grid-cols-[8rem_1fr]">
                <p className="font-display text-4xl text-roxo">{m.a}</p>
                <div>
                  <h2 className="font-display text-2xl text-foreground">{m.t}</h2>
                  <p className="mt-2 text-muted-foreground">{m.d}</p>
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-roxo underline underline-offset-4">
                      Ver fonte oficial
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
