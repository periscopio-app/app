#!/usr/bin/env node
/**
 * Gera `qa/CATALOGO_REGRESSAO.md`: o que o sistema já garante por teste automático, por área, com o arquivo que guarda cada coisa.
 * É gerado a partir dos próprios testes (nunca à mão), então a documentação não envelhece sozinha.
 *
 *   pnpm qa:catalogo          reescreve o arquivo
 *   pnpm qa:catalogo --check  falha (exit 1) se o arquivo estiver desatualizado ou se houver teste que o `pnpm test` não roda
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "qa/CATALOGO_REGRESSAO.md");
const check = process.argv.includes("--check");

function varrer(dir, filtro, out = []) {
  if (!existsSync(dir)) return out;
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next" || nome === "__pycache__" || nome.startsWith(".")) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p, filtro, out);
    else if (filtro(nome)) out.push(p);
  }
  return out;
}

const rel = (p) => relative(RAIZ, p).split(sep).join("/");
const TITULO = /\b(describe|test|it)(?:\.(?:skip|only|todo))?\(\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2/g;

/** Testes TypeScript (node:test): suítes e casos, na ordem do arquivo. */
function lerTs(arquivo) {
  const src = readFileSync(arquivo, "utf8");
  const suites = [];
  const casos = [];
  for (const m of src.matchAll(TITULO)) (m[1] === "describe" ? suites : casos).push(m[3].replace(/\\(["'`])/g, "$1"));
  return { suites, casos };
}

/** Testes Python (pytest): funções `test_*`. */
function lerPy(arquivo) {
  const src = readFileSync(arquivo, "utf8");
  return { suites: [], casos: [...src.matchAll(/^\s*(?:async\s+)?def\s+(test_\w+)/gm)].map((m) => m[1]) };
}

const tsTestes = varrer(join(RAIZ, "apps"), (n) => /\.test\.ts$/.test(n)).concat(varrer(join(RAIZ, "packages"), (n) => /\.test\.ts$/.test(n)));
const pyTestes = varrer(join(RAIZ, "apps/bi-rag"), (n) => /^test_.*\.py$/.test(n));

// Trava: `pnpm --filter @periscopio/api test` usa o glob do shell `src/**/*.test.ts` (um nível de pasta). Fora disso o teste não roda.
const orfaos = tsTestes.map(rel).filter((p) => {
  if (!p.startsWith("apps/api/src/")) return true; // web/shared não têm executor de teste configurado
  return p.split("/").length !== 5; // apps/api/src/<pasta>/<arquivo>
});

const area = (p) => {
  if (p.includes("/e2e/")) return "API — E2E (banco de teste, fluxo pela API real)";
  if (p.includes("/contract/")) return "Contrato tela ↔ API";
  if (p.startsWith("apps/api/")) return "API — unitários";
  if (p.startsWith("apps/bi-rag/")) return "Assistente do BI (Python)";
  return "Outros";
};

const grupos = new Map();
const todos = [...tsTestes.map((f) => [f, lerTs(f)]), ...pyTestes.map((f) => [f, lerPy(f)])].sort((a, b) => rel(a[0]).localeCompare(rel(b[0])));
let total = 0;
const regs = [];
for (const [f, { suites, casos }] of todos) {
  const p = rel(f);
  total += casos.length;
  if (!grupos.has(area(p))) grupos.set(area(p), []);
  grupos.get(area(p)).push({ p, suites, casos });
  for (const c of casos) {
    const id = c.match(/\[(REG-[\w-]+)\]/);
    if (id) regs.push({ id: id[1], titulo: c.replace(/^\[REG-[\w-]+\]\s*/, ""), p });
  }
}

const linhas = [];
linhas.push("# Catálogo de regressão", "");
linhas.push("> Gerado por `pnpm qa:catalogo` a partir dos testes. **Não edite à mão.** A CI confere se está atualizado.", "");
linhas.push(`O que o sistema já garante, sem ninguém precisar repetir à mão: **${total} casos de teste automáticos** em ${todos.length} arquivos. Quem mexe em algo listado aqui e quebra a garantia vê a CI ficar vermelha.`, "");
linhas.push("## Bugs que já aconteceram (testes `[REG-…]`)", "");
if (regs.length === 0) linhas.push("_Nenhum ainda._", "");
else {
  linhas.push("| Código | O que fica garantido | Teste |", "|---|---|---|");
  for (const r of regs.sort((a, b) => a.id.localeCompare(b.id) || a.titulo.localeCompare(b.titulo))) {
    linhas.push(`| ${r.id} | ${r.titulo.replace(/\|/g, "\\|")} | \`${r.p}\` |`);
  }
  linhas.push("");
}
for (const [nome, arquivos] of grupos) {
  const n = arquivos.reduce((s, a) => s + a.casos.length, 0);
  linhas.push(`## ${nome} — ${n}`, "");
  for (const a of arquivos) {
    linhas.push(`<details><summary><code>${a.p}</code> — ${a.casos.length}${a.suites[0] ? ` · ${a.suites[0].replace(/</g, "&lt;")}` : ""}</summary>`, "");
    for (const c of a.casos) linhas.push(`- ${c.replace(/</g, "&lt;")}`);
    linhas.push("", "</details>", "");
  }
}
const conteudo = linhas.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

let ok = true;
if (orfaos.length) {
  ok = false;
  console.error("Estes testes NÃO são executados por `pnpm test` (fora de apps/api/src/<pasta>/): mova-os ou configure o executor:\n" + orfaos.map((o) => "  - " + o).join("\n"));
}
if (check) {
  const atual = existsSync(SAIDA) ? readFileSync(SAIDA, "utf8") : "";
  if (atual !== conteudo) {
    ok = false;
    console.error("qa/CATALOGO_REGRESSAO.md está desatualizado. Rode `pnpm qa:catalogo` e inclua o arquivo no commit.");
  }
  process.exit(ok ? 0 : 1);
}
writeFileSync(SAIDA, conteudo);
console.log(`Catálogo atualizado: ${total} verificações em ${todos.length} arquivos.`);
process.exit(ok ? 0 : 1);
