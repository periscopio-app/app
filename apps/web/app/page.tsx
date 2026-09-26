import Link from "next/link";
import { InterestForm } from "../components/InterestForm";

export default function HomePage() {
  return (
    <main className="landing">

      {/* Nav */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <span className="pulse" />
          Periscópio Saúde
        </div>
        <Link href="/login" className="btn-outline-sm">
          Acessar sistema →
        </Link>
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
              <span className="stat-value">120</span>
              <span className="stat-label">dias de janela terapêutica</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">5</span>
              <span className="stat-label">perfis clínicos na esteira</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">100%</span>
              <span className="stat-label">pseudonimizado por aluno</span>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="how-it-works">
        <h2 className="section-title">Como funciona</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">01</div>
            <h3>Professor observa</h3>
            <p>Preenche a ficha FOGAP no app. Dados pseudonimizados desde o primeiro campo.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">02</div>
            <h3>PpI avalia</h3>
            <p>Aplica SNAP-IV e ABC. O sistema calcula scores e sinaliza indicações de encaminhamento.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">03</div>
            <h3>MD1 encaminha</h3>
            <p>Após 120 dias de intervenção, o caso segue para o NEMT / SUS com histórico completo.</p>
          </div>
        </div>
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

      {/* Footer */}
      <footer className="landing-footer">
        <span>© 2026 Periscópio Saúde</span>
        <span className="footer-lgpd">🔒 LGPD · sa-east-1 · Dados no Brasil</span>
      </footer>

    </main>
  );
}
