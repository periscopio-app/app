import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, WHATSAPP } from "@/components/SiteLayout";
import { ContactForm } from "@/components/ContactForm";
import { equipe } from "@/lib/equipe";
import hero from "@/assets/hero.webp";
import { VideoTaruma } from "@/components/VideoTaruma";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Periscópio — Saúde Mental na Escola" },
      {
        name: "description",
        content:
          "Programa premiado pela OPAS e recomendado pela OMS para detecção precoce de sofrimento na infância, integrando escola, saúde e assistência social.",
      },
      { property: "og:title", content: "Periscópio — Saúde Mental na Escola" },
      {
        property: "og:description",
        content: "Detecção precoce, na escola, para uma infância com mais cuidado. Conheça o programa e o piloto 2026-27.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://projetoperiscopio.lovable.app/og.jpg" },
      { name: "twitter:image", content: "https://projetoperiscopio.lovable.app/og.jpg" },
    ],
  }),
  component: Index,
});


const stats = [
  ["50%", "dos transtornos mentais aparecem antes dos 14 anos", "bg-primary/10 text-primary"],
  ["90%", "deles não chegam a ter tratamento", "bg-accent/25 text-[oklch(0.5_0.11_70)]"],
  ["1 em 4", "crianças e adolescentes tem algum transtorno mental", "bg-roxo/10 text-roxo"],
  ["US$ 10", "retornam para cada dólar investido em prevenção", "bg-verde/15 text-verde"],
];

const etapas = [
  { n: "1", t: "Escola", c: "bg-primary", d: "Professor e um responsável da escola aplicam um projeto pedagógico especial ao aluno com dificuldades, acompanham a resposta e, se persistir, encaminham ao núcleo assistencial (1ª triagem)." },
  { n: "2", t: "Plataforma digital", c: "bg-roxo", d: "A metodologia validada por 17 anos vira uma ferramenta escalável: integra escola, saúde, assistência social e família em tempo real, com registro seguro, indicadores e respeito à LGPD." },
  { n: "3", t: "Piloto", c: "bg-accent", d: "Teste em uma escola pública do Fundamental I sorteada, próxima a um CAPS IJ, AME ou AMA, com supervisão do Board de Experts Sêniores." },
];

const selos = [
  ["OPAS", "prêmio 2017"],
  ["OMS", "recomendação 2018"],
  ["UNIFESP", "supervisão científica"],
  ["Lei Municipal", "nº 1199/2016"],
];

const fases = [
  ["Fase 1", "Preparação da escola", "Curso EAD, capacitação com o Guia Prático e a ferramenta digital, definição de fluxos e início dos registros."],
  ["Fase 2", "Preparação do núcleo", "Equipe multidisciplinar, protocolos clínicos, orientação familiar e supervisão técnica."],
  ["Fase 3", "Integração escola e núcleo", "Priorização por gravidade, discussão de casos, apps de psicoeducação e relatório final do piloto."],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-roxo shadow-soft">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      {children}
    </p>
  );
}

