"use client";

import { useMemo } from "react";
import { renderGenogram } from "@famtree/renderer";
import { genogramaParaDocumento, resumoDoGenograma, type Genograma } from "@periscopio/shared";

/** Ajusta o SVG da biblioteca para encolher em telas estreitas (mantém a proporção pelo viewBox). */
function tornarResponsivo(svg: string): string {
  return svg.replace(/<svg([^>]*?)\swidth="(\d+)"\s+height="\d+"/, (_m, resto: string, w: string) => `<svg${resto} width="100%" style="max-width:${w}px;height:auto"`);
}

/**
 * Desenho do genograma (somente leitura), feito pela biblioteca pública @famtree (MIT) a partir do modelo por parentesco.
 * O texto dentro do SVG vem só da lista fixa de parentescos; a biblioteca escapa o texto antes de gerar o SVG.
 */
export function GenogramaDesenho({ genograma }: { genograma: Genograma }) {
  const svg = useMemo(() => {
    try {
      return tornarResponsivo(renderGenogram(genogramaParaDocumento(genograma) as never).svg);
    } catch {
      return null;
    }
  }, [genograma]);

  if (!svg) {
    return <p role="alert" className="text-xs text-erro">Não foi possível desenhar o genograma. Os dados continuam guardados.</p>;
  }
  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={`Genograma: ${resumoDoGenograma(genograma) || "sem figuras"}`}
        data-testid="genograma-desenho"
        className="overflow-x-auto rounded-xl border border-linha bg-white p-2"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="mt-1 text-[11px] text-neutral-700">
        Figura do aluno com seta. Quadrado = masculino, círculo = feminino, X = falecido(a), figura amarela = com anotação.
      </figcaption>
    </figure>
  );
}
