import Link from "next/link";
import { InterestForm } from "../components/InterestForm";

const recognitions = ["OPAS · prêmio 2017", "OMS · recomendação 2018", "UNIFESP · supervisão científica", "Lei Municipal · nº 1199/2016"];

export default function HomePage() {
  return (
    <main className="public-landing">
      <nav className="public-nav" aria-label="Navegação principal">
        <Link href="/" className="public-brand">PERISCÓPIO</Link>
        <div className="public-nav-links">
          <a href="#metodo">O método</a><a href="#equipe">Equipe</a><a href="#reconhecimentos">Reconhecimentos</a>
          <a className="public-nav-cta" href="#contato">Seja parceiro</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">Piloto 2026 · Protocolo NEMT</div>
          <h1 className="hero-title">
            Da observação do professor ao<br />
            <span className="hero-highlight">encaminhamento responsável</span>
          </h1>
          <p className="hero-sub">
            Periscópio digitaliza a esteira completa de triagem em saúde mental escolar —
            escola → PpI → MD1 → SUS — com rastreabilidade, LGPD e janela terapêutica de 120 dias.
          </p>

          <div className="hero-cta">
            <Link href="/login" className="btn-primary btn-lg">
              Acessar plataforma
            </Link>
            <a href="#piloto" className="btn-ghost btn-lg">
              Quero participar do piloto ↓
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">0,70</span>
              <span className="stat-label">RR de intervenções de saúde mental escolar</span>
              <a className="stat-badge" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6137532/" target="_blank" rel="noopener noreferrer">↗ Correll et al. 2018</a>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">α=0,93</span>
              <span className="stat-label">confiabilidade da escala MSPSS</span>
              <a className="stat-badge" href="https://pubmed.ncbi.nlm.nih.gov/3288145/" target="_blank" rel="noopener noreferrer">↗ Zimet et al. 1988</a>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">1 em 5</span>
              <span className="stat-label">adolescentes com problemas de saúde mental</span>
              <a className="stat-badge" href="https://brasil.un.org/pt-br/81282-oms-1-em-cada-5-adolescentes-enfrenta-problemas-de-sa%C3%BAde-mental" target="_blank" rel="noopener noreferrer">↗ OMS/ONU 2021</a>
            </div>
          </div>

          <p className="methodology-note">
            Os dados acima são associações observadas em estudos científicos — não implicam causalidade direta.
          </p>
        </div>
        <div className="public-illustration" role="img" aria-label="Educadora conversando com uma criança em uma sala de aula acolhedora"><span /><i /><b /></div>
      </section>

      <section id="reconhecimentos" className="public-recognitions">{recognitions.map((item) => <span key={item}>{item}</span>)}</section>

      <section className="public-section public-history">
        <p className="public-eyebrow">O PROGRAMA</p><h2>Desde 2007 em Tarumã, SP</h2>
        <p>O Programa Periscópio nasceu como uma experiência intersetorial para apoiar a escola na observação, no cuidado e no encaminhamento responsável.</p>
        <p className="public-emphasis">Seu propósito é reduzir o sofrimento na infância e fortalecer as redes que cuidam de cada criança.</p>
      </section>

      {/* Fontes */}
      <section className="sources-section" id="fontes">
        <h2 className="section-title">Fontes</h2>
        <ol className="sources-list">
          <li>
            Correll JR et al. (2018). <em>Statewide mental health screening and risk stratification</em>.{" "}
            <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6137532/" target="_blank" rel="noopener noreferrer">PMC6137532</a>
          </li>
          <li>
            Zimet GD et al. (1988). <em>The Multidimensional Scale of Perceived Social Support (MSPSS)</em>.{" "}
            <a href="https://pubmed.ncbi.nlm.nih.gov/3288145/" target="_blank" rel="noopener noreferrer">PubMed 3288145</a>
          </li>
          <li>
            OMS/ONU Brasil (2021). <em>1 em cada 5 adolescentes enfrenta problemas de saúde mental</em>.{" "}
            <a href="https://brasil.un.org/pt-br/81282-oms-1-em-cada-5-adolescentes-enfrenta-problemas-de-sa%C3%BAde-mental" target="_blank" rel="noopener noreferrer">ONU Brasil</a>
          </li>
        </ol>
      </section>

      {/* Formulário de interesse */}
      <section className="pilot-section" id="piloto">
        <div className="pilot-inner">
          <div className="pilot-text">
            <h2>Sua escola pode ser parte do piloto</h2>
            <p>
              Estamos selecionando escolas municipais para a primeira fase. Participantes recebem
              acesso antecipado, suporte direto e impacto real na vida dos alunos.
            </p>
            <ul className="pilot-benefits">
              <li>✓ Acesso gratuito durante o piloto</li>
              <li>✓ Treinamento para professores e equipe clínica</li>
              <li>✓ Suporte direto da equipe Periscópio</li>
              <li>✓ Relatório de impacto ao final</li>
            </ul>
          </div>
          <div className="pilot-form-wrap">
            <InterestForm />
          </div>
        </div>
      </section>

      <section id="equipe" className="public-section public-team"><p className="public-eyebrow">SUPERVISÃO CIENTÍFICA</p><h2>Board de Experts Sêniores</h2><p>Uma equipe multidisciplinar orienta a metodologia e a implantação junto às redes parceiras.</p></section>

      <section id="contato" className="public-contact"><div><p className="public-eyebrow">PILOTO 2026–27</p><h2>Buscamos parceiros para o piloto</h2><p>Leve o Periscópio para a sua rede de ensino ou conheça as formas de apoiar o projeto.</p></div><InterestForm /></section>
      <footer className="public-footer"><span>Periscópio · Programa de Saúde Mental na Escola</span><span>Privacidade e LGPD</span></footer>
    </main>
  );
}