function Index() {
  return (
    <SiteLayout>
      <main>
        {/* HERO */}
        <section className="bg-aurora">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:pb-24 md:pt-20">
            <div>
              <div className="reveal"><Eyebrow>Saúde Mental na Escola</Eyebrow></div>
              <h1 className="reveal reveal-2 mt-6 font-display text-[2.3rem] font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-[3.4rem]">
                Enxergar cedo para <span className="text-gradient">cuidar a tempo</span> de mudar o destino da criança.
              </h1>
              <p className="reveal reveal-3 mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                O Periscópio ajuda escolas a perceber, ainda na infância, sinais de sofrimento e a encaminhar cada criança
                para o cuidado certo, unindo educação, saúde e assistência social.
              </p>
              <div className="reveal reveal-4 mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to="/metodo" className="rounded-full bg-roxo px-7 py-3.5 text-center font-semibold text-roxo-foreground shadow-lift transition hover:-translate-y-0.5">
                  Conheça o método
                </Link>
                <a href={WHATSAPP} target="_blank" rel="noreferrer" className="rounded-full border border-border bg-white px-7 py-3.5 text-center font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-primary">
                  Fale conosco
                </a>
              </div>
              <ul className="reveal reveal-4 mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden />Desde 2007</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" aria-hidden />Premiado pela OPAS</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-roxo" aria-hidden />Recomendado pela OMS</li>
              </ul>
            </div>
            <div className="reveal reveal-2 relative mx-auto w-full max-w-md md:max-w-none">
              <div className="blob absolute -inset-4 -z-10 bg-gradient-to-br from-primary/25 via-accent/25 to-roxo/20 blur-2xl" aria-hidden />
              <img src={hero} alt="Professora acolhendo aluno em sala de aula" width={1024} height={819} fetchPriority="high" className="w-full rounded-[2.5rem] border-4 border-white object-cover shadow-lift" />
              <div className="float-slow absolute -bottom-5 -left-3 rounded-2xl bg-white px-4 py-3 shadow-lift sm:-left-6">
                <p className="font-display text-2xl font-bold text-primary">17 anos</p>
                <p className="text-xs text-muted-foreground">de metodologia validada</p>
              </div>
              <div className="float-slow-2 absolute -right-2 -top-4 hidden rounded-2xl sm:block bg-white px-4 py-3 shadow-lift sm:-right-5">
                <p className="font-display text-lg font-bold text-roxo">Intersetorial</p>
                <p className="text-xs text-muted-foreground">escola · saúde · assistência</p>
              </div>
            </div>
          </div>
        </section>

        {/* SELOS */}
        <section aria-label="Reconhecimentos" className="mx-auto max-w-6xl px-5">
          <div className="-mt-6 flex flex-col gap-4 rounded-3xl bg-white px-6 py-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-semibold sm:flex sm:flex-wrap sm:gap-x-8">
              {selos.map(([sl, d]) => (
                <li key={sl}><span className="text-roxo">{sl}</span> <span className="font-normal text-muted-foreground">· {d}</span></li>
              ))}
            </ul>
            <Link to="/reconhecimentos" className="shrink-0 text-sm font-semibold text-primary hover:underline">Ver reconhecimentos →</Link>
          </div>
        </section>

        {/* PROGRAMA */}
        <section id="programa" className="py-20 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[1fr_1.4fr]">
            <div>
              <Eyebrow>Nossa história</Eyebrow>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">Desde 2007 em Tarumã, SP</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
              <p>
                O Programa Periscópio nasceu em 2007 no município de Tarumã (SP), coordenado pela Dra. Ana Cecilia Petta
                Roselli Marques com supervisores doutores pela UNIFESP, um board de experts sêniores e colaboradores locais.
              </p>
              <p>
                Seu principal objetivo é a <strong className="text-foreground">detecção precoce de dificuldades</strong> em
                alunos do Ensino Infantil e Fundamental I, aliviando o sofrimento na infância e prevenindo comportamentos de
                risco na adolescência e na vida adulta.
              </p>
              <p>
                Reconhecido internacionalmente, é uma experiência intersetorial, sustentável e baseada em evidências que pode
                ser replicada em outras cidades.
              </p>
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-5">
            <a
              href="https://www.who.int/news-room/feature-stories/detail/tackling-the-harmful-effects-of-alcohol--locally-in-the-city-of-tarum---brazil"
              target="_blank"
              rel="noreferrer"
              className="mt-14 flex flex-col gap-5 rounded-[2rem] bg-gradient-to-br from-primary/15 via-white to-accent/20 p-8 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift md:flex-row md:items-center md:justify-between md:p-10"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-roxo">Organização Mundial da Saúde</p>
                <h3 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">A OMS conta a história do Periscópio em Tarumã</h3>
                <p className="mt-2 text-muted-foreground">
                  Reportagem oficial sobre como a cidade enfrentou localmente os efeitos nocivos do álcool.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-roxo px-6 py-3 text-center font-semibold text-roxo-foreground">Ler na OMS →</span>
            </a>
            <VideoTaruma />
          </div>
        </section>

        {/* POR QUE */}
        <section id="porque" className="bg-soft-turquesa py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Eyebrow>Por que isso importa</Eyebrow>
            <h2 className="mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Não existe saúde sem saúde mental, e ela começa na infância.
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(([n, t, c]) => (
                <div key={n} className="rounded-3xl bg-white p-7 shadow-soft transition hover:-translate-y-1">
                  <p className={`inline-block rounded-2xl px-3 py-1 font-display text-3xl font-bold ${c}`}>{n}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como" className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">Três passos, um cuidado contínuo</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {etapas.map((e) => (
                <li key={e.n} className="relative rounded-3xl border border-border/70 bg-white p-8 shadow-soft">
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl font-display text-xl font-bold text-foreground ${e.c} ${e.c === "bg-roxo" ? "text-roxo-foreground" : ""}`}>{e.n}</span>
                  <h3 className="mt-5 font-display text-xl font-semibold text-foreground">{e.t}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{e.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-col gap-5 rounded-3xl bg-secondary px-7 py-6 md:flex-row md:items-center md:justify-between">
              <p className="max-w-3xl text-muted-foreground">
                A plataforma não substitui o profissional da escola, da saúde ou da assistência social, muito menos a família.
                Ela organiza o fluxo, facilita as tarefas e apoia a tomada de decisão.
              </p>
              <Link to="/metodo" className="shrink-0 rounded-full bg-white px-6 py-3 text-center font-semibold text-primary shadow-soft transition hover:-translate-y-0.5">Ver o método completo →</Link>
            </div>
          </div>
        </section>

        {/* EQUIPE */}
        <section id="equipe" className="bg-soft-turquesa py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>Quem cuida</Eyebrow>
                <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">Board de Experts Sêniores</h2>
              </div>
              <Link to="/equipe" className="text-sm font-semibold text-primary hover:underline">Ver currículos completos →</Link>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {equipe.map((m) => (
                <Link key={m.n} to="/equipe" className="group rounded-3xl bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                  {m.foto && <img src={m.fotoSm ?? m.foto} alt={m.n} loading="lazy" width={80} height={80} className="mb-4 h-20 w-20 rounded-full border-4 border-secondary object-cover object-top" />}
                  <h3 className="font-display text-base font-semibold leading-snug text-foreground">{m.n}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{m.r}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* PILOTO */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Eyebrow>Piloto 2026-27</Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">Três fases de cerca de 3 meses cada</h2>
            <div className="relative mt-12 grid gap-6 md:grid-cols-3">
              <div className="absolute left-0 right-0 top-[1.15rem] hidden h-0.5 bg-gradient-to-r from-primary via-accent to-roxo md:block" aria-hidden />
              {fases.map(([f, t, d], i) => (
                <div key={f} className="relative">
                  <span className={`relative z-10 grid h-9 w-9 place-items-center rounded-full text-sm font-bold ring-4 ring-background ${["bg-primary text-foreground", "bg-accent text-foreground", "bg-roxo text-roxo-foreground"][i]}`}>{i + 1}</span>
                  <div className="mt-5 rounded-3xl border border-border/70 bg-white p-6 shadow-soft">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-roxo">{f}</p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-foreground">{t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONTATO */}
        <section id="contato" className="px-5 pb-20">
          <div className="mx-auto grid max-w-6xl gap-10 rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-white to-accent/25 px-8 py-14 shadow-lift md:grid-cols-2 md:px-14">
            <div>
              <Eyebrow>Vamos juntos</Eyebrow>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">Buscamos parceiros para o piloto</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Quer levar o Periscópio para a sua rede de ensino ou apoiar o projeto? Fale com a coordenação.
              </p>
              <p className="mt-8 font-display font-semibold text-foreground">Dra. Ana Cecília MD</p>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="mt-1 inline-block font-medium text-roxo underline underline-offset-4">
                +55 11 98444-4994
              </a>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
