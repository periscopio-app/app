import "@/components/landing/landing.css";

export default function LegalPage({
  titulo,
  html,
}: {
  titulo: string;
  html: string;
}) {
  return (
    <div className="piloto legal-page">
      <div className="legal-bar">
        <div className="wrap">
          <a href="/" aria-label="Periscópio, voltar ao início">
            <img src="/landing-logo.webp" alt="Periscópio" />
          </a>
          <a className="btn btn-outline" href="/">Voltar ao site</a>
        </div>
      </div>
      <main className="legal-doc">
        <h1>{titulo}</h1>
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <div className="legal-foot">
          <a href="/privacidade">Política de Privacidade</a>
          <a href="/termos">Termos de Serviço e Uso</a>
          <a href="/">Início</a>
        </div>
      </main>
    </div>
  );
}
