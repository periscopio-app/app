import crypto from "node:crypto";
import { avatarPublicUrl, putAvatar, removeAvatar, removeObject, uploadObject } from "../storage";

/**
 * Autoteste do armazenamento (Supabase), para o Administrador Master ver, no ambiente publicado,
 * se a foto de perfil sobe, se o link público responde 200 e se o bucket clínico privado funciona.
 * Usa só arquivos sintéticos (1 pixel) e apaga tudo ao final. Nunca devolve chave ou segredo.
 */

// PNG 1x1 transparente.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

export interface StorageStep {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  httpStatus?: number;
  ms: number;
}

export interface StorageCheckResult {
  ok: boolean;
  finishedAt: string;
  avatar: { publicUrl: string | null; httpStatus: number | null };
  steps: StorageStep[];
}

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ status: number; headers: { get(n: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface StorageDeps {
  env: Record<string, string | undefined>;
  fetch: FetchLike;
  putAvatar: typeof putAvatar;
  removeAvatar: typeof removeAvatar;
  avatarPublicUrl: typeof avatarPublicUrl;
  uploadObject: typeof uploadObject;
  removeObject: typeof removeObject;
}

const defaults: StorageDeps = {
  env: process.env,
  fetch: (url, init) => fetch(url, init as RequestInit) as never,
  putAvatar,
  removeAvatar,
  avatarPublicUrl,
  uploadObject,
  removeObject,
};

async function fetchComTimeout(f: FetchLike, url: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    return await f(url, { signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function runStorageCheck(overrides: Partial<StorageDeps> = {}): Promise<StorageCheckResult> {
  const d = { ...defaults, ...overrides };
  const steps: StorageStep[] = [];
  const result: StorageCheckResult = { ok: false, finishedAt: "", avatar: { publicUrl: null, httpStatus: null }, steps };

  async function step(id: string, label: string, fn: () => Promise<{ ok: boolean; detail: string; httpStatus?: number }>) {
    const t0 = Date.now();
    try {
      const r = await fn();
      steps.push({ id, label, ...r, ms: Date.now() - t0 });
      return r.ok;
    } catch (err) {
      steps.push({ id, label, ok: false, detail: err instanceof Error ? err.message : "erro desconhecido", ms: Date.now() - t0 });
      return false;
    }
  }

  const temUrl = Boolean(d.env.SUPABASE_URL?.trim() || d.env.SUPABASE_PROJECT_REF?.trim());
  const temChave = Boolean(d.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const configOk = await step("config", "Variáveis no servidor (Render)", async () => {
    if (!temUrl) return { ok: false, detail: "Falta SUPABASE_URL (ou SUPABASE_PROJECT_REF)." };
    if (!temChave) return { ok: false, detail: "Falta SUPABASE_SERVICE_ROLE_KEY. Sem ela, o servidor não consegue criar bucket nem gravar a foto." };
    return { ok: true, detail: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY presentes." };
  });

  const finalizar = () => {
    result.finishedAt = new Date().toISOString();
    result.ok = steps.every((s) => s.ok);
    return result;
  };
  if (!configOk) return finalizar();

  // ── Bucket de fotos (público) ─────────────────────────────────────────────
  const chave = `diagnostico/${crypto.randomUUID()}.png`;
  const subiu = await step("avatar_upload", "Foto de perfil: enviar imagem de teste ao bucket público", async () => {
    await d.putAvatar(chave, PNG_1X1, "image/png");
    return { ok: true, detail: "Imagem de teste gravada (o bucket foi criado/liberado se ainda não existia)." };
  });

  if (subiu) {
    const url = d.avatarPublicUrl(chave);
    result.avatar.publicUrl = url;
    await step("avatar_link", "Foto de perfil: abrir o link público", async () => {
      const r = await fetchComTimeout(d.fetch, url);
      result.avatar.httpStatus = r.status;
      const tipo = r.headers.get("content-type") ?? "";
      const bytes = Buffer.from(await r.arrayBuffer());
      const igual = bytes.equals(PNG_1X1);
      if (r.status !== 200) return { ok: false, httpStatus: r.status, detail: `O link respondeu ${r.status}, não 200. Bucket de fotos precisa estar público.` };
      if (!igual) return { ok: false, httpStatus: r.status, detail: `Respondeu 200, mas o arquivo veio diferente (${tipo || "tipo desconhecido"}).` };
      return { ok: true, httpStatus: 200, detail: `Respondeu 200 com a imagem enviada (${tipo}).` };
    });

    await step("avatar_cleanup", "Foto de perfil: apagar a imagem de teste", async () => {
      await d.removeAvatar(chave);
      const r = await fetchComTimeout(d.fetch, url);
      if (r.status === 200) return { ok: false, httpStatus: r.status, detail: "A imagem de teste continua acessível depois de apagada." };
      return { ok: true, httpStatus: r.status, detail: `Apagada (o link agora responde ${r.status}).` };
    });
  }

  // ── Bucket clínico (privado) ──────────────────────────────────────────────
  const chaveClinica = `diagnostico/${crypto.randomUUID()}.txt`;
  const conteudo = Buffer.from("teste sintetico do periscopio");
  let assinada: string | null = null;
  const subiuClinico = await step("clinical_upload", "Anexos clínicos: enviar arquivo de teste ao bucket privado", async () => {
    assinada = await d.uploadObject(chaveClinica, conteudo, "text/plain");
    return { ok: true, detail: "Arquivo de teste gravado; link assinado temporário gerado." };
  });
  if (subiuClinico && assinada) {
    const urlAssinada: string = assinada;
    await step("clinical_link", "Anexos clínicos: abrir o link assinado", async () => {
      const r = await fetchComTimeout(d.fetch, urlAssinada);
      const bytes = Buffer.from(await r.arrayBuffer());
      if (r.status !== 200) return { ok: false, httpStatus: r.status, detail: `O link assinado respondeu ${r.status}, não 200.` };
      if (!bytes.equals(conteudo)) return { ok: false, httpStatus: r.status, detail: "Respondeu 200, mas o conteúdo veio diferente." };
      return { ok: true, httpStatus: 200, detail: "Respondeu 200 com o arquivo enviado." };
    });
    await step("clinical_cleanup", "Anexos clínicos: apagar o arquivo de teste", async () => {
      await d.removeObject(chaveClinica);
      return { ok: true, detail: "Apagado." };
    });
  }

  return finalizar();
}
