/**
 * Cadastra professores SINTÉTICOS na escola indicada, para o RE escolher o "Professor(a) entrevistado(a)" (Formulário B).
 *
 *   pnpm --filter @periscopio/api seed:professores -- --school <slug> [--count 5] [--apply]
 *
 * - Sem --apply roda em simulação: mostra o que seria criado e não grava nada.
 * - Idempotente: o e-mail é determinístico (professor.NN@<slug>.professores.periscopio.test), então rodar de novo não duplica.
 * - Só dados fictícios: nome "Professor(a) NN (demo)" e e-mail no domínio reservado .test. Nenhum nome ou contato real.
 * - Cria só o cadastro na escola (lista do Formulário B). NÃO cria login nem senha: `accessEnabled` fica falso.
 * - Nunca toca em escola de município real (Tarumã): recusa se o município da escola não for marcado como demonstração.
 *   Para usar numa escola real, cadastre o professor pela tela de usuários (convite por e-mail) em vez deste script.
 */
import "dotenv/config";
try {
  process.loadEnvFile("../../.env");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { schools, tenants, users } from "@periscopio/shared";

const argv = process.argv.slice(2);
const valor = (flag: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

async function main() {
  const apply = argv.includes("--apply");
  const slug = valor("--school");
  const count = Math.min(Math.max(Number(valor("--count") ?? 5) || 5, 1), 20);
  if (!slug) throw new Error("Informe a escola: --school <slug> (ex.: demo-escola).");

  const [school] = await db.select().from(schools).where(eq(schools.slug, slug)).limit(1);
  if (!school) throw new Error(`Escola com slug "${slug}" não encontrada.`);
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, school.tenantId)).limit(1);
  if (!tenant?.demo) {
    throw new Error(
      `A escola "${slug}" pertence a um município que não é de demonstração. Recusado: use a tela de usuários para cadastrar professores reais.`
    );
  }

  console.log(apply ? `APLICANDO em "${school.name}"` : `SIMULAÇÃO em "${school.name}" (nada será gravado)`);
  let criados = 0;
  for (let n = 1; n <= count; n++) {
    const nn = String(n).padStart(2, "0");
    const email = `professor.${nn}@${slug}.professores.periscopio.test`;
    const [achou] = await db.select({ id: users.id }).from(users).where(and(eq(users.tenantId, tenant.id), eq(users.email, email))).limit(1);
    console.log(`  ${email} ${achou ? "(já existe)" : "(será criado)"}`);
    if (achou || !apply) continue;
    await db.insert(users).values({
      tenantId: tenant.id,
      schoolId: school.id,
      email,
      name: `Professor(a) ${nn} (demo)`,
      role: "teacher",
      accessEnabled: false,
    });
    criados += 1;
  }
  console.log(apply ? `Concluído: ${criados} professor(es) criado(s).` : "Simulação concluída. Rode de novo com --apply para gravar.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
