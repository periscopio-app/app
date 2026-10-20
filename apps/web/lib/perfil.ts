/** Tipos e utilidades do "Meu painel" (perfil, foto e métricas). Espelham as rotas /api/me/*. */

export interface PerfilUsuario {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  specialty: string | null;
  classCode: string | null;
  phone: string | null;
  cpfMasked: string | null;
  bio: string | null;
  avatarUrl: string | null;
  school: { id: string; name: string | null } | null;
  tenantName: string | null;
  createdAt: string;
  deletionRequest: { protocol: string; createdAt: string } | null;
  editable: string[];
}

export interface CartaoMetrica {
  chave: string;
  rotulo: string;
  valor: number | null;
  unidade: string | null;
  ajuda: string;
  oculto?: boolean;
}

export interface TabelaMetrica {
  chave: string;
  titulo: string;
  colunas: string[];
  linhas: (string | number | null)[][];
}

export interface MetricasPerfil {
  papel: string;
  titulo: string;
  descricao: string;
  cartoes: CartaoMetrica[];
  tabelas: TabelaMetrica[];
  aviso: string;
  geradoEm: string;
}

export const ESPECIALIDADES: Record<string, string> = {
  fonoaudiologia: "Fonoaudiologia",
  medicina: "Medicina",
  psicologia: "Psicologia",
  neuropsicologia: "Neuropsicologia",
  psicopedagogia: "Psicopedagogia",
  psicomotricidade: "Psicomotricidade",
  servico_social: "Serviço social",
};

/** 11912345678 → (11) 91234-5678. Aceita o que já vier formatado. */
export function formatarTelefone(valor: string | null | undefined): string {
  const d = (valor ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "P";
  const a = partes[0]![0]!;
  const b = partes.length > 1 ? partes[partes.length - 1]![0]! : "";
  return (a + b).toUpperCase();
}

export const FOTO_TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
export const FOTO_LIMITE_ORIGINAL = 12 * 1024 * 1024; // o original pode ser grande: reduzimos antes de enviar

/**
 * Lê a imagem escolhida, recorta o centro em quadrado, reduz para 512×512 e reenvia como WEBP (ou JPEG).
 * Reencodar no navegador descarta EXIF/GPS e deixa o arquivo pequeno (~50 KB). Devolve base64 puro.
 */
export async function prepararFoto(arquivo: File): Promise<{ base64: string; previewUrl: string }> {
  if (!FOTO_TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new Error("Escolha uma imagem JPG, PNG ou WEBP.");
  }
  if (arquivo.size > FOTO_LIMITE_ORIGINAL) {
    throw new Error("A imagem passa de 12 MB. Escolha uma menor.");
  }
  const bitmap = await createImageBitmap(arquivo).catch(() => null);
  if (!bitmap) throw new Error("Não foi possível abrir esta imagem. Tente outra.");

  const lado = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - lado) / 2);
  const sy = Math.floor((bitmap.height - lado) / 2);
  const alvo = Math.min(512, lado);
  const canvas = document.createElement("canvas");
  canvas.width = alvo;
  canvas.height = alvo;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu preparar a imagem.");
  ctx.fillStyle = "#ffffff"; // PNG com transparência vira fundo branco no JPEG
  ctx.fillRect(0, 0, alvo, alvo);
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, alvo, alvo);
  bitmap.close?.();

  let dataUrl = canvas.toDataURL("image/webp", 0.85);
  if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1] ?? "", previewUrl: dataUrl };
}
