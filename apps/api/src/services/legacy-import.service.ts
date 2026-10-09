/**
 * Contrato de importação da base individual legada (planilha NEMT de Tarumã).
 *
 * O extrator local (Python) lê a planilha na máquina de quem tem autorização, troca o nome da criança por UUID,
 * troca o endereço por coordenada e entrega um arquivo NDJSON neste formato. O carregador só aceita o que passar
 * por este contrato: campo desconhecido, coluna com cara de nome/endereço ou valor com cara de CPF/e-mail/telefone
 * derrubam a carga antes de gravar qualquer linha.
 */
import { z } from "zod";

export const SMALL_CELL = 5;

const uuid = z.string().uuid();
const int = z.number().int();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sha = z.string().regex(/^[a-f0-9]{64}$/);

export const SERVICE_KEYS = [
  "fonoaudiologia",
  "psicopedagogia",
  "psicoterapia",
  "psicomotricidade",
  "neuropsicologia",
  "assistencia_social",
  "consulta_medica",
] as const;

export const manifestSchema = z
  .object({
    manifest: z
      .object({
        schemaVersion: z.literal(1),
        source: z.string().min(3).max(60),
        referenceYear: int.min(2000).max(2100),
        fileSha256: sha,
        mappingSha256: sha,
        rowCount: int.min(0),
        columns: z.array(z.string().min(1).max(120)).min(1),
        transformedColumns: z.array(z.string()),
        columnNonNull: z.record(int.min(0)),
        geocoder: z.string().max(40).nullable(),
        warnings: z.array(z.string()).optional(),
        /** Colunas revisadas por humano cujo NOME parece identificador mas o conteúdo não é (ex.: CELULAR = "usa celular", 0/1). */
        allowedColumns: z.array(z.string().min(1).max(120)).optional(),
        /** Aba de dicionário de variáveis da planilha (sem dado de paciente). */
        dictionary: z
          .array(
            z
              .object({
                position: int.min(1),
                sheetColumn: z.string().max(10).nullable(),
                variable: z.string().max(160).nullable(),
                columnName: z.string().max(160).nullable(),
                description: z.string().nullable(),
                value: z.string().max(160).nullable(),
                label: z.string().nullable(),
              })
              .strict(),
          )
          .optional(),
      })
      .strict(),
  })
  .strict();

const patientFields = z
  .object({
    recordNumber: z.string().max(60).nullable(),
    birthDate: isoDate.nullable(),
    currentAge: int.min(0).max(120).nullable(),
    entryYear: int.min(1980).max(2100).nullable(),
    guardianRef: uuid.nullable(),
    guardianRelation: z.string().max(60).nullable(),
    religion: z.string().max(80).nullable(),
    parentsOccupation: z.string().max(2000).nullable(),
    economicClass: z.string().max(60).nullable(),
    extra: z.record(z.unknown()).nullable(),
  })
  .partial()
  .strict();

const locationSchema = z
  .object({
    status: z.enum(["ok", "low_confidence", "not_found", "out_of_area", "no_address", "skipped"]),
    latitude: z.number().min(-34).max(6).nullable(),
    longitude: z.number().min(-74).max(-28).nullable(),
    accuracy: z.string().max(30).nullable(),
    confidence: z.string().max(20).nullable(),
    addressKey: sha.nullable(),
    provider: z.string().max(40).nullable(),
    permanent: z.boolean().nullable(),
  })
  .strict();

