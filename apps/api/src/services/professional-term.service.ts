import crypto from "crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../db/client";
import { auditLogs, consentAcceptances, consentTerms, professionalTermStatus } from "@periscopio/shared";
import { CLINICAL_ROLES, VIRTUAL_ADMIN_ID } from "../security/roles";

/**
 * Termo de Responsabilidade Clínica e LGPD do profissional.
 *
 * - O booleano de "pode usar" fica em `professional_term_status.accepted` (false ou ausência de linha = bloqueado).
 * - A PROVA do aceite fica em `consent_acceptances` (hash SHA-256 do texto exibido, IP, navegador, versão) e na trilha
 *   de auditoria. As três gravações acontecem na mesma transação: não existe estado "aceito" sem prova.
 * - O texto que a tela mostra é o texto guardado e usado no hash (a tela lê do servidor).
 * - Mudar o texto = nova versão (TERMO_PROFISSIONAL_VERSAO). Para exigir novo aceite de todos, zerar `accepted`.
 */
export const TERMO_PROFISSIONAL_TIPO = "termo_profissional_lgpd";
export const TERMO_PROFISSIONAL_VERSAO = "v1.1";
export const TERMO_PROFISSIONAL = {
  title: "Termo de Responsabilidade Clínica & LGPD",
  summary: "Obrigatório para acesso e manuseio de prontuários de saúde mental infantil",
  content: [
    "COMPROMISSO ÉTICO, DEONTOLÓGICO E DE PROTEÇÃO DE DADOS (LEI 13.709/2018):",
    "1. Sigilo e Reserva Profissional: Declaro observar estritamente as resoluções do meu Conselho de Classe Profissional (CFM, CFP, CREFONO, ABPp, CFESS, etc.) pertinentes ao sigilo de prontuários clínicos.",
    "2. Minimização de Dados (Art. 6º, III): Comprometo-me a acessar e registrar unicamente as informações pertinentes à minha especialidade técnica e à conduta assistencial do estudante.",
    "3. Proibição de Vazamento e Cópia: É estritamente vedado copiar, fotografar, exportar ou compartilhar dados clínicos de menores com terceiros não autorizados ou por canais de mensageria não oficiais.",
    "4. Imutabilidade e Auditoria: Estou ciente de que cada visualização e preenchimento de prontuário é auditada com carimbo de tempo, IP e assinatura eletrônica rastreável.",
  ].join("\n"),
};

export class MigracaoPendenteError extends Error {
  constructor() {
    super("O sistema está sendo atualizado (migração do banco pendente). Nada foi gravado; tente de novo em alguns minutos.");
  }
}

const tabelaAusente = (err: unknown) => codigoDoErro(err) === "42P01";

export class TermoDesatualizadoError extends Error {
  constructor() {
    super("O termo foi atualizado. Recarregue a página e leia a versão atual antes de aceitar.");
  }
}

type AtorTermo = { id: string; email: string; name?: string | null; role: string; tenantId: string };

const ehVirtual = (a: { id: string }) => a.id === VIRTUAL_ADMIN_ID;

/**
 * A trava está ligada em produção. Desliga com REQUIRE_PROFESSIONAL_TERM=false (válvula de emergência).
 * Nos testes só liga com REQUIRE_PROFESSIONAL_TERM=true, para não exigir aceite em todo teste que cria usuário.
 */
export function termoExigido(env: Record<string, string | undefined> = process.env): boolean {
  if (env.REQUIRE_PROFESSIONAL_TERM === "false") return false;
  if (env.NODE_ENV === "test") return env.REQUIRE_PROFESSIONAL_TERM === "true";
  return true;
}

const ROTAS_LIVRES = ["/api/me/", "/api/auth/", "/api/notifications"];
const CACHE_MS = 30_000;
const aceitoEmCache = new Map<string, number>();
export const limparCacheDoTermo = () => aceitoEmCache.clear();

