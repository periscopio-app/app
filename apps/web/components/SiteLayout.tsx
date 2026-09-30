"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Menu, MessageCircle, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Início" },
  { href: "/metodo", label: "O método" },
  { href: "/equipe", label: "Equipe" },
  { href: "/reconhecimentos", label: "Reconhecimentos" },
];

const WHATSAPP_MSG = "Olá, gostaria de saber mais sobre o Projeto Periscópio!";
const WHATSAPP =
  "https://wa.me/5511984444994?text=" + encodeURIComponent(WHATSAPP_MSG);

export function SiteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [topo, setTopo] = useState(false);

  useEffect(() => {
    const onScroll = () => setTopo(window.scrollY > 900);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const isActive = (href: string) => pathname === href;

  return (
    <div className="font-sans">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="Periscópio — início">
            <img src="/equipe/logo.webp" alt="Logo do Periscópio" className="h-12 w-auto" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "transition-colors hover:text-primary" +
                  (isActive(l.href) ? " font-semibold text-primary" : "")
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <a
            href="/#contato"
            className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Seja parceiro
          </a>
          <button
            type="button"
            className="text-primary md:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-border px-5 py-4 md:hidden">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "py-2 text-foreground" +
                  (isActive(l.href)
                    ? " border-l-4 border-primary pl-3 font-semibold text-foreground"
                    : "")
                }
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <a
              href="/#contato"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-primary px-4 py-2 text-center font-medium text-primary-foreground"
            >
              Seja parceiro
            </a>
          </nav>
        )}
      </header>
      {open && (
        <div
          className="fixed inset-0 z-10 bg-foreground/20 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <main>{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground md:flex-row md:justify-between">
          <div>
            <img
              src="/equipe/logo.webp"
              alt="Logo do Periscópio"
              loading="lazy"
              className="mb-3 h-16 w-auto"
            />
            <p>Programa de Saúde Mental na Escola</p>
          </div>
          <div className="md:text-right">
            <p>Dra. Ana Cecília MD</p>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-muted-foreground transition-colors hover:text-primary"
            >
              +55 11 98444-4994
            </a>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-5 pb-24 text-xs text-muted-foreground md:pb-8">
          Privacidade: este site não coleta nem armazena dados pessoais. Os dados
          informados no formulário de contato são usados apenas para retornar o
          seu contato, em conformidade com a LGPD (Lei nº 13.709/2018).
        </p>
      </footer>

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
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
          className="fixed bottom-5 left-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow md:hidden"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 md:pt-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-roxo">
        {eyebrow}
      </p>
      <h1 className="mt-4 max-w-3xl font-display text-[2rem] leading-tight text-foreground sm:text-4xl md:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{intro}</p>
    </section>
  );
}