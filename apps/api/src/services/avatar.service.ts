import crypto from "node:crypto";

/**
 * Foto de perfil do profissional (nunca do aluno).
 *
 * Regras:
 *  - o formato é detectado pelos primeiros bytes do arquivo (o tipo informado pelo navegador é ignorado);
 *  - só JPEG, PNG e WEBP, até 2 MB;
 *  - metadados que podem revelar onde a foto foi tirada (EXIF/GPS, XMP, IPTC, comentários) são removidos
 *    de JPEG e PNG; um WEBP que traga esses metadados é recusado (o navegador já reenvia a imagem limpa);
 *  - a chave do objeto é opaca (tenant/usuário/uuid): sem nome, e-mail ou documento no endereço da foto.
 */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export type AvatarExt = "jpg" | "png" | "webp";
export interface AvatarFormat {
  ext: AvatarExt;
  contentType: (typeof AVATAR_ALLOWED_MIME)[number];
}

export type FotoValidada =
  | { ok: true; bytes: Buffer; format: AvatarFormat }
  | { ok: false; status: 400 | 413 | 422; error: string };

const FORMATS: Record<AvatarExt, AvatarFormat> = {
  jpg: { ext: "jpg", contentType: "image/jpeg" },
  png: { ext: "png", contentType: "image/png" },
  webp: { ext: "webp", contentType: "image/webp" },
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Detecta o formato pelos bytes iniciais. Retorna null se não for JPEG, PNG ou WEBP. */
export function detectarFormato(b: Uint8Array): AvatarFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return FORMATS.jpg;
  if (b.length >= 8 && PNG_SIGNATURE.equals(Buffer.from(b.subarray(0, 8)))) return FORMATS.png;
  if (
    b.length >= 12 &&
    Buffer.from(b.subarray(0, 4)).toString("latin1") === "RIFF" &&
    Buffer.from(b.subarray(8, 12)).toString("latin1") === "WEBP"
  ) {
    return FORMATS.webp;
  }
  return null;
}

const INVALIDA = "Não foi possível ler a imagem. Envie um arquivo JPG, PNG ou WEBP.";

/** Remove APP1 (EXIF/XMP), APP13 (IPTC) e comentários de um JPEG. Devolve null se o arquivo estiver corrompido. */
export function limparJpeg(src: Buffer): Buffer | null {
  const out: Buffer[] = [src.subarray(0, 2)];
  let i = 2;
  while (i < src.length) {
    if (src[i] !== 0xff) return null;
    // bytes de preenchimento 0xFF repetidos
    while (i < src.length && src[i] === 0xff) i++;
    const marker = src[i];
    i++;
    if (marker === 0xd9) {
      out.push(Buffer.from([0xff, 0xd9]));
      return Buffer.concat(out);
    }
    if (marker === 0xda) {
      // início dos dados da imagem: copia o restante sem alterar
      out.push(Buffer.from([0xff, 0xda]), src.subarray(i));
      return Buffer.concat(out);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (i + 2 > src.length) return null;
    const len = src.readUInt16BE(i);
    if (len < 2 || i + len > src.length) return null;
    const dropar = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!dropar) out.push(Buffer.from([0xff, marker]), src.subarray(i, i + len));
    i += len;
  }
  return null;
}

const PNG_CHUNKS_REMOVIDOS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

/** Remove blocos de texto/EXIF/data de um PNG. Devolve null se o arquivo estiver corrompido. */
export function limparPng(src: Buffer): Buffer | null {
  const out: Buffer[] = [src.subarray(0, 8)];
  let i = 8;
  let viuIend = false;
  while (i + 12 <= src.length) {
    const len = src.readUInt32BE(i);
    const tipo = src.subarray(i + 4, i + 8).toString("latin1");
    const fim = i + 12 + len;
    if (fim > src.length) return null;
    if (!PNG_CHUNKS_REMOVIDOS.has(tipo)) out.push(src.subarray(i, fim));
    i = fim;
    if (tipo === "IEND") {
      viuIend = true;
      break;
    }
  }
  return viuIend ? Buffer.concat(out) : null;
}

