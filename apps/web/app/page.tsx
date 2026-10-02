import Link from "next/link";
import { InterestForm } from "../components/InterestForm";
import { SiteLayout } from "../components/SiteLayout";

const recognitions = [
  { label: "OPAS · prêmio 2017", desc: "Premiação por inovação em atenção primária e saúde pública" },
  { label: "OMS · recomendação 2018", desc: "Recomendado como modelo de intervenção precoce intersetorial" },
  { label: "UNIFESP · supervisão científica", desc: "Acompanhamento acadêmico e validação contínua dos protocolos" },
  { label: "Lei Municipal · nº 1199/2016", desc: "Instituído como política pública oficial no município de Tarumã, SP" },
];

const teamPreview = [
  { n: "Dra. Ana Cecília MD", r: "Psiquiatra da Infância e Adolescência", foto: "/equipe/ana-cecilia-sm.webp" },
  { n: "Dra. Ivete Gattas", r: "Psiquiatra da Infância e Adolescência (UNIFESP)", foto: "/equipe/ivete-gattas-sm.webp" },
  { n: "Dra. Patrícia Salles", r: "Neuropsicóloga", foto: "/equipe/patricia-salles-sm.webp" },
  { n: "Dra. Luciene Stivanin", r: "Fonoaudióloga e Pesquisadora", foto: "/equipe/luciene-stivanin-sm.webp" },
];

