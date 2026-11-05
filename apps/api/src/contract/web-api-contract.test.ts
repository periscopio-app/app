/**
 * Contrato tela ↔ API (sem banco, sem rede).
 *
 * Regressão que motivou este teste (05/nov/2026): a API passou a exigir os 15 comportamentos do FOGAP para enviar ao
 * médico, mas nenhuma tela chamava uma rota que gravasse esses dados. O RE preenchia tudo, clicava em enviar e levava
 * 422 para sempre. Os E2E não pegaram porque gravam pelo caminho genérico da API, não pelo que a tela usa.
 *
 * Este teste lê o código do front (`apps/web`), extrai cada chamada `api.get/post/put/patch/delete(...)` e confirma que
 * existe uma rota na API com o mesmo método e formato de caminho. Se um PR renomear, remover ou esquecer uma rota que a
 * tela usa, a CI fica vermelha com a lista exata.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../../../", import.meta.url)); // raiz do monorepo
const WEB = join(RAIZ, "apps/web");
const METODOS = ["get", "post", "put", "patch", "delete"] as const;
type Metodo = (typeof METODOS)[number];

interface Chamada {
  metodo: Metodo;
  caminho: string;
  arquivo: string;
}

function arquivosDoFront(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next" || nome.startsWith(".")) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivosDoFront(p, out);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\./.test(nome)) out.push(p);
  }
  return out;
}

/** Pula o `<Tipo>` opcional logo depois de `api.get`, sem se confundir com `=>` dentro do tipo. */
function pularGenerico(src: string, i: number): number {
  if (src[i] !== "<") return i;
  let nivel = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === "<") nivel++;
    else if (c === ">" && src[k - 1] !== "=") {
      nivel--;
      if (nivel === 0) return k + 1;
    }
  }
  return i;
}

function extrairChamadas(arquivo: string): { chamadas: Chamada[]; naoResolvidas: string[] } {
  const src = readFileSync(arquivo, "utf8");
  const rel = relative(RAIZ, arquivo);
  // `const base = `/api/cases/${caseId}`` → permite resolver `${base}/re-journey/...`.
  const bases = new Map<string, string>();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*`([^`]*)`/g)) if (m[2].startsWith("/api/")) bases.set(m[1], m[2]);

  const chamadas: Chamada[] = [];
  const naoResolvidas: string[] = [];
  const re = /\bapi\.(get|post|put|patch|delete|upload)\b/g;
  for (const m of src.matchAll(re)) {
    let i = (m.index ?? 0) + m[0].length;
    i = pularGenerico(src, i);
    if (src[i] !== "(") continue;
    i++;
    while (/\s/.test(src[i] ?? "")) i++;
    const aspas = src[i];
    if (aspas !== "`" && aspas !== '"' && aspas !== "'") {
      naoResolvidas.push(`${rel}: ${m[0]}(<expressão>)`);
      continue;
    }
    let fim = i + 1;
    while (fim < src.length && src[fim] !== aspas) fim += src[fim] === "\\" ? 2 : 1;
    let caminho = src.slice(i + 1, fim);
    const inicio = caminho.match(/^\$\{(\w+)\}/);
    if (inicio) {
      const base = bases.get(inicio[1]);
      if (!base) {
        naoResolvidas.push(`${rel}: ${m[0]}(${caminho})`);
        continue;
      }
      caminho = base + caminho.slice(inicio[0].length);
    }
    if (!caminho.startsWith("/api/")) {
      naoResolvidas.push(`${rel}: ${m[0]}(${caminho})`);
      continue;
    }
    chamadas.push({ metodo: (m[1] === "upload" ? "post" : m[1]) as Metodo, caminho, arquivo: rel }); // api.upload = POST binário
  }
  return { chamadas, naoResolvidas };
}

/** `/api/cases/${id}/x?y=1` → ["api","cases",":","x"] (`:` = qualquer valor). */
function segmentos(caminho: string): string[] {
  return caminho
    .split("?")[0]
    .replace(/\$\{[^}]*\}/g, ":")
    .split("/")
    .filter(Boolean)
    .map((s) => (s.startsWith(":") || s.includes(":") ? ":" : s));
}

