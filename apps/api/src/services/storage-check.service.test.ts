import { test } from "node:test";
import assert from "node:assert/strict";
import { runStorageCheck } from "./storage-check.service";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const resp = (status: number, body: Buffer, type = "image/png") => ({
  status,
  headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? type : null) },
  arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
});

test("sem as variáveis do Supabase o teste para na configuração e diz o que falta", async () => {
  const r = await runStorageCheck({ env: {} });
  assert.equal(r.ok, false);
  assert.equal(r.steps.length, 1);
  assert.match(r.steps[0].detail, /SUPABASE_URL/);
});

test("sem a chave de serviço o teste acusa a chave", async () => {
  const r = await runStorageCheck({ env: { SUPABASE_URL: "https://x.supabase.co" } });
  assert.equal(r.ok, false);
  assert.match(r.steps[0].detail, /SERVICE_ROLE_KEY/);
});

test("tudo certo: link público responde 200 com a mesma imagem e depois some", async () => {
  let removido = false;
  const r = await runStorageCheck({
    env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
    putAvatar: async () => {},
    removeAvatar: async () => { removido = true; },
    avatarPublicUrl: () => "https://x.supabase.co/storage/v1/object/public/periscopio-avatars/diagnostico/a.png",
    uploadObject: async () => "https://x.supabase.co/signed",
    removeObject: async () => {},
    fetch: async (url) => {
      if (url.includes("/public/")) return removido ? resp(404, Buffer.from("{}"), "application/json") : resp(200, PNG);
      return resp(200, Buffer.from("teste sintetico do periscopio"), "text/plain");
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r.steps));
  assert.equal(r.avatar.httpStatus, 200);
  assert.ok(r.avatar.publicUrl?.includes("periscopio-avatars"));
  assert.ok(!JSON.stringify(r).includes('"k"'), "nenhuma chave no resultado");
});

test("CDN ainda serve o link antigo depois de apagar: o teste confere a origem e passa", async () => {
  let removido = false;
  const r = await runStorageCheck({
    env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
    putAvatar: async () => {},
    removeAvatar: async () => { removido = true; },
    avatarPublicUrl: () => "https://x.supabase.co/storage/v1/object/public/periscopio-avatars/diagnostico/a.png",
    uploadObject: async () => "https://x.supabase.co/signed",
    removeObject: async () => {},
    fetch: async (url) => {
      if (url.includes("/public/")) {
        // sem parâmetro novo, a CDN devolve o arquivo em cache; com parâmetro novo, vai à origem
        if (!url.includes("?")) return resp(200, PNG);
        return removido ? resp(404, Buffer.from("{}"), "application/json") : resp(200, PNG);
      }
      return resp(200, Buffer.from("teste sintetico do periscopio"), "text/plain");
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r.steps));
  assert.equal(r.steps.find((s) => s.id === "avatar_cleanup")!.httpStatus, 404);
});

test("imagem apagada que ainda responde 200 na origem continua sendo acusada", async () => {
  const r = await runStorageCheck({
    env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
    putAvatar: async () => {},
    removeAvatar: async () => {},
    avatarPublicUrl: () => "https://x.supabase.co/storage/v1/object/public/periscopio-avatars/diagnostico/a.png",
    uploadObject: async () => "https://x.supabase.co/signed",
    removeObject: async () => {},
    fetch: async (url) => (url.includes("/public/") ? resp(200, PNG) : resp(200, Buffer.from("teste sintetico do periscopio"), "text/plain")),
  });
  assert.equal(r.ok, false);
  assert.match(r.steps.find((s) => s.id === "avatar_cleanup")!.detail, /continua acessível/);
});

test("bucket de fotos privado: o link responde 400/404 e o teste acusa", async () => {
  const r = await runStorageCheck({
    env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
    putAvatar: async () => {},
    removeAvatar: async () => {},
    avatarPublicUrl: () => "https://x.supabase.co/storage/v1/object/public/periscopio-avatars/diagnostico/a.png",
    uploadObject: async () => "https://x.supabase.co/signed",
    removeObject: async () => {},
    fetch: async (url) => (url.includes("/public/") ? resp(400, Buffer.from("{}"), "application/json") : resp(200, Buffer.from("teste sintetico do periscopio"), "text/plain")),
  });
  assert.equal(r.ok, false);
  assert.equal(r.avatar.httpStatus, 400);
  assert.match(r.steps.find((s) => s.id === "avatar_link")!.detail, /400/);
});

test("falha no upload da foto é relatada sem derrubar o teste", async () => {
  const r = await runStorageCheck({
    env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" },
    putAvatar: async () => { throw new Error("Falha ao criar o bucket de avatares: not allowed"); },
    uploadObject: async () => { throw new Error("Bucket not found"); },
  });
  assert.equal(r.ok, false);
  assert.match(r.steps.find((s) => s.id === "avatar_upload")!.detail, /bucket de avatares/);
  assert.equal(r.avatar.publicUrl, null);
});
