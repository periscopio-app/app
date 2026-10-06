import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHeader } from "@/components/SiteLayout";
import { equipe, assistentes, tecnologia } from "@/lib/equipe";

export const Route = createFileRoute("/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — Periscópio" },
      { name: "description", content: "Conheça o Board de Experts Sêniores e a equipe de pesquisa do Programa Periscópio." },
      { property: "og:title", content: "Equipe — Periscópio" },
      { property: "og:description", content: "Psiquiatras, neuropsicóloga e fonoaudióloga que supervisionam o Periscópio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Equipe,
});

function Equipe() {
  return (
    <SiteLayout>
      <main>
        <PageHeader
          eyebrow="Quem faz"
          title="Board de Experts Sêniores"
          intro="Especialistas em psiquiatria, neuropsicologia e fonoaudiologia que supervisionam o método, discutem os casos graves e acompanham o piloto."
        />
        <section className="mx-auto grid max-w-6xl gap-6 px-5 pb-16 md:grid-cols-2">
          {equipe.map((m) => (
            <article key={m.n} className="rounded-3xl border border-border bg-card p-8">
              {m.foto && <img src={m.foto} alt={m.n} loading="lazy" width={160} height={160} className="mb-6 h-40 w-40 rounded-full object-cover object-top" />}
              <h2 className="font-display text-2xl text-foreground">{m.n}</h2>
              <p className="mt-1 font-medium text-roxo">{m.r}</p>
              {m.itens.length > 0 ? (
                <ul className="mt-5 list-disc space-y-2 pl-5 text-muted-foreground">
                  {m.itens.map((i) => <li key={i}>{i}</li>)}
                </ul>
              ) : (
                <p className="mt-5 text-muted-foreground">Currículo em breve.</p>
              )}
              {m.lattes && (
                <a href={m.lattes} target="_blank" rel="noreferrer" className="mt-6 inline-block font-medium text-roxo underline underline-offset-4">
                  Currículo Lattes
                </a>
              )}
            </article>
          ))}
        </section>
        <section className="bg-card py-16">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-display text-3xl text-foreground">Assistentes de pesquisa</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {assistentes.map((a) => (
                <div key={a.n} className="rounded-2xl bg-secondary p-6">
                  {a.foto && <img src={a.foto} alt={a.n} loading="lazy" width={96} height={96} className="mb-4 h-24 w-24 rounded-full object-cover object-top" />}
                  <p className="font-semibold text-secondary-foreground">{a.n}</p>
                  {a.d.map((t) => (
                    <p key={t} className="mt-2 text-sm text-muted-foreground">{t}</p>
                  ))}
                  {a.lattes && (
                    <a href={a.lattes} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-roxo underline underline-offset-4">
                      Currículo Lattes
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-display text-3xl text-foreground">Plataforma digital</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {tecnologia.map((t) => (
                <div key={t.n} className="rounded-2xl border border-border bg-card p-6">
                  {t.foto && <img src={t.foto} alt={t.n} loading="lazy" width={96} height={96} className="mb-4 h-24 w-24 rounded-full object-cover object-top" />}
                  <p className="font-semibold text-foreground">{t.n}</p>
                  <p className="mt-1 text-sm font-medium text-roxo">{t.r}</p>
                  {t.d.map((x) => (
                    <p key={x} className="mt-2 text-sm text-muted-foreground">{x}</p>
                  ))}
                  {t.lattes && (
                    <a href={t.lattes} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-roxo underline underline-offset-4">
                      Currículo Lattes
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
