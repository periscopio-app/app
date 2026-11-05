#!/usr/bin/env node
/**
 * Trava de PR: mudança de código de produto precisa vir com teste (ou com o rótulo `sem-teste` e um motivo no PR).
 *
 *   node qa/exigir-teste.mjs <ref-da-base>      ex.: origin/main
 *
 * Código de produto = apps/api/src, apps/web, packages/shared/src, apps/bi-rag/bi_rag (menos testes, estilos e textos).
 * Teste = *.test.ts, test_*.py ou qualquer arquivo em qa/.
 * Rótulos do PR vêm em PR_LABELS (texto separado por vírgula), preenchido pela CI.
 */
import { execFileSync } from "node:child_process";

const base = process.argv[2] ?? "origin/main";
const rotulos = (process.env.PR_LABELS ?? "").split(",").map((s) => s.trim().toLowerCase());
if (rotulos.includes("sem-teste")) {
  console.log("Rótulo `sem-teste` presente: trava dispensada (o motivo precisa estar na descrição do PR).");
  process.exit(0);
}

const arquivos = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" }).split("\n").filter(Boolean);
const ehTeste = (f) => /\.test\.tsx?$/.test(f) || /(^|\/)test_[^/]*\.py$/.test(f) || f.startsWith("qa/");
const ehProduto = (f) =>
  /^(apps\/api\/src|apps\/web|packages\/shared\/src|apps\/bi-rag\/bi_rag)\//.test(f) &&
  !ehTeste(f) &&
  !/\.(css|md|svg|png|jpe?g|ico|json)$/.test(f) &&
  !/^apps\/web\/public\//.test(f);

const produto = arquivos.filter(ehProduto);
const testes = arquivos.filter(ehTeste);
if (produto.length === 0) {
  console.log("Nenhuma mudança de código de produto: nada a exigir.");
  process.exit(0);
}
if (testes.length > 0) {
  console.log(`OK: ${produto.length} arquivo(s) de produto e ${testes.length} de teste/QA alterados.`);
  process.exit(0);
}
console.error(
  [
    "Este PR muda código de produto e não traz nenhum teste.",
    "Adicione um teste que falhe sem a mudança (veja qa/README.md) ou, se realmente não cabe teste, ponha o rótulo `sem-teste` e explique o motivo no PR.",
    "",
    "Arquivos de produto alterados:",
    ...produto.slice(0, 15).map((f) => "  - " + f),
    produto.length > 15 ? `  … e mais ${produto.length - 15}` : "",
  ].join("\n"),
);
process.exit(1);
