import Link from "next/link";
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
          <Link href="/" aria-label="Periscópio, voltar ao início">
            <img src="/landing-logo.webp" alt="Periscópio" />
          </Link>
          <Link className="btn btn-outline" href="/">Voltar ao site</Link>
        </div>
      </div>
      <main className="legal-doc">
        <h1>{titulo}</h1>
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <div className="legal-foot">
          <Link href="/privacidade">Política de Privacidade</Link>
          <Link href="/termos">Termos de Serviço e Uso</Link>
          <Link href="/">Início</Link>
        </div>
      </main>
    </div>
  );
}
