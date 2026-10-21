import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase configurado para gerenciamento de arquivos e buckets.
 * Utiliza a URL do projeto Supabase e a Service Role Key (ou Anon Key) no backend.
 */
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (_client) return _client;

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    (process.env.SUPABASE_PROJECT_REF
      ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`
      : undefined);

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL ou SUPABASE_PROJECT_REF não configurada para armazenamento.");
  }

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    "";

  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (_, prop: string | symbol) => (getSupabase() as any)[prop],
});

const BUCKET = process.env.SUPABASE_BUCKET ?? "periscopio-uploads";

const SIGNED_URL_EXPIRY = 600; // segundos

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
) {
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(key, body, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Falha no upload para o Supabase Storage: ${uploadError.message}`);
  }

  return createSignedUrl(key, SIGNED_URL_EXPIRY);
}

export async function removeObject(key: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([key]);
  if (error) throw new Error(`Falha ao remover arquivo do Supabase Storage: ${error.message}`);
}

export async function getObject(key: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error) {
    throw new Error(`Falha ao obter arquivo do Supabase Storage: ${error.message}`);
  }
  return data;
}

export async function createSignedUrl(key: string, expiresIn: number = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, expiresIn);

  if (error) {
    throw new Error(`Falha ao gerar URL assinada: ${error.message}`);
  }

  return data.signedUrl;
}


// ─── Fotos de perfil dos profissionais ───────────────────────────────────────
// Bucket PÚBLICO e separado do bucket clínico: guarda apenas a foto que a própria pessoa escolheu enviar.
// Nunca recebe anexo de aluno nem de prontuário. As chaves são opacas (avatars/<tenant>/<usuário>/<uuid>.<ext>).

const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET ?? "periscopio-avatars";
const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_LIMIT_BYTES = 2 * 1024 * 1024;

let avatarBucketReady: Promise<void> | null = null;

/** Cria o bucket de avatares na primeira foto (ou o torna público, se existir privado). Exige a Service Role Key. */
export function ensureAvatarBucket(): Promise<void> {
  if (!avatarBucketReady) {
    avatarBucketReady = (async () => {
      const { data: existente } = await supabase.storage.getBucket(AVATAR_BUCKET);
      if (existente) {
        if (!existente.public) {
          const { error } = await supabase.storage.updateBucket(AVATAR_BUCKET, {
            public: true,
            fileSizeLimit: AVATAR_LIMIT_BYTES,
            allowedMimeTypes: AVATAR_MIME,
          });
          if (error) throw new Error(`Falha ao liberar o bucket de avatares: ${error.message}`);
        }
        return;
      }
      const { error } = await supabase.storage.createBucket(AVATAR_BUCKET, {
        public: true,
        fileSizeLimit: AVATAR_LIMIT_BYTES,
        allowedMimeTypes: AVATAR_MIME,
      });
      if (error && !/already exists|duplicate/i.test(error.message)) {
        throw new Error(`Falha ao criar o bucket de avatares: ${error.message}`);
      }
    })().catch((err) => {
      avatarBucketReady = null; // tenta de novo na próxima foto
      throw err;
    });
  }
  return avatarBucketReady;
}

export async function putAvatar(key: string, body: Buffer | Uint8Array, contentType: string) {
  await ensureAvatarBucket();
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(key, body, {
    contentType,
    upsert: false,
    cacheControl: "31536000", // a chave muda a cada foto nova, então o cache longo é seguro
  });
  if (error) throw new Error(`Falha no upload da foto: ${error.message}`);
}

export async function removeAvatar(key: string) {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([key]);
  if (error) throw new Error(`Falha ao remover a foto: ${error.message}`);
}

export function avatarPublicUrl(key: string): string {
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(key).data.publicUrl;
}
