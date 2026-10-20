import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  AVATAR_MAX_BYTES,
  chaveDoAvatar,
  chavePertenceAoUsuario,
  detectarFormato,
  limparJpeg,
  limparPng,
  validarFoto,
  webpTemMetadados,
} from "./avatar.service";

// JPEG mínimo sintético: SOI + APP1(EXIF com texto "GPS") + APP0 + SOS + dados + EOI
function jpeg(comExif: boolean): Buffer {
  const app1Dados = Buffer.from("Exif\0\0GPS-FICTICIO");
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, app1Dados.length + 2]), app1Dados]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), comExif ? app1 : Buffer.alloc(0), app0, sos]);
}

function chunkPng(tipo: string, dados: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  return Buffer.concat([len, Buffer.from(tipo, "latin1"), dados, Buffer.alloc(4)]); // CRC fictício: não é validado
}
function png(comTexto: boolean): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPng("IHDR", Buffer.alloc(13)),
    comTexto ? chunkPng("tEXt", Buffer.from("Author\0Fulana")) : Buffer.alloc(0),
    chunkPng("IDAT", Buffer.from([1, 2, 3])),
    chunkPng("IEND", Buffer.alloc(0)),
  ]);
}

function webp(extra?: string): Buffer {
  const chunk = (t: string, d: Buffer) => {
    const l = Buffer.alloc(4);
    l.writeUInt32LE(d.length);
    return Buffer.concat([Buffer.from(t, "latin1"), l, d, d.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const corpo = Buffer.concat([Buffer.from("WEBP"), chunk("VP8 ", Buffer.alloc(10)), extra ? chunk(extra, Buffer.from("meta")) : Buffer.alloc(0)]);
  const tam = Buffer.alloc(4);
  tam.writeUInt32LE(corpo.length);
  return Buffer.concat([Buffer.from("RIFF"), tam, corpo]);
}

const b64 = (b: Buffer) => b.toString("base64");

describe("Foto de perfil: validação", () => {
  test("detecta JPEG, PNG e WEBP pelos bytes, não pelo que o navegador diz", () => {
    assert.equal(detectarFormato(jpeg(false))?.ext, "jpg");
    assert.equal(detectarFormato(png(false))?.ext, "png");
    assert.equal(detectarFormato(webp())?.ext, "webp");
    assert.equal(detectarFormato(Buffer.from("<svg onload=alert(1)>")), null);
    assert.equal(detectarFormato(Buffer.from("%PDF-1.7")), null);
  });

  test("JPEG: remove EXIF/GPS e mantém a imagem", () => {
    const limpo = limparJpeg(jpeg(true))!;
    assert.ok(limpo);
    assert.ok(!limpo.includes(Buffer.from("GPS-FICTICIO")));
    assert.ok(limpo.includes(Buffer.from([0xff, 0xe0]))); // APP0 preservado
    assert.ok(limpo.includes(Buffer.from([0x11, 0x22, 0x33]))); // dados da imagem preservados
    assert.equal(detectarFormato(limpo)?.ext, "jpg");
  });

  test("PNG: remove blocos de texto e mantém os de imagem", () => {
    const limpo = limparPng(png(true))!;
    assert.ok(limpo);
    assert.ok(!limpo.includes(Buffer.from("Fulana")));
    assert.ok(limpo.includes(Buffer.from("IDAT")));
    assert.ok(limpo.includes(Buffer.from("IEND")));
  });

  test("WEBP com EXIF ou XMP é recusado; limpo passa", () => {
    assert.equal(webpTemMetadados(webp()), false);
    assert.equal(webpTemMetadados(webp("EXIF")), true);
    assert.equal(webpTemMetadados(webp("XMP ")), true);
  });

  test("validarFoto aceita com ou sem prefixo data URL e devolve bytes limpos", () => {
    const a = validarFoto(b64(jpeg(true)));
    assert.equal(a.ok, true);
    if (a.ok) assert.ok(!a.bytes.includes(Buffer.from("GPS-FICTICIO")));
    const b = validarFoto(`data:image/png;base64,${b64(png(false))}`);
    assert.equal(b.ok && b.format.contentType, "image/png");
  });

  test("validarFoto recusa vazio, texto, SVG, PDF, arquivo corrompido e WEBP com metadados", () => {
    assert.equal(validarFoto(undefined).ok, false);
    assert.equal(validarFoto("").ok, false);
    assert.equal(validarFoto("isto não é base64!!").ok, false);
    assert.equal(validarFoto(b64(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).ok, false);
    assert.equal(validarFoto(b64(Buffer.from("%PDF-1.7 fake"))).ok, false);
    assert.equal(validarFoto(b64(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).ok, false); // JPEG truncado
    const w = validarFoto(b64(webp("EXIF")));
    assert.equal(w.ok, false);
  });

  test("validarFoto recusa arquivo acima de 2 MB com 413", () => {
    const grande = Buffer.concat([jpeg(false), Buffer.alloc(AVATAR_MAX_BYTES + 10)]);
    const r = validarFoto(b64(grande));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 413);
  });

  test("chave do objeto é opaca e só o dono pode removê-la", () => {
    const k = chaveDoAvatar("tenant-1", "user-1", "webp");
    assert.match(k, /^avatars\/tenant-1\/user-1\/[0-9a-f-]{36}\.webp$/);
    assert.equal(chavePertenceAoUsuario(k, "tenant-1", "user-1"), true);
    assert.equal(chavePertenceAoUsuario(k, "tenant-1", "user-2"), false);
    assert.equal(chavePertenceAoUsuario("schools/x/y/z.pdf", "tenant-1", "user-1"), false);
    assert.equal(chavePertenceAoUsuario(null, "tenant-1", "user-1"), false);
  });
});
