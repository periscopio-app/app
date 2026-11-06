import { sql } from "drizzle-orm";
import { justificationMetrics, medirJustificativa } from "@periscopio/shared";
import { db } from "../db/client";

/**
 * Volumetria das justificativas para o KPI interno do Administrador Master (migração 0033).
 * Guarda SÓ contagens somadas por dia, formulário e tipo. O texto não entra aqui: quem chama passa o texto
 * apenas para medir, e ele não é gravado, nem logado, nem enviado a nenhum serviço de IA.
 * `tokensEstimados` = ceil(caracteres / 4): estimativa de volume, não o tokenizador de um modelo.
 */
type Executor = Pick<typeof db, "insert">;

export async function registrarJustificativa(
  executor: Executor,
  entrada: { tenantId: string; form: string; kind: string; texto: string; dia?: Date }
): Promise<void> {
  const m = medirJustificativa(entrada.texto);
  const dia = (entrada.dia ?? new Date()).toISOString().slice(0, 10);
  await executor
    .insert(justificationMetrics)
    .values({ tenantId: entrada.tenantId, day: dia, form: entrada.form.slice(0, 40), kind: entrada.kind.slice(0, 40), n: 1, chars: m.caracteres, words: m.palavras, estTokens: m.tokensEstimados })
    .onConflictDoUpdate({
      target: [justificationMetrics.tenantId, justificationMetrics.day, justificationMetrics.form, justificationMetrics.kind],
      set: {
        n: sql`${justificationMetrics.n} + 1`,
        chars: sql`${justificationMetrics.chars} + ${m.caracteres}`,
        words: sql`${justificationMetrics.words} + ${m.palavras}`,
        estTokens: sql`${justificationMetrics.estTokens} + ${m.tokensEstimados}`,
        updatedAt: new Date(),
      },
    });
}
