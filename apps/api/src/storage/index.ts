import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase configurado para gerenciamento de arquivos e buckets.
 * Utiliza a URL do projeto Supabase e a Service Role Key (ou Anon Key) no backend.
 */
const supabaseUrl =
  process.env.SUPABASE_URL ||
  (process.env.SUPABASE_PROJECT_REF
    ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`
    : "https://rnaivkktezcjttjmtznn.supabase.co");

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  "";

export const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = process.env.SUPABASE_BUCKET ?? "periscopio-uploads";

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(key, body, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Falha no upload para o Supabase Storage: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(key);

  return publicUrlData.publicUrl;
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

