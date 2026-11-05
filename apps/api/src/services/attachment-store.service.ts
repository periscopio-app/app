import { db } from "../db/client";

/**
 * Grava o laudo (com o arquivo) em clinical_attachments.
 *
 * POR QUE NÃO USA O DRIZZLE AQUI: quando uma consulta falha, o Drizzle monta a mensagem de erro com TODOS os parâmetros
 * ("Failed query: ... params: <valores>"). Com um arquivo de até 10 MB como parâmetro, isso vira dezenas de MB de texto
 * copiados várias vezes pelo log, e o servidor (512 MB, ~290 MB em repouso) é morto por falta de memória
 * (Render: oomKilled, 05/nov/2026). Erros do driver `pg` não carregam os valores. Aqui o erro sai curto e sem conteúdo.
 */
export interface LaudoParaGravar {
  tenantId: string;
  caseId: string;
  studentId: string | null;
  uploaderId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256: string;
  category: string;
  content: Buffer;
}

export interface LaudoGravado {
  id: string;
  originalName: string;
  category: string;
  fileSizeBytes: number;
  mimeType: string;
  description: string | null;
  sha256: string;
  createdAt: Date;
}

export class LaudoNaoGravadoError extends Error {
  constructor(public readonly codigo: string) {
    super(`Não foi possível gravar o laudo no banco (${codigo}).`);
    this.name = "LaudoNaoGravadoError";
  }
}

const SQL = `INSERT INTO clinical_attachments
  (tenant_id, case_id, student_id, uploader_id, storage_key, original_name, mime_type, file_size_bytes, sha256, category, content)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  RETURNING id, original_name AS "originalName", category, file_size_bytes AS "fileSizeBytes", mime_type AS "mimeType",
            description, sha256, created_at AS "createdAt"`;

export async function gravarLaudoNoBanco(l: LaudoParaGravar): Promise<LaudoGravado> {
  try {
    const r = await db.$client.query(SQL, [
      l.tenantId,
      l.caseId,
      l.studentId,
      l.uploaderId,
      l.storageKey,
      l.originalName,
      l.mimeType,
      l.fileSizeBytes,
      l.sha256,
      l.category,
      l.content,
    ]);
    return r.rows[0] as LaudoGravado;
  } catch (err) {
    // Só o código do erro do Postgres (ex.: 42703 coluna ausente); nunca a mensagem completa nem os valores.
    throw new LaudoNaoGravadoError(String((err as { code?: unknown })?.code ?? "erro"));
  }
}