function codigoDoErro(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

/**
 * true = o servidor deve barrar (403 TERMO_PENDENTE). Só vale para perfis clínicos, fora das rotas que o próprio
 * aceite precisa usar. Se a tabela ainda não existe (migração 0029 não aplicada) NÃO derruba o sistema: libera e avisa.
 */
export async function termoPendente(actor: { id: string; role: string }, url: string): Promise<boolean> {
  if (!termoExigido()) return false;
  if (ehVirtual(actor) || !(CLINICAL_ROLES as readonly string[]).includes(actor.role)) return false;
  if (ROTAS_LIVRES.some((p) => url.startsWith(p))) return false;

  const ate = aceitoEmCache.get(actor.id);
  if (ate && ate > Date.now()) return false;

  try {
    const [linha] = await db
      .select({ accepted: professionalTermStatus.accepted })
      .from(professionalTermStatus)
      .where(eq(professionalTermStatus.userId, actor.id))
      .limit(1);
    if (linha?.accepted) {
      aceitoEmCache.set(actor.id, Date.now() + CACHE_MS);
      return false;
    }
    return true;
  } catch (err) {
    if (codigoDoErro(err) === "42P01") {
      console.warn("[termo] tabela professional_term_status ausente (migração 0029 pendente): trava desligada");
      return false;
    }
    throw err;
  }
}

/** Garante a versão atual do termo no município e desativa as anteriores. */
export async function garantirTermoProfissional(tenantId: string) {
  const buscar = () =>
    db
      .select()
      .from(consentTerms)
      .where(and(eq(consentTerms.tenantId, tenantId), eq(consentTerms.type, TERMO_PROFISSIONAL_TIPO), eq(consentTerms.version, TERMO_PROFISSIONAL_VERSAO)))
      .orderBy(desc(consentTerms.publishedAt))
      .limit(1);
  let [termo] = await buscar();
  if (!termo) {
    await db
      .insert(consentTerms)
      .values({ tenantId, version: TERMO_PROFISSIONAL_VERSAO, type: TERMO_PROFISSIONAL_TIPO, ...TERMO_PROFISSIONAL, active: true })
      .onConflictDoNothing();
    [termo] = await buscar();
    await db
      .update(consentTerms)
      .set({ active: false })
      .where(and(eq(consentTerms.tenantId, tenantId), eq(consentTerms.type, TERMO_PROFISSIONAL_TIPO), ne(consentTerms.version, TERMO_PROFISSIONAL_VERSAO)));
  }
  return termo;
}

/** Situação atual do aceite + o termo vigente (a tela exibe exatamente este texto). */
export async function situacaoDoTermo(actor: AtorTermo) {
  const termo = await garantirTermoProfissional(actor.tenantId);
  let aceito: { acceptedAt: Date | null; version: string | null } | null = null;
  if (ehVirtual(actor)) {
    // Vale por conta (e-mail), de qualquer versão do termo.
    const [a] = await db
      .select({ acceptedAt: consentAcceptances.acceptedAt, version: consentTerms.version })
      .from(consentAcceptances)
      .innerJoin(consentTerms, eq(consentTerms.id, consentAcceptances.termId))
      .where(and(eq(consentAcceptances.tenantId, actor.tenantId), eq(consentAcceptances.signerEmail, actor.email), eq(consentAcceptances.status, "accepted"), eq(consentTerms.type, TERMO_PROFISSIONAL_TIPO)))
      .orderBy(desc(consentAcceptances.acceptedAt))
      .limit(1);
    if (a) aceito = { acceptedAt: a.acceptedAt, version: a.version };
  } else {
    try {
      const [s] = await db
        .select({ accepted: professionalTermStatus.accepted, acceptedAt: professionalTermStatus.acceptedAt, version: professionalTermStatus.termVersion })
        .from(professionalTermStatus)
        .where(eq(professionalTermStatus.userId, actor.id))
        .limit(1);
      if (s?.accepted) aceito = { acceptedAt: s.acceptedAt, version: s.version };
    } catch (err) {
      if (!tabelaAusente(err)) throw err;
      // Migração 0029 ainda não aplicada: não dá para gravar o aceite. Não trava ninguém nem mostra a janela (a trava do
      // servidor também fica desligada nesse caso); o aviso vai para o log e a resposta marca migrationPending.
      console.warn("[termo] tabela professional_term_status ausente (migração 0029 pendente): janela e trava desligadas");
      return {
        hasAccepted: true,
        acceptedAt: null,
        acceptedVersion: null,
        migrationPending: true,
        term: { id: termo.id, version: termo.version, title: termo.title, summary: termo.summary, content: termo.content },
      };
    }
  }
  return {
    hasAccepted: !!aceito,
    migrationPending: false,
    acceptedAt: aceito?.acceptedAt ?? null,
    acceptedVersion: aceito?.version ?? null,
    term: { id: termo.id, version: termo.version, title: termo.title, summary: termo.summary, content: termo.content },
  };
}

/**
 * Registra o aceite: prova (consent_acceptances) + estado (accepted = true) + auditoria, em UMA transação.
 * Repetir o aceite da mesma versão não duplica nada.
 */
export async function registrarAceiteProfissional(
  actor: AtorTermo,
  entrada: { termId?: string; termVersion?: string },
  contexto: { ip: string; userAgent: string }
) {
  const termo = await garantirTermoProfissional(actor.tenantId);
  if ((entrada.termId && entrada.termId !== termo.id) || (entrada.termVersion && entrada.termVersion !== termo.version)) {
    throw new TermoDesatualizadoError();
  }
  const atual = await situacaoDoTermo(actor);
  if (atual.migrationPending) throw new MigracaoPendenteError();
  // Um aceite por conta: quem já aceitou não registra de novo (nem se o texto ganhar nova versão; para exigir novo
  // aceite de todos, zere `accepted` em professional_term_status).
  if (atual.hasAccepted) {
    return { jaAceito: true as const, acceptedAt: atual.acceptedAt as Date, version: atual.acceptedVersion ?? termo.version };
  }

  const virtual = ehVirtual(actor);
  const aceitoEm = new Date();
  const evidenceSha256 = crypto
    .createHash("sha256")
    .update([termo.content, termo.version, actor.email, actor.role, contexto.ip, aceitoEm.toISOString()].join("|"))
    .digest("hex");

  const aceite = await db.transaction(async (tx) => {
    const [prova] = await tx
      .insert(consentAcceptances)
      .values({
        tenantId: actor.tenantId,
        termId: termo.id,
        // O Admin Master é um ator virtual (sem linha em users): a prova guarda o e-mail e deixa o vínculo nulo.
        userId: virtual ? null : actor.id,
        signerName: actor.name || actor.email,
        signerRole: actor.role,
        signerEmail: actor.email,
        ipAddress: contexto.ip.slice(0, 45),
        userAgent: contexto.userAgent.slice(0, 500),
        evidenceSha256,
        status: "accepted",
        acceptedAt: aceitoEm,
      })
      .returning();

    if (!virtual) {
      await tx
        .insert(professionalTermStatus)
        .values({ userId: actor.id, tenantId: actor.tenantId, accepted: true, acceptedAt: aceitoEm, termId: termo.id, termVersion: termo.version, acceptanceId: prova.id })
        .onConflictDoUpdate({
          target: professionalTermStatus.userId,
          set: { accepted: true, acceptedAt: aceitoEm, termId: termo.id, termVersion: termo.version, acceptanceId: prova.id, updatedAt: aceitoEm },
        });
    }

    await tx.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: virtual ? undefined : actor.id,
      userEmail: actor.email,
      action: "consent.professional_accepted",
      entity: "consent_acceptance",
      entityId: prova.id,
      ipAddress: contexto.ip.slice(0, 45),
      userAgent: contexto.userAgent.slice(0, 500),
      payload: { termId: termo.id, termVersion: termo.version, evidenceSha256, role: actor.role },
      metadata: virtual ? { actor: "admin_master_virtual" } : undefined,
    });
    return prova;
  }).catch((err) => {
    if (tabelaAusente(err)) throw new MigracaoPendenteError();
    throw err;
  });

  aceitoEmCache.set(actor.id, Date.now() + CACHE_MS);
  return { jaAceito: false as const, acceptedAt: aceite.acceptedAt, version: termo.version, evidenceSha256 };
}
