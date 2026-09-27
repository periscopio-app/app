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

      <section className="public-hero">
        <div>
          <p className="public-eyebrow">SAÚDE MENTAL NA ESCOLA</p>
          <h1>Enxergar cedo para cuidar a tempo de mudar o destino da criança.</h1>
          <p className="public-lead">O Periscópio ajuda escolas a perceber, ainda na infância, sinais de sofrimento e a encaminhar cada criança para o cuidado certo, unindo educação, saúde e assistência social.</p>
          <div className="public-actions"><a className="public-button" href="#metodo">Conheça o método</a><a className="public-button secondary" href="#contato">Fale conosco</a></div>
        </div>
        <div className="public-illustration" role="img" aria-label="Educadora conversando com uma criança em uma sala de aula acolhedora"><span /><i /><b /></div>
      </section>

      <section id="reconhecimentos" className="public-recognitions">{recognitions.map((item) => <span key={item}>{item}</span>)}</section>

      <section className="public-section public-history">
        <p className="public-eyebrow">O PROGRAMA</p><h2>Desde 2007 em Tarumã, SP</h2>
        <p>O Programa Periscópio nasceu como uma experiência intersetorial para apoiar a escola na observação, no cuidado e no encaminhamento responsável.</p>
        <p className="public-emphasis">Seu propósito é reduzir o sofrimento na infância e fortalecer as redes que cuidam de cada criança.</p>
      </section>

      <section id="metodo" className="public-section public-method"><p className="public-eyebrow">COMO FUNCIONA</p><h2>Uma rede que organiza o cuidado</h2>
        <div className="public-steps"><article><strong>01</strong><h3>Escola</h3><p>Professor e equipe escolar registram observações e acompanham a resposta às intervenções.</p></article><article><strong>02</strong><h3>Plataforma digital</h3><p>O fluxo integra escola, saúde, assistência e família com rastreabilidade e respeito à LGPD.</p></article><article><strong>03</strong><h3>Piloto</h3><p>Implementação assistida, com supervisão técnica e indicadores para a rede.</p></article></div>
      </section>

      <section id="equipe" className="public-section public-team"><p className="public-eyebrow">SUPERVISÃO CIENTÍFICA</p><h2>Board de Experts Sêniores</h2><p>Uma equipe multidisciplinar orienta a metodologia e a implantação junto às redes parceiras.</p></section>

      <section id="contato" className="public-contact"><div><p className="public-eyebrow">PILOTO 2026–27</p><h2>Buscamos parceiros para o piloto</h2><p>Leve o Periscópio para a sua rede de ensino ou conheça as formas de apoiar o projeto.</p></div><InterestForm /></section>
      <footer className="public-footer"><span>Periscópio · Programa de Saúde Mental na Escola</span><span>Privacidade e LGPD</span></footer>
    </main>
  );
}
