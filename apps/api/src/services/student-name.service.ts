import { and, eq, inArray } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../db/client";
import { caseSummaries, studentIdentityVault } from "@periscopio/shared";
import type { Actor } from "../security/actor";
import { canonicalRole } from "../security/capabilities";
import { canAccessSchool } from "../security/tenancy";
import { decideCapability } from "./privilege.service";
import { decryptText } from "./identity-crypto.service";
import { recordAudit } from "./audit.service";

/**
 * Nome do aluno para a EQUIPE DO CASO.
 *
 * O nome continua cifrado no cofre. Esta camada decide quem o recebe sem o passo de "revelar com justificativa":
 *   - só os perfis que atendem o caso: RE/PpI e professor (da própria escola), médico (da rede) e especialista
 *     (somente nos casos em que tem seção delegada);
 *   - gestão, Board, pesquisa e administração NUNCA recebem o nome, mesmo que alguém marque a caixinha;
 *   - a capacidade `student.name.view` fica desligada até a aprovação clínica e do DPO (o Administrador Master liga por perfil);
 *   - cada abertura de caso grava um evento de auditoria (quem viu, de qual aluno e quando).
 */
export const PERFIS_DA_EQUIPE_DO_CASO = ["ppi", "md1", "specialist", "teacher"] as const;

export function perfilDaEquipe(role: string): boolean {
  return (PERFIS_DA_EQUIPE_DO_CASO as readonly string[]).includes(canonicalRole(role));
}

/** "João da Silva" → "João S." (primeiro nome + inicial do último sobrenome). Nome único fica como está. */
export function nomeCurto(nomeCompleto: string | null | undefined): string | null {
  const partes = (nomeCompleto ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.length === 1) return partes[0];
  const ultimo = partes[partes.length - 1];
  return `${partes[0]} ${ultimo.charAt(0).toLocaleUpperCase("pt-BR")}.`;
}

export interface AlunoDoCaso {
  studentId: string;
  tenantId: string;
  schoolId: string;
  caseId: string;
}

export interface NomeDoAluno {
  fullName: string;
  label: string;
}

/** O perfil e a capacidade permitem ver nomes? (não olha ainda para cada aluno) */
export async function podeVerNomes(actor: Actor): Promise<boolean> {
  if (!perfilDaEquipe(actor.role)) return false;
  return (await decideCapability(actor, "student.name.view")).allowed;
}

/**
 * Devolve o nome de cada aluno que a pessoa pode ver. Quem estiver fora do escopo (outro município, outra escola,
 * especialista sem seção no caso) simplesmente não aparece no resultado.
 */
export async function carregarNomes(actor: Actor, alunos: AlunoDoCaso[]): Promise<Map<string, NomeDoAluno>> {
  const out = new Map<string, NomeDoAluno>();
  if (alunos.length === 0 || !(await podeVerNomes(actor))) return out;

  let dentroDoEscopo = alunos.filter((a) => a.tenantId === actor.tenantId && canAccessSchool(actor, a.tenantId, a.schoolId));

  if (canonicalRole(actor.role) === "specialist") {
    const casos = [...new Set(dentroDoEscopo.map((a) => a.caseId))];
    const minhas = casos.length
      ? await db
          .select({ caseId: caseSummaries.caseId })
          .from(caseSummaries)
          .where(and(inArray(caseSummaries.caseId, casos), eq(caseSummaries.assignedProfessionalId, actor.id)))
      : [];
    const meusCasos = new Set(minhas.map((m) => m.caseId));
    dentroDoEscopo = dentroDoEscopo.filter((a) => meusCasos.has(a.caseId));
  }
  if (dentroDoEscopo.length === 0) return out;

  const ids = [...new Set(dentroDoEscopo.map((a) => a.studentId))];
  const cofre = await db
    .select({ studentId: studentIdentityVault.studentId, encryptedFullName: studentIdentityVault.encryptedFullName })
    .from(studentIdentityVault)
    .where(inArray(studentIdentityVault.studentId, ids));
  for (const c of cofre) {
    const fullName = decryptText(c.encryptedFullName).trim();
    const label = nomeCurto(fullName);
    if (fullName && label) out.set(c.studentId, { fullName, label });
  }
  return out;
}

/** Auditoria de leitura do nome: um evento por aluno aberto, sem gravar o nome. */
export async function auditarLeituraDoNome(
  actor: Actor,
  info: { tenantId: string; studentId: string; studentCode: string; caseId: string },
  request: FastifyRequest
): Promise<void> {
  await recordAudit(
    {
      tenantId: info.tenantId,
      userId: actor.id,
      userEmail: actor.email,
      action: "student.identity_viewed",
      entityType: "student_identity_vault",
      entityId: info.studentId,
      payload: { studentCode: info.studentCode, caseId: info.caseId, role: actor.role, via: "tela_do_caso" },
    },
    request
  );
}

/** Auditoria da fila: um evento por consulta, só com a quantidade (os nomes curtos não saem dali). */
export async function auditarLeituraNaFila(actor: Actor, tenantId: string, quantidade: number, request: FastifyRequest): Promise<void> {
  if (quantidade <= 0) return;
  await recordAudit(
    {
      tenantId,
      userId: actor.id,
      userEmail: actor.email,
      action: "student.identity_listed",
      entityType: "student_identity_vault",
      payload: { quantidade, role: actor.role, via: "fila" },
    },
    request
  );
}