function casa(rota: string[], cliente: string[]): boolean {
  // `${passo}` no fim do caminho pode ser "g/skip" (dois segmentos): aceita rota mais longa com o mesmo começo.
  if (cliente[cliente.length - 1] === ":" && rota.length > cliente.length) return casa(rota.slice(0, cliente.length), cliente);
  if (rota.length !== cliente.length) return false;
  return rota.every((s, i) => s === ":" || cliente[i] === ":" || s === cliente[i]);
}

/**
 * `printRoutes` devolve uma árvore (prefixos compartilhados viram nós pais, 4 caracteres de recuo por nível).
 * Reconstrói o caminho completo de cada rota que tem método, juntando os rótulos do pai até a folha.
 */
function rotasDaArvore(arvore: string): string[][] {
  const pilha: string[] = [];
  const rotas: string[][] = [];
  for (const linha of arvore.split("\n")) {
    const m = linha.match(/^((?:│   |    )*)[├└]── (.*)$/);
    if (!m) continue;
    const nivel = m[1].length / 4;
    const comMetodo = m[2].match(/^(.*?) \(([A-Z, ]+)\)$/);
    pilha[nivel] = comMetodo ? comMetodo[1] : m[2];
    pilha.length = nivel + 1;
    if (comMetodo) rotas.push(segmentos(pilha.join("")));
  }
  return rotas;
}

/**
 * Chamadas conhecidas sem rota hoje. Cada linha é uma dívida: precisa de motivo e de dono. A lista só pode diminuir;
 * o teste falha se uma entrada deixar de ser necessária (para ninguém esquecer de limpar) ou se surgir uma nova.
 */
const DIVIDAS_CONHECIDAS = new Set<string>([
  // (vazia de propósito — preencher só com justificativa)
]);

describe("contrato tela ↔ API", () => {
  test("toda chamada api.* do front tem rota na API (mesmo método e caminho)", async () => {
    process.env.DATABASE_URL ??= "postgres://postgres@localhost:5432/periscopio_test"; // não conecta: só registra rotas
    process.env.NODE_ENV = "test";
    process.env.BETTER_AUTH_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres!!";
    process.env.BETTER_AUTH_URL ??= "http://localhost:3001";

    const { buildApp } = await import("../app");
    const app = await buildApp({ logger: false });
    await app.ready();

    const registradas: Record<string, string[][]> = {};
    for (const metodo of METODOS) registradas[metodo] = rotasDaArvore(app.printRoutes({ method: metodo.toUpperCase(), commonPrefix: false }));
    await app.close();
    const totalRotas = METODOS.reduce((n, m) => n + registradas[m].length, 0);
    assert.ok(totalRotas > 100, `leitura das rotas da API falhou (só ${totalRotas} encontradas)`);

    const chamadas: Chamada[] = [];
    for (const arq of arquivosDoFront(WEB)) chamadas.push(...extrairChamadas(arq).chamadas);
    assert.ok(chamadas.length > 80, `leitura das chamadas do front falhou (só ${chamadas.length} encontradas)`);

    const semRota = new Set<string>();
    for (const c of chamadas) {
      const seg = segmentos(c.caminho);
      if (!registradas[c.metodo].some((r) => casa(r, seg))) semRota.add(`${c.metodo.toUpperCase()} ${c.caminho.split("?")[0]}  (${c.arquivo})`);
    }

    const novas = [...semRota].filter((x) => !DIVIDAS_CONHECIDAS.has(x));
    assert.deepEqual(novas, [], `O front chama rotas que a API não tem:\n${novas.join("\n")}`);
    const obsoletas = [...DIVIDAS_CONHECIDAS].filter((x) => !semRota.has(x));
    assert.deepEqual(obsoletas, [], `Dívidas já resolvidas: remova da lista:\n${obsoletas.join("\n")}`);
  });
});
