import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUp, Menu, MessageCircle, X } from "lucide-react";
import logo from "@/assets/logo.webp";

export const WHATSAPP_MSG = "Olá, gostaria de saber mais sobre o Projeto Periscópio!";
export const WHATSAPP = `https://wa.me/5511984444994?text=${encodeURIComponent(WHATSAPP_MSG)}`;

const links = [
  { to: "/", label: "Início" },
  { to: "/metodo", label: "O método" },
  { to: "/equipe", label: "Equipe" },
  { to: "/reconhecimentos", label: "Reconhecimentos" },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [topo, setTopo] = useState(false);
  useEffect(() => {
    const onScroll = () => setTopo(window.scrollY > 900);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <div className="font-sans">
      <header className="sticky top-0 z-20 px-3 pt-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/70 bg-white/75 px-5 py-2 shadow-soft backdrop-blur-xl">
          <Link to="/" aria-label="Periscópio — início"><img src={logo} alt="Periscópio" width={76} height={48} className="h-10 w-auto" /></Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: true }}
                activeProps={{ className: "text-primary font-semibold" }}
                className="transition-colors hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
            <a href="/#contato" className="rounded-full bg-roxo px-5 py-2 font-medium text-roxo-foreground transition hover:-translate-y-0.5 hover:shadow-lg">
              Seja parceiro
            </a>
          </nav>
          <button className="text-primary md:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-3xl border border-white/70 bg-white/95 px-5 py-4 shadow-soft md:hidden">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: true }}
                activeProps={{ className: "rounded-xl bg-primary/10 px-3 font-semibold text-primary" }}
                className="rounded-xl px-3 py-2 text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <a href="/#contato" onClick={() => setOpen(false)} className="mt-2 rounded-full bg-primary px-4 py-2 text-center font-medium text-primary-foreground">
              Seja parceiro
            </a>
          </nav>
        )}
      </header>
      {open && <div className="fixed inset-0 z-10 bg-foreground/20 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      {children}
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar com a Dra. Ana Cecília no WhatsApp"
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
      {topo && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
          className="fixed bottom-5 left-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow md:hidden"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
      <footer className="mt-10 border-t border-border/70 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground md:flex-row md:justify-between">
          <div>
            <img src={logo} alt="Periscópio" width={101} height={64} loading="lazy" className="mb-3 h-16 w-auto" />
            <p>Programa de Saúde Mental na Escola</p>
          </div>
          <div className="md:text-right">
            <p>Dra. Ana Cecília MD</p>
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="hover:text-primary">+55 11 98444-4994</a>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-5 pb-24 text-xs text-muted-foreground md:pb-8">
          Privacidade: este site não coleta nem armazena dados pessoais. As mensagens do formulário são enviadas
          diretamente pelo seu WhatsApp. A plataforma do Periscópio segue a LGPD (Lei nº 13.709/2018).
        </p>
      </footer>
    </div>
  );
}

export function PageHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 md:pt-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-roxo">{eyebrow}</p>
      <h1 className="mt-4 max-w-3xl font-display text-[2rem] leading-tight text-foreground sm:text-4xl md:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{intro}</p>
    </section>
  );
}
