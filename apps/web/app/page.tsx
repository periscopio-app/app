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

const ASSET_JSONS: Record<string, any> = {
  "Dra. Ana Cecilia Petta Roselli Marques": {
    asset_id: "4f1eb990-02c5-4346-aa1d-0e978be20b2a",
    content_type: "image/jpeg",
    created_at: "2026-09-23T19:14:12Z",
    original_filename: "ana-cecilia.jpg",
    project_id: "86746dcc-27ab-4b20-b82c-d603ec04c961",
    r2_key: "a/v1/86746dcc-27ab-4b20-b82c-d603ec04c961/4f1eb990-02c5-4346-aa1d-0e978be20b2a/ana-cecilia.jpg",
    size: 116370,
    url: "/equipe/ana-cecilia.webp",
    version: 1,
  },
  "Dra. Ivete Gianfaldoni Gattás": {
    asset_id: "6d7a6c87-f614-4ad5-b1c9-7e71f2d65f42",
    content_type: "image/jpeg",
    created_at: "2026-09-23T19:14:46Z",
    original_filename: "ivete-gattas.jpg",
    project_id: "86746dcc-27ab-4b20-b82c-d603ec04c961",
    r2_key: "a/v1/86746dcc-27ab-4b20-b82c-d603ec04c961/6d7a6c87-f614-4ad5-b1c9-7e71f2d65f42/ivete-gattas.jpg",
    size: 189831,
    url: "/equipe/ivete-foto.webp",
    version: 1,
  },
  "Dra. Luciene Stivanin": {
    asset_id: "b63b6714-a20e-49b4-922e-5161da896c67",
    content_type: "image/jpeg",
    created_at: "2026-09-23T19:19:08Z",
    original_filename: "luciene-stivanin.jpg",
    project_id: "86746dcc-27ab-4b20-b82c-d603ec04c961",
    r2_key: "a/v1/86746dcc-27ab-4b20-b82c-d603ec04c961/b63b6714-a20e-49b4-922e-5161da896c67/luciene-stivanin.jpg",
    size: 90387,
    url: "/equipe/luciene-stivanin.webp",
    version: 1,
  },
  "Dra. Priscila Previato": {
    asset_id: "d178cb60-2343-4c3f-b116-b5c2f1d84036",
    content_type: "image/png",
    created_at: "2026-09-23T20:13:03Z",
    original_filename: "priscila-previato.png",
    project_id: "86746dcc-27ab-4b20-b82c-d603ec04c961",
    r2_key: "a/v1/86746dcc-27ab-4b20-b82c-d603ec04c961/d178cb60-2343-4c3f-b116-b5c2f1d84036/priscila-previato.png",
    size: 1191395,
    url: "/equipe/priscila-previato.webp",
    version: 1,
  },
  "Patrícia Azevedo Silva de Paula Salles": {
    asset_id: "681da462-96d8-4243-9219-c6533da21d06",
    content_type: "image/png",
    created_at: "2026-09-23T20:16:35Z",
    original_filename: "patricia-sotimoalles.png",
    project_id: "86746dcc-27ab-4b20-b82c-d603ec04c961",
    r2_key: "a/v1/86746dcc-27ab-4b20-b82c-d603ec04c961/681da462-96d8-4243-9219-c6533da21d06/patricia-sotimoalles.png",
    size: 2373105,
    url: "/equipe/patricia-salles.webp",
    version: 1,
  },
};

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

function buildRawJsonView() {
  const todos = [
    ...equipe.map((m) => ({
      grupo: "Board de especialistas",
      nome: m.n,
      cargo: m.r,
      mini_bio: m.itens,
      lattes: m.lattes,
      foto: m.foto,
      asset_json: ASSET_JSONS[m.n] || null,
    })),
    ...assistentes.map((a) => ({
      grupo: "Pesquisa",
      nome: a.n,
      cargo: "Assistente de pesquisa",
      mini_bio: a.d,
      lattes: a.lattes,
      foto: a.foto,
      asset_json: ASSET_JSONS[a.n] || null,
    })),
    ...tecnologia.map((t) => ({
      grupo: "Tecnologia",
      nome: t.n,
      cargo: t.r,
      mini_bio: t.d,
      lattes: t.lattes,
      foto: t.foto,
      asset_json: ASSET_JSONS[t.n] || null,
    })),
  ];

  return todos
    .map((item) => {
      const jsonStr = esc(JSON.stringify(item, null, 2));
      return `
      <article style="background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:20px;display:grid;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:8px;">
          <div>
            <b style="font-size:0.98rem;color:var(--fg);">${esc(item.nome)}</b>
            <span style="display:block;font-size:0.8rem;color:var(--accent);font-weight:600;">${esc(item.cargo)} · [${esc(item.grupo)}]</span>
          </div>
          <span style="font-size:0.75rem;background:var(--sky);border:1px solid var(--sky-line);color:var(--blue-ink);padding:2px 8px;border-radius:6px;font-family:monospace;">
            .json
          </span>
        </div>
        <pre style="margin:0;font-size:0.8rem;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:var(--bg);color:var(--fg2);padding:14px;border-radius:12px;overflow-x:auto;line-height:1.45;border:1px solid var(--line);"><code>${jsonStr}</code></pre>
      </article>`;
    })
    .join("");
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

  const rawJsonCards = buildRawJsonView();

  return `<section class="team" id="equipe"><div class="wrap">
  <div class="sec-head">
    <span class="eyebrow">Quem está por trás</span>
    <h2>Profissionais que cuidam do método e da plataforma</h2>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:14px;">
      <p class="lead" style="margin:0;">Psiquiatras, neuropsicóloga, fonoaudióloga e psicopedagoga supervisionam o método, discutem os casos mais difíceis e acompanham o piloto.</p>
      <button type="button" id="toggle-pro-raw" class="btn btn-outline" style="min-height:42px;padding:0 18px;font-size:0.88rem;cursor:pointer;">
        <span id="label-raw">⚙️ Ver Dados Brutos (.JSON)</span>
        <span id="label-cards" style="display:none">👁️ Ver Visualização Padrão</span>
      </button>
    </div>
  </div>

  <div id="team-visual-view">
    <h3 class="grp">Board de especialistas</h3><div class="people board">${board}</div>
    <h3 class="grp">Pesquisa</h3><div class="people">${apoio}</div>
    <h3 class="grp">Tecnologia</h3><div class="people">${tec}</div>
  </div>

  <div id="team-raw-view" style="display:none;margin-top:28px;">
    <div style="margin-bottom:18px;padding:12px 18px;border-radius:14px;background:var(--sky);border:1px solid var(--sky-line);font-size:0.88rem;color:var(--blue-ink);">
      📦 <strong>Fonte de Dados Brutos:</strong> Exibindo metadados e mini bios extraídos de <code>docs/periscopio-discover/src/assets</code> e <code>lib/equipe.ts</code>.
    </div>
    <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,500px),1fr));">
      ${rawJsonCards}
    </div>
  </div>

  </div></section>`;
}

export default function Home() {
  return <LandingClient html={LANDING_HTML.replace("__EQUIPE__", equipeHtml())} />;
}