/** true se o WEBP traz EXIF ou XMP. Devolve null se o contêiner estiver corrompido. */
export function webpTemMetadados(src: Buffer): boolean | null {
  let i = 12;
  let achou = false;
  while (i + 8 <= src.length) {
    const tipo = src.subarray(i, i + 4).toString("latin1");
    const len = src.readUInt32LE(i + 4);
    const fim = i + 8 + len + (len % 2);
    if (i + 8 + len > src.length) return null;
    if (tipo === "EXIF" || tipo === "XMP ") achou = true;
    i = fim;
  }
  return achou;
}

/**
 * Valida a foto recebida em base64 (com ou sem o prefixo "data:image/...;base64,").
 * Devolve os bytes já limpos de metadados, prontos para enviar ao armazenamento.
 */
export function validarFoto(dataBase64: unknown): FotoValidada {
  if (typeof dataBase64 !== "string" || dataBase64.length === 0) {
    return { ok: false, status: 400, error: "Envie a imagem no campo dataBase64." };
  }
  const limpo = dataBase64.replace(/^data:[^;,]+;base64,/i, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpo)) return { ok: false, status: 422, error: INVALIDA };
  // tamanho estimado antes de decodificar, para não alocar um arquivo enorme à toa
  if ((limpo.length * 3) / 4 > AVATAR_MAX_BYTES + 3) {
    return { ok: false, status: 413, error: "A foto passa de 2 MB. Escolha uma imagem menor." };
  }
  const bruto = Buffer.from(limpo, "base64");
  if (bruto.length === 0) return { ok: false, status: 422, error: INVALIDA };
  if (bruto.length > AVATAR_MAX_BYTES) {
    return { ok: false, status: 413, error: "A foto passa de 2 MB. Escolha uma imagem menor." };
  }

  const format = detectarFormato(bruto);
  if (!format) return { ok: false, status: 422, error: INVALIDA };

  if (format.ext === "jpg") {
    const limpa = limparJpeg(bruto);
    if (!limpa) return { ok: false, status: 422, error: INVALIDA };
    return { ok: true, bytes: limpa, format };
  }
  if (format.ext === "png") {
    const limpa = limparPng(bruto);
    if (!limpa) return { ok: false, status: 422, error: INVALIDA };
    return { ok: true, bytes: limpa, format };
  }
  const meta = webpTemMetadados(bruto);
  if (meta === null) return { ok: false, status: 422, error: INVALIDA };
  if (meta) {
    return {
      ok: false,
      status: 422,
      error: "A imagem traz informações ocultas (como local da foto). Salve uma cópia sem metadados e envie de novo.",
    };
  }
  return { ok: true, bytes: bruto, format };
}

/** Chave opaca do objeto: nenhum dado pessoal no caminho. */
export function chaveDoAvatar(tenantId: string, userId: string, ext: AvatarExt): string {
  return `avatars/${tenantId}/${userId}/${crypto.randomUUID()}.${ext}`;
}

/** A chave guardada no banco precisa pertencer ao próprio usuário antes de qualquer remoção. */
export function chavePertenceAoUsuario(key: string | null | undefined, tenantId: string, userId: string): boolean {
  return !!key && key.startsWith(`avatars/${tenantId}/${userId}/`);
}

/** Armazenamento da foto. O padrão usa o Supabase do projeto; os testes trocam por uma versão em memória. */
export interface AvatarStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}

let override: AvatarStorage | null = null;

export function setAvatarStorage(storage: AvatarStorage | null) {
  override = storage;
}

export async function getAvatarStorage(): Promise<AvatarStorage> {
  if (override) return override;
  const store = await import("../storage");
  return {
    put: (key, body, contentType) => store.putAvatar(key, body, contentType),
    remove: (key) => store.removeAvatar(key),
    publicUrl: (key) => store.avatarPublicUrl(key),
  };
}

/** URL pública da foto (ou null quando o usuário não tem foto ou o armazenamento não está configurado). */
export async function urlDoAvatar(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  try {
    return (await getAvatarStorage()).publicUrl(key);
  } catch {
    return null;
  }
}
