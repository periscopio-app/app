"use client";

import { useState } from "react";
import type { Assistente, Membro, MembroTecnologia } from "@/lib/equipe";

type Pessoa = {
  grupo: "Board de especialistas" | "Pesquisa" | "Tecnologia";
  nome: string;
  cargo: string;
  bio: string[];
  lattes?: string;
  foto?: string;
};

function iniciais(nome: string) {
  return nome
    .replace(/^(Dra?\.)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Avatar({ pessoa, tamanho = "h-20 w-20" }: { pessoa: Pessoa; tamanho?: string }) {
  if (pessoa.foto) {
    return (
      <img
        src={pessoa.foto}
        alt={pessoa.nome}
        loading="lazy"
        width={80}
        height={80}
        className={`${tamanho} shrink-0 rounded-full border-4 border-secondary object-cover object-top`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${tamanho} grid shrink-0 place-items-center rounded-full border-4 border-secondary bg-turquesa/15 font-display text-lg font-bold text-turquesa`}
    >
      {iniciais(pessoa.nome)}
    </span>
  );
}

function CartaoPessoa({ pessoa }: { pessoa: Pessoa }) {
  return (
    <article className="rounded-3xl bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
      <div className="mb-4">
        <Avatar pessoa={pessoa} />
      </div>
      <h4 className="font-display text-base font-semibold leading-snug text-foreground">{pessoa.nome}</h4>
      <p className="mt-2 text-sm text-muted-foreground">{pessoa.cargo}</p>
      {pessoa.lattes && (
        <a
          href={pessoa.lattes}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-empatia hover:underline"
        >
          Currículo Lattes
        </a>
      )}
      {pessoa.bio.length > 0 && (
        <details className="group mt-3 border-t border-border/70 pt-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-turquesa marker:hidden hover:underline">
            <span className="group-open:hidden">Ver mini bio</span>
            <span className="hidden group-open:inline">Ocultar mini bio</span>
          </summary>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {pessoa.bio.map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function Grupo({ titulo, pessoas, colunas }: { titulo: string; pessoas: Pessoa[]; colunas: string }) {
  if (pessoas.length === 0) return null;
  return (
    <div className="mt-10">
      <h3 className="font-display text-lg font-semibold text-foreground">{titulo}</h3>
      <div className={`mt-4 grid gap-5 ${colunas}`}>
        {pessoas.map((p) => (
          <CartaoPessoa key={p.nome} pessoa={p} />
        ))}
      </div>
    </div>
  );
}

export function EquipeSection({
  equipe,
  assistentes,
  tecnologia,
}: {
  equipe: Membro[];
  assistentes: Assistente[];
  tecnologia: MembroTecnologia[];
}) {
  const [raw, setRaw] = useState(false);

  const board: Pessoa[] = equipe.map((m) => ({
    grupo: "Board de especialistas",
    nome: m.n,
    cargo: m.r,
    bio: m.itens,
    lattes: m.lattes,
    foto: m.fotoSm ?? m.foto,
  }));
  // Evita exibir a foto de outra pessoa quando o cadastro reaproveita o mesmo arquivo.
  const fotosDoBoard = new Set(equipe.flatMap((m) => [m.foto, m.fotoSm].filter(Boolean)));
  const pesquisa: Pessoa[] = assistentes.map((a) => ({
    grupo: "Pesquisa",
    nome: a.n,
    cargo: "Assistente de pesquisa",
    bio: a.d,
    lattes: a.lattes,
    foto: a.foto && !fotosDoBoard.has(a.foto) ? a.foto : undefined,
  }));
  const tech: Pessoa[] = tecnologia.map((t) => ({
    grupo: "Tecnologia",
    nome: t.n,
    cargo: t.r,
    bio: t.d,
    lattes: t.lattes,
    foto: t.foto,
  }));
  const todos = [...board, ...pesquisa, ...tech];

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          role="switch"
          aria-checked={raw}
          onClick={() => setRaw(!raw)}
          className="inline-flex items-center gap-3 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-soft transition hover:-translate-y-0.5"
        >
          <span
            aria-hidden
            className={`relative h-5 w-9 rounded-full transition-colors ${raw ? "bg-empatia" : "bg-border"}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${raw ? "left-[1.1rem]" : "left-0.5"}`}
            />
          </span>
          {raw ? "Dados brutos (.JSON)" : "Ver dados brutos (.JSON)"}
        </button>
      </div>

      {raw ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {todos.map((p) => (
            <article key={p.nome} className="rounded-3xl bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <div>
                  <p className="font-display text-sm font-semibold text-foreground">{p.nome}</p>
                  <p className="text-xs font-semibold text-empatia">
                    {p.cargo} · [{p.grupo}]
                  </p>
                </div>
                <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">.json</span>
              </div>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background p-3 font-mono text-xs leading-relaxed text-tinta-700">
                <code>
                  {JSON.stringify(
                    { grupo: p.grupo, nome: p.nome, cargo: p.cargo, mini_bio: p.bio, lattes: p.lattes, foto: p.foto },
                    null,
                    2,
                  )}
                </code>
              </pre>
            </article>
          ))}
        </div>
      ) : (
        <>
          <Grupo titulo="Board de especialistas" pessoas={board} colunas="sm:grid-cols-2 lg:grid-cols-5" />
          <Grupo titulo="Pesquisa" pessoas={pesquisa} colunas="sm:grid-cols-2 lg:grid-cols-5" />
          <Grupo titulo="Tecnologia" pessoas={tech} colunas="sm:grid-cols-2 lg:grid-cols-5" />
        </>
      )}
    </div>
  );
}