export default function HomePage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-12 pb-16 text-center md:pt-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sucesso/30 bg-sucesso/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sucesso">
            Piloto 2026 · Protocolo NEMT
          </div>

          <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground sm:text-5xl md:text-6xl">
            Da observação do professor ao{" "}
            <span className="text-primary">encaminhamento responsável</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            O Periscópio digitaliza a esteira completa de triagem em saúde mental escolar —
            escola → PpI → MD1 → SUS — com rastreabilidade, LGPD e janela terapêutica de 120 dias.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
            >
              Acessar plataforma
            </Link>
            <a
              href="#piloto"
              className="rounded-full border border-border bg-card px-8 py-3.5 font-semibold text-foreground transition-colors hover:border-primary"
            >
              Quero participar do piloto ↓
            </a>
          </div>
        </div>

        {/* Hero Image */}
        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          <img
            src="/equipe/hero.webp"
            alt="Programa Periscópio — Cuidado e saúde mental na escola"
            className="max-h-[460px] w-full object-cover"
          />
        </div>

        {/* Stats */}
        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center">
              <span className="font-display text-3xl font-bold text-primary sm:text-4xl">0,70</span>
              <span className="mt-1 text-xs text-muted-foreground">RR de intervenções de saúde mental escolar</span>
              <a
                className="mt-2 text-xs font-medium text-roxo underline"
                href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6137532/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗ Correll et al. 2018
              </a>
            </div>
            <div className="flex flex-col items-center border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0">
              <span className="font-display text-3xl font-bold text-primary sm:text-4xl">α=0,93</span>
              <span className="mt-1 text-xs text-muted-foreground">Confiabilidade da escala MSPSS</span>
              <a
                className="mt-2 text-xs font-medium text-roxo underline"
                href="https://pubmed.ncbi.nlm.nih.gov/3288145/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗ Zimet et al. 1988
              </a>
            </div>
            <div className="flex flex-col items-center border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0">
              <span className="font-display text-3xl font-bold text-primary sm:text-4xl">1 em 5</span>
              <span className="mt-1 text-xs text-muted-foreground">Adolescentes enfrentam problemas de saúde mental</span>
              <a
                className="mt-2 text-xs font-medium text-roxo underline"
                href="https://brasil.un.org/pt-br/81282-oms-1-em-cada-5-adolescentes-enfrenta-problemas-de-sa%C3%BAde-mental"
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗ OMS/ONU 2021
              </a>
            </div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Os dados acima são associações observadas em estudos científicos — não implicam causalidade direta.
          </p>
        </div>
      </section>

      {/* Reconhecimentos */}
      <section id="reconhecimentos" className="border-y border-border bg-card/40 py-12">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-roxo">RECONHECIMENTOS & MARCOS</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-foreground">Validado por instituições de referência</h2>
            </div>
            <Link
              href="/reconhecimentos"
              className="text-sm font-semibold text-primary transition-colors hover:underline"
            >
              Conheça a trajetória completa →
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recognitions.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-card p-5">
                <span className="font-semibold text-foreground">{item.label}</span>
                <p className="mt-2 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O Método */}
      <section id="metodo" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-roxo">O PROGRAMA & O MÉTODO</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
              Desde 2007 em Tarumã, SP
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              O Programa Periscópio nasceu como uma experiência intersetorial para apoiar a escola na observação, no
              cuidado e no encaminhamento responsável. Seu propósito é reduzir o sofrimento na infância e fortalecer as redes
              que cuidam de cada criança.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <article className="rounded-3xl border border-border bg-card p-8">
              <span className="text-sm font-bold text-roxo">01 · ESCOLA</span>
              <h3 className="mt-3 font-display text-xl font-semibold text-foreground">Observação do Professor</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Educadores capacitados registram sinais de alerta comportamentais e emocionais sem rótulos diagnósticos,
                garantindo escuta qualificada no ambiente escolar.
              </p>
            </article>

            <article className="rounded-3xl border border-border bg-card p-8">
              <span className="text-sm font-bold text-primary">02 · TRIAGEM</span>
              <h3 className="mt-3 font-display text-xl font-semibold text-foreground">Protocolo NEMT & PpI</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Profissionais de psicologia realizam o acolhimento estruturado com a família e aplicam a triagem clínica com
                validação médica (MD1).
              </p>
            </article>

            <article className="rounded-3xl border border-border bg-card p-8">
              <span className="text-sm font-bold text-sucesso">03 · CUIDADO</span>
              <h3 className="mt-3 font-display text-xl font-semibold text-foreground">Encaminhamento Responsável</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Integração transparente com a rede SUS (CAPSij, UBS, CRAS) dentro da janela terapêutica de 120 dias, com
                rastreabilidade de ponta a ponta.
              </p>
            </article>
          </div>

          <div className="mt-8 text-center md:text-left">
            <Link
              href="/metodo"
              className="inline-block font-medium text-roxo underline underline-offset-4"
            >
              Ver detalhes científicos e fluxo do método →
            </Link>
          </div>
        </div>
      </section>

      {/* Equipe Preview */}
      <section id="equipe" className="border-t border-border bg-card/40 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-roxo">SUPERVISÃO CIENTÍFICA</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-foreground">Board de Experts Sêniores</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Equipe multidisciplinar em psiquiatria, neuropsicologia e fonoaudiologia que supervisiona o método.
              </p>
            </div>
            <Link
              href="/equipe"
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary"
            >
              Conhecer toda a equipe →
            </Link>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {teamPreview.map((m) => (
              <div key={m.n} className="flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center">
                <img
                  src={m.foto}
                  alt={`Foto de ${m.n}`}
                  className="mb-4 h-24 w-24 rounded-full object-cover object-top"
                />
                <h3 className="font-semibold text-foreground">{m.n}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{m.r}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulário do Piloto / Contato */}
      <section id="piloto" className="py-20">
        <div id="contato" className="mx-auto max-w-6xl px-5">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-roxo">PILOTO 2026–2027</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
                Sua escola pode fazer parte do piloto
              </h2>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                Estamos selecionando redes municipais e escolas para a primeira fase de implantação da plataforma digital.
                Participe e receba capacitação para a sua equipe pedagógica e clínica.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sucesso/15 text-xs font-bold text-sucesso">✓</div>
                  <p className="text-sm text-foreground">Acesso gratuito durante a fase piloto</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sucesso/15 text-xs font-bold text-sucesso">✓</div>
                  <p className="text-sm text-foreground">Treinamento para professores e equipe clínica</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sucesso/15 text-xs font-bold text-sucesso">✓</div>
                  <p className="text-sm text-foreground">Supervisão direta com os especialistas do Board</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sucesso/15 text-xs font-bold text-sucesso">✓</div>
                  <p className="text-sm text-foreground">Relatório e mensuração de impacto na saúde escolar</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-8 shadow-xl">
              <InterestForm />
            </div>
          </div>
        </div>
      </section>

      {/* Fontes Científicas */}
      <section id="fontes" className="border-t border-border bg-card/20 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-xl font-bold text-foreground">Fontes e Referências Científicas</h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
            <li>
              Correll JR et al. (2018). <em>Statewide mental health screening and risk stratification</em>.{" "}
              <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6137532/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                PMC6137532
              </a>
            </li>
            <li>
              Zimet GD et al. (1988). <em>The Multidimensional Scale of Perceived Social Support (MSPSS)</em>.{" "}
              <a href="https://pubmed.ncbi.nlm.nih.gov/3288145/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                PubMed 3288145
              </a>
            </li>
            <li>
              OMS/ONU Brasil (2021). <em>1 em cada 5 adolescentes enfrenta problemas de saúde mental</em>.{" "}
              <a href="https://brasil.un.org/pt-br/81282-oms-1-em-cada-5-adolescentes-enfrenta-problemas-de-sa%C3%BAde-mental" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                ONU Brasil
              </a>
            </li>
          </ol>
        </div>
      </section>
    </SiteLayout>
  );
}
