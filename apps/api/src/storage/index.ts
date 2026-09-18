import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 fala o protocolo S3, então usamos o SDK da AWS apenas como
 * cliente HTTP compatível — nenhum serviço da AWS é usado aqui, tudo aponta
 * para o endpoint do R2.
 */
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET ?? "periscopio-uploads";

export async function uploadObject(key: string, body: Buffer, contentType: string) {
  await r2.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function getObject(key: string) {
  return r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}
