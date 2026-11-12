/**
 * Contrato da tela do RE (FOGAP), sem banco e sem rede.
 *
 * Não há ferramenta de teste de componente no front, então este teste lê o código de `apps/web` e trava as decisões de
 * uso combinadas em 12/nov/2026 (RE usa em telas e idades variadas, muita gente com baixa visão):
 *   - o FOGAP (formulário A a I) fica no topo da tela, antes de consentimento/cofre/laudos;
 *   - todo bloco A a I é retrátil, sem perder o que foi digitado, e os atalhos abrem o bloco antes de rolar;
 *   - o comentário por pergunta grava no mesmo campo `<campo>__obs` que a API lê;
 *   - o professor entrevistado, para o RE, é texto com o nome dele (não um select);
 *   - nenhum rótulo, placeholder ou selo escreve "opcional".
 * Se um PR desfizer qualquer um desses pontos sem querer, a CI fica vermelha dizendo qual.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../../../", import.meta.url));
const WEB = join(RAIZ, "apps/web");
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

function arquivosTsx(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next" || nome.startsWith(".")) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivosTsx(p, out);
    else if (/\.tsx$/.test(nome) && !/\.test\./.test(nome)) out.push(p);
  }
  return out;
}

/** Tira comentários de código: eles podem citar "opcional" como explicação sem aparecer para ninguém. */
const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("Tela do RE (FOGAP): estrutura e acessibilidade", () => {
  test("o FOGAP vem antes do consentimento, do cofre e dos laudos na tela do RE", () => {
    const pagina = ler("apps/web/app/[slug]/dashboard/re/page.tsx");
    const fogap = pagina.indexOf("<ReJourneyPanel");
    assert.ok(fogap > 0, "a tela do RE precisa renderizar o ReJourneyPanel (FOGAP)");
    for (const apoio of ["<ConsentCard", "<StudentIdentityVaultCard", "<CaseAttachmentsCard"]) {
      const pos = pagina.indexOf(apoio);
      assert.ok(pos > fogap, `${apoio} precisa vir DEPOIS do FOGAP (o FOGAP fica no topo)`);
    }
  });

  test("os blocos A a I do FOGAP são retráteis e os atalhos abrem o bloco antes de rolar", () => {
    const painel = ler("apps/web/components/re/ReJourneyPanel.tsx");
    assert.match(painel, /<Recolhivel[\s\S]*?id=\{`passo-\$\{passo\.id\}`\}/, "cada passo (A a I) precisa ser um <Recolhivel> com id passo-<letra>");
    assert.match(painel, /Abrir tudo/, "falta o botão Abrir tudo");
    assert.match(painel, /Recolher tudo/, "falta o botão Recolher tudo");
    assert.match(painel, /function irParaLacuna\([^)]*abrir/, "irParaLacuna precisa abrir o bloco antes de rolar até o campo em branco");
    assert.match(painel, /abrirPasso\(p\.id\)/, "o atalho da barra de progresso precisa abrir o bloco antes de rolar");
  });

  test("recolher um bloco só esconde: o conteúdo continua montado e nada digitado se perde", () => {
    const src = ler("apps/web/components/ui/Recolhivel.tsx");
    assert.match(src, /hidden=\{!aberto\}/, "o corpo precisa ser ocultado com `hidden`, não desmontado");
    assert.doesNotMatch(src, /\{aberto && /, "não desmonte o conteúdo quando recolhido");
    assert.match(src, /aria-expanded=\{aberto\}/, "o botão precisa informar o estado ao leitor de tela");
    assert.match(src, /min-h-\[52px\]/, "o cabeçalho precisa ter alvo de toque grande");
  });

  test("o comentário por pergunta grava no mesmo campo __obs que a API lê", () => {
    const renderer = ler("apps/web/components/re/ReFormRenderer.tsx");
    const api = ler("apps/api/src/services/re-observacoes.service.ts");
    assert.match(renderer, /<ComentarioPopup/, "o formulário precisa usar o comentário em popup");
    assert.match(renderer, /`\$\{campo\.key\}__obs`/, "o comentário da pergunta precisa gravar em <campo>__obs");
    assert.match(renderer, /obs: v/, "o comentário de cada linha de matriz precisa gravar em `obs` da linha");
    assert.match(api, /`\$\{campo\.key\}__obs`/, "a API lê <campo>__obs; se mudar aqui, mude lá junto");
    assert.doesNotMatch(renderer, /Observação \(opcional\)/, "a caixa antiga de observação saiu: o comentário substitui");
  });

  test("o professor entrevistado, para o RE, é campo de texto com o nome dele (sem select)", () => {
    const painel = ler("apps/web/components/re/ReJourneyPanel.tsx");
    const renderer = ler("apps/web/components/re/ReFormRenderer.tsx");
    assert.match(painel, /nomeResponsavel:\s*professionalName/, "o painel precisa passar o nome de quem preenche para o formulário");
    assert.match(renderer, /ctx\.nomeResponsavel/, "o campo do professor precisa ler o nome de quem preenche");
    assert.match(renderer, /if \(nomeRe \|\| lista\.length === 0\)/, "com o nome do RE no contexto, o campo precisa ser texto (a lista só vale sem ele)");
  });

  test("nenhum rótulo, placeholder ou selo da tela escreve 'opcional'", () => {
    // /admin/saude mostra o ESTADO de configuração de integrações ("não configurado (opcional)"), que não é campo de formulário.
    const permitidos = new Set(["app/admin/saude/page.tsx"]);
    const achados: string[] = [];
    for (const arq of arquivosTsx(WEB)) {
      const rel = relative(WEB, arq).replaceAll("\\", "/");
      if (permitidos.has(rel)) continue;
      const src = semComentarios(readFileSync(arq, "utf8"));
      src.split("\n").forEach((linha, i) => {
        if (/\(opcional\b|\(opcional,|placeholder="Opcional|>\s*Opcional\s*<|"Opcional"/i.test(linha) && !/usoOpcional/.test(linha)) {
          achados.push(`${rel}:${i + 1}  ${linha.trim().slice(0, 110)}`);
        }
      });
    }
    assert.deepEqual(achados, [], `Rótulo/placeholder/selo com "opcional":\n${achados.join("\n")}`);
  });
});