export const patientLineSchema = z
  .object({
    patientId: uuid,
    sourceRow: int.min(1),
    school: z.object({ code: z.string().min(1).max(30), label: z.string().max(120).nullable() }).strict(),
    patient: patientFields,
    location: locationSchema,
    complaints: z.array(z.string().min(1).max(120)),
    services: z.array(
      z
        .object({
          service: z.enum(SERVICE_KEYS),
          column: z.string().min(1).max(80),
          valueNum: z.number().nullable(),
          valueText: z.string().nullable(),
        })
        .strict(),
    ),
    items: z.array(
      z
        .object({
          kind: z.enum(["hypothesis", "medication", "family_history"]),
          position: int.min(0),
          text: z.string().min(1).max(4000),
        })
        .strict(),
    ),
    /** Todas as colunas da planilha, por nome, exceto nome e endereço. */
    raw: z.record(z.unknown()),
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema>["manifest"];
export type PatientLine = z.infer<typeof patientLineSchema>;

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Cabeçalhos que indicam identificador direto. Nome e endereço precisam ter sido trocados antes do arquivo chegar aqui. */
const DENIED_KEY = /\b(nome|name|endereco|address|logradouro|rua|cep|cpf|rg|cns|telefone|celular|fone|email|e mail)\b/;

export function deniedColumns(keys: string[], allowed: string[] = []): string[] {
  const ok = new Set(allowed);
  return keys.filter((k) => !ok.has(k) && DENIED_KEY.test(norm(k)));
}

const PII_VALUE: { name: string; re: RegExp }[] = [
  { name: "cpf", re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/ },
  { name: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  // lookarounds evitam casar pedaços de UUID/hex (ex.: "…-4a1b-9c3d-…") e códigos com hífen
  { name: "telefone", re: /(?<![\w-])(?:\(\d{2}\)\s?|\d{2}\s)?9?\d{4}-\d{4}(?![\w-])/ },
];

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Procura padrões de documento/contato nos valores. Devolve só quais padrões e em quais campos, nunca o valor. */
export function scanPiiValues(line: PatientLine): { field: string; pattern: string }[] {
  const hits: { field: string; pattern: string }[] = [];
  const visit = (field: string, v: unknown) => {
    if (typeof v === "string") {
      const text = v.replace(UUID_RE, " "); // UUIDs são o pseudônimo esperado, não dado pessoal
      for (const p of PII_VALUE) if (p.re.test(text)) hits.push({ field, pattern: p.name });
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => visit(`${field}[${i}]`, x));
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) visit(`${field}.${k}`, x);
    }
  };
  visit("patient", line.patient);
  visit("items", line.items);
  visit("raw", line.raw);
  return hits;
}

// ── Faixas etárias (mesma regra do extrator de agregados) ─────────────────────────────
const AGE_BANDS: [string, number, number][] = [
  ["3-5", 0, 5],
  ["6-9", 6, 9],
  ["10-12", 10, 12],
  ["13-17", 13, 17],
  ["18+", 18, 200],
];
export const bandOf = (age: number | null | undefined): string | null => {
  if (age == null) return null;
  for (const [name, lo, hi] of AGE_BANDS) if (age >= lo && age <= hi) return name;
  return null;
};

// ── Conferência contra os agregados já carregados ─────────────────────────────────────
export interface Counts {
  total: number;
  ageBands: Record<string, number>;
  complaints: Record<string, number>;
  services: Record<string, number>;
}
export interface Check {
  scope: string; // "TOTAL" ou o código da escola
  metric: "total" | "ageBands" | "complaints" | "services";
  key: string;
  stored: number | null;
  derived: number;
  status: "ok" | "mismatch";
}

/** Agregado oculto (null) só é coerente com 1 a 4 casos; número exato precisa bater. */
export function compareCell(stored: number | null | undefined, derived: number): "ok" | "mismatch" {
  if (stored === undefined) return derived === 0 ? "ok" : "mismatch";
  if (stored === null) return derived >= 1 && derived < SMALL_CELL ? "ok" : "mismatch";
  return stored === derived ? "ok" : "mismatch";
}

export interface StoredPayload {
  total: number | null;
  ageBands: Record<string, number | null>;
  complaints: Record<string, number | null>;
  services: Record<string, number | null>;
}

export function compareScope(scope: string, stored: StoredPayload, derived: Counts): Check[] {
  const out: Check[] = [];
  const push = (metric: Check["metric"], key: string, s: number | null | undefined, d: number) =>
    out.push({ scope, metric, key, stored: s === undefined ? null : s, derived: d, status: compareCell(s, d) });
  push("total", "total", stored.total, derived.total);
  for (const k of new Set([...Object.keys(stored.ageBands ?? {}), ...Object.keys(derived.ageBands)]))
    push("ageBands", k, stored.ageBands?.[k], derived.ageBands[k] ?? 0);
  for (const k of new Set([...Object.keys(stored.complaints ?? {}), ...Object.keys(derived.complaints)]))
    push("complaints", k, stored.complaints?.[k], derived.complaints[k] ?? 0);
  for (const k of new Set([...Object.keys(stored.services ?? {}), ...Object.keys(derived.services)]))
    push("services", k, stored.services?.[k], derived.services[k] ?? 0);
  return out;
}

export function sumCounts(list: Counts[]): Counts {
  const acc: Counts = { total: 0, ageBands: {}, complaints: {}, services: {} };
  for (const c of list) {
    acc.total += c.total;
    for (const m of ["ageBands", "complaints", "services"] as const)
      for (const [k, v] of Object.entries(c[m])) acc[m][k] = (acc[m][k] ?? 0) + v;
  }
  return acc;
}
