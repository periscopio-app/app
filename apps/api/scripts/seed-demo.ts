/**
 * Perfil de demonstração completo (dados 100% fictícios, sem nome nem identificador de criança).
 *
 *   DATABASE_URL=... SEED_DEMO_PASSWORD='<senha>' tsx scripts/seed-demo.ts [--apply]
 *
 * Cria (se não existirem): município "Demonstração", Escola Demo (slug demo-escola) com localização e matrícula
 * fictícias, um usuário por papel (e-mails em @demo.periscopio.test, domínio que não recebe e-mail),
 * 12 alunos sintéticos e 1 caso aberto. A senha vem do ambiente e nunca é impressa.
 * Sem --apply roda em simulação.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { caseTimeline, cases, schools, students, tenants, users } from "@periscopio/shared";
import { upsertCredential } from "../src/auth/credentials";
import { ageBracketOf, generateStudentCode } from "../src/services/student-code";

const DOMAIN = "demo.periscopio.test";
const PEOPLE = [
  { key: "gestor.municipal", name: "Gestor(a) Municipal (demo)", role: "municipal_manager", school: false },
  { key: "gestor.escola", name: "Gestor(a) Escolar (demo)", role: "school_manager", school: true },
  { key: "re", name: "RE – Psicopedagogo(a) Institucional (demo)", role: "ppi", school: true },
  { key: "medico", name: "Médico(a) (demo)", role: "md1", school: false },
  { key: "neuropsicologia", name: "Especialista Neuropsicologia (demo)", role: "specialist", school: false, specialty: "neuropsicologia" },
  { key: "fonoaudiologia", name: "Especialista Fonoaudiologia (demo)", role: "specialist", school: false, specialty: "fonoaudiologia" },
  { key: "board", name: "Board de experts (demo)", role: "board", school: false },
  { key: "pesquisador", name: "Pesquisador(a) (demo)", role: "researcher", school: false },
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const password = process.env.SEED_DEMO_PASSWORD;
  if (apply && (!password || password.length < 12)) throw new Error("Defina SEED_DEMO_PASSWORD (mín. 12 caracteres) no ambiente.");
  console.log(apply ? "APLICANDO perfil de demonstração" : "SIMULAÇÃO (nada será gravado)");

  let [tenant] = await db.select().from(tenants).where(eq(tenants.municipalityCode, "DEMO")).limit(1);
  if (!tenant && apply) [tenant] = await db.insert(tenants).values({ name: "Município Demonstração", municipalityCode: "DEMO" }).returning();
  console.log(`município: ${tenant ? "existe" : "será criado"}`);

  let school = tenant ? (await db.select().from(schools).where(eq(schools.slug, "demo-escola")).limit(1))[0] : undefined;
  if (!school && apply && tenant) {
    [school] = await db
      .insert(schools)
      .values({ tenantId: tenant.id, name: "Escola Demo", slug: "demo-escola", status: "active", externalCode: "DEMO", address: "Endereço fictício, 100", latitude: -15.7939, longitude: -47.8828, enrollment: 600 })
      .returning();
  }
  console.log(`escola demo: ${school ? "existe" : "será criada"}`);

  for (const p of PEOPLE) {
    const email = `${p.key}@${DOMAIN}`;
    const found = tenant ? (await db.select().from(users).where(and(eq(users.tenantId, tenant.id), eq(users.email, email))).limit(1))[0] : undefined;
    console.log(`  ${p.role.padEnd(18)} ${email} ${found ? "(já existe)" : "(será criado)"}`);
    if (!apply || found || !tenant) continue;
    await db.insert(users).values({
      tenantId: tenant.id, schoolId: p.school && school ? school.id : null, email, name: p.name, role: p.role,
      specialty: "specialty" in p ? p.specialty : null, accessEnabled: true,
    });
    await upsertCredential({ email, name: p.name, password: password! });
  }

  if (apply && tenant && school) {
    const existing = await db.select().from(students).where(eq(students.schoolId, school.id));
    if (existing.length === 0) {
      const made = [];
      for (let i = 0; i < 12; i++) {
        const y = 2016 + (i % 4), m = (i % 12) + 1;
        const [s] = await db.insert(students).values({
          tenantId: tenant.id, schoolId: school.id, studentCode: generateStudentCode(school.slug), birthYear: y, birthMonth: m, ageBracket: ageBracketOf(y, m),
        }).returning();
        made.push(s);
      }
      const [c] = await db.insert(cases).values({ tenantId: tenant.id, studentId: made[0].id, status: "triagem", journeyState: "rascunho" }).returning();
      await db.insert(caseTimeline).values({ tenantId: tenant.id, caseId: c.id, event: "case:created", payload: { actorRole: "seed-demo" } });
      console.log("  12 alunos sintéticos e 1 caso aberto criados");
    }
  }
  console.log("Concluído. Entre pelo e-mail <perfil>@" + DOMAIN + " com a senha definida em SEED_DEMO_PASSWORD.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
