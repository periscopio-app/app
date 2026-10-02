import type { Metadata } from "next";
import LandingClient from "@/components/landing/LandingClient";
import { LANDING_HTML } from "@/components/landing/landing-html";
import { assistentes, equipe, tecnologia } from "@/lib/equipe";

export const metadata: Metadata = {
  title: "Periscópio Saúde Mental na Escola",
  description:
    "Procuramos instituições sem fins lucrativos, governo e escolas para o piloto do Periscópio, que liga escola, saúde e assistência social em um só caminho de cuidado.",
};

const esc = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function pessoa(
  n: string,
  r: string,
  foto: string | undefined,
  linhas: string[],
  lattes?: string,
) {
  const img = foto
    ? `<img src="${esc(foto)}" alt="Foto de ${esc(n)}" loading="lazy" width="96" height="96">`
    : "";
  const lis = linhas.map((l) => `<li>${esc(l)}</li>`).join("");
  const lk = lattes
    ? `<a class="lattes" href="${esc(lattes)}" target="_blank" rel="noopener noreferrer">Currículo Lattes</a>`
    : "";
  return `<article class="person">${img}<div><h3>${esc(n)}</h3><p class="role">${esc(r)}</p>${lis ? `<ul>${lis}</ul>` : ""}${lk}</div></article>`;
}

function equipeHtml() {
  const board = equipe
    .map((m) => pessoa(m.n, m.r, m.fotoSm ?? m.foto, m.itens.slice(0, 2), m.lattes))
    .join("");
  const apoio = assistentes
    .map((a) => pessoa(a.n, "Assistente de pesquisa", a.foto, a.d.slice(0, 1), a.lattes))
    .join("");
  const tec = tecnologia
    .map((t) => pessoa(t.n, t.r, t.foto, [], t.lattes))
    .join("");
  return `<section class="team" id="equipe"><div class="wrap">
  <div class="sec-head"><span class="eyebrow">Quem está por trás</span>
  <h2>Profissionais que cuidam do método e da plataforma</h2>
  <p class="lead">Psiquiatras, neuropsicóloga, fonoaudióloga e psicopedagoga supervisionam o método, discutem os casos mais difíceis e acompanham o piloto.</p></div>
  <h3 class="grp">Board de especialistas</h3><div class="people">${board}</div>
  <h3 class="grp">Pesquisa</h3><div class="people">${apoio}</div>
  <h3 class="grp">Tecnologia</h3><div class="people">${tec}</div>
  </div></section>`;
}

export default function Home() {
  return <LandingClient html={LANDING_HTML.replace("__EQUIPE__", equipeHtml())} />;
}
