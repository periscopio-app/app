import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/SiteLayout";

export const Route = createFileRoute("/metodo")({
  head: () => ({
    meta: [
      { title: "O método — Periscópio" },
      { name: "description", content: "Como o Periscópio detecta dificuldades na escola, faz as triagens e encaminha cada criança ao cuidado certo." },
      { property: "og:title", content: "O método — Periscópio" },
      { property: "og:description", content: "Escola, núcleo assistencial e plataforma digital: o caminho da criança no Periscópio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Metodo,
});

const fluxo = [
  ["Na sala de aula", "O professor percebe dificuldades e aplica, com um responsável da escola, um projeto pedagógico especial para o aluno."],
  ["1ª triagem", "Se a dificuldade persiste, o responsável da escola amplia a observação e, com o professor, formula a hipótese de um possível transtorno."],
  ["Núcleo assistencial", "O aluno é agendado com o médico especialista e, ao mesmo tempo, com a assistente social para o atendimento familiar."],
  ["2ª triagem", "Casos graves são priorizados e discutidos com a escola e o Board de Experts Sêniores antes da intervenção."],
  ["Cuidado integral", "Conforme a necessidade: neuropsicólogo, psicomotricista, psicólogo infantil, fonoaudiólogo e psicopedagogo, além de grupos de orientação para as famílias."],
];

const objetivos = [
  "Apoiar o professor como agente de prevenção, diminuindo o estigma",
  "Organizar e registrar as informações com métricas validadas cientificamente",
  "Garantir a segurança das informações conforme a LGPD",
  "Oferecer acompanhamento e supervisão para casos graves",
  "Levar 100% dos alunos com dificuldades persistentes ao núcleo especializado",
  "Acompanhar indicadores como adesão ao tratamento (70%) e alta com sucesso (62%)",
  "Integrar educação, saúde, assistência social e proteção",
  "Oferecer apps de psicoeducação para professores e famílias",
];

function Metodo() {
  return (
    <SiteLayout>
      <main>
        <PageHeader
          eyebrow="O método"
          title="Do olhar do professor ao cuidado especializado"
          intro="Crianças de 3 a 11 anos das escolas públicas do Ensino Infantil e Fundamental I seguem um caminho claro, testado por 17 anos em Tarumã."
        />
        <section className="mx-auto max-w-4xl px-5 pb-20">
          <ol className="relative ml-4 space-y-10 border-l-2 border-border pl-8 md:ml-0">
            {fluxo.map(([t, d], i) => (
              <li key={t} className="relative">
                <span className="absolute -left-[3.05rem] flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-primary-foreground">
                  {i + 1}
                </span>
                <h2 className="font-display text-2xl text-foreground">{t}</h2>
                <p className="mt-2 text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="bg-primary py-14 md:py-20 text-primary-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-roxo">Etapa 2</p>
              <h2 className="mt-3 font-display text-3xl md:text-4xl">Por que uma plataforma digital?</h2>
              <p className="mt-5 text-primary-foreground/80">
                A maior parte das escolas não tem estrutura para reconhecer cedo as dificuldades mais graves. Transformar a
                metodologia em uma solução digital permite integrar escola, saúde, assistência social e comunidade em tempo
                real, com capacitação, supervisão remota e indicadores.
              </p>
              <p className="mt-4 text-primary-foreground/80">
                A plataforma não substitui o profissional nem a família: ela organiza o fluxo e apoia as decisões.
              </p>
            </div>
            <ul className="space-y-3">
              {objetivos.map((o) => (
                <li key={o} className="rounded-xl bg-primary-foreground/10 px-5 py-3">{o}</li>
              ))}
            </ul>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-14 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-roxo">Etapa 3</p>
          <h2 className="mt-3 font-display text-3xl text-foreground md:text-4xl">O piloto</h2>
          <p className="mt-5 max-w-3xl text-muted-foreground">
            Teste da plataforma em uma escola pública do Fundamental I com três governanças: metodológica (Dra. Ana Cecilia
            P. R. Marques), supervisão pelo Board de Experts Sêniores e operação da plataforma digital.
          </p>
        </section>
      </main>
    </SiteLayout>
  );
}
