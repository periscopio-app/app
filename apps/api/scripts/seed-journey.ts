/**
 * Popula a jornada clínica com casos e transições reais de exemplo nos diferentes estágios:
 * rascunho -> enviado_re -> revisao_medica -> delegado -> retornado -> encerrado
 * 
 * Uso:
 *   DATABASE_URL=... pnpm --filter @periscopio/api exec tsx scripts/seed-journey.ts [--tenant <uuid>]
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { cases, caseTimeline, caseTransitions, caseSummaries, reAssessments, schools, students, tenants, users } from "@periscopio/shared";
import { generateStudentCode, ageBracketOf } from "../src/services/student-code";

async function main() {
  const argTenant = process.argv.find((a, i) => process.argv[i - 1] === "--tenant");

  // Localiza tenant de destino (fornecido, ou primeiro com escola cadastrada)
  let tenantId = argTenant;
  if (!tenantId) {
    const sc = await db.select().from(schools).limit(1);
    if (sc.length > 0) tenantId = sc[0].tenantId;
  }
  if (!tenantId) {
    const t = await db.select().from(tenants).limit(1);
    tenantId = t[0]?.id;
  }
  if (!tenantId) throw new Error("Nenhum tenant encontrado no banco.");

  const [school] = await db.select().from(schools).where(eq(schools.tenantId, tenantId)).limit(1);
  if (!school) throw new Error(`Nenhuma escola encontrada para o tenant ${tenantId}`);

  console.log(`Populando casos da jornada clínica para tenant ${tenantId} (escola: ${school.name})...`);

  // Usuários para atribuição
  const userList = await db.select().from(users).where(eq(users.tenantId, tenantId));
  const ppiUser = userList.find((u) => u.role === "ppi") ?? userList[0];
  const mdUser = userList.find((u) => u.role === "md1") ?? userList[0];
  const fonoUser = userList.find((u) => u.specialty === "fonoaudiologia") ?? userList[0];

  const stages: Array<{
    targetState: "rascunho" | "enviado_re" | "revisao_medica" | "delegado" | "retornado" | "encerrado";
    birthYear: number;
    birthMonth: number;
    description: string;
  }> = [
    { targetState: "rascunho", birthYear: 2017, birthMonth: 3, description: "Caso inicial recém-aberto pela RE" },
    { targetState: "enviado_re", birthYear: 2016, birthMonth: 7, description: "Triagem concluída e enviada pela RE" },
    { targetState: "revisao_medica", birthYear: 2017, birthMonth: 10, description: "Em revisão pelo médico (MD-1)" },
    { targetState: "delegado", birthYear: 2015, birthMonth: 4, description: "Delegado para avaliação de fonoaudiologia" },
    { targetState: "retornado", birthYear: 2016, birthMonth: 2, description: "Avaliações concluídas, pronto para conduta final" },
    { targetState: "encerrado", birthYear: 2015, birthMonth: 11, description: "Jornada clínica e devolutiva escolar concluídas" },
  ];

  for (const s of stages) {
    // Cria estudante
    const studentCode = generateStudentCode(school.slug);
    const [st] = await db
      .insert(students)
      .values({
        tenantId,
        schoolId: school.id,
        studentCode,
        birthYear: s.birthYear,
        birthMonth: s.birthMonth,
        ageBracket: ageBracketOf(s.birthYear, s.birthMonth),
      })
      .returning();

    // Cria caso
    const [c] = await db
      .insert(cases)
      .values({
        tenantId,
        studentId: st.id,
        status: s.targetState === "encerrado" ? "concluido" : "triagem",
        journeyState: s.targetState,
        updatedAt: new Date(),
      })
      .returning();

    // Evento de criação
    await db.insert(caseTimeline).values({
      tenantId,
      caseId: c.id,
      event: "case:created",
      payload: { actorRole: "ppi", actorId: ppiUser?.id, note: s.description },
    });
    await db.insert(caseTransitions).values({
      tenantId,
      caseId: c.id,
      fromState: null,
      toState: "rascunho",
      actorId: ppiUser?.id,
      actorRole: ppiUser?.role ?? "ppi",
      reason: "Abertura de caso pela equipe escolar",
    });

    if (s.targetState === "rascunho") continue;

    // Transição para enviado_re
    await db.insert(reAssessments).values({
      tenantId,
      caseId: c.id,
      formCode: "FOGAP",
      formVersion: "1.0",
      status: "enviado",
      payload: { queixas: ["Escrita", "Falta de atenção"], observacoes: s.description },
      createdBy: ppiUser?.id ?? c.id,
      submittedBy: ppiUser?.id ?? c.id,
      submittedAt: new Date(),
    });
    await db.insert(caseTimeline).values({
      tenantId,
      caseId: c.id,
      event: "case:assessment_submitted",
      payload: { actorRole: "ppi", actorId: ppiUser?.id },
    });
    await db.insert(caseTransitions).values({
      tenantId,
      caseId: c.id,
      fromState: "rascunho",
      toState: "enviado_re",
      actorId: ppiUser?.id,
      actorRole: ppiUser?.role ?? "ppi",
      reason: "Envio de avaliação pedagógica FOGAP",
    });

    if (s.targetState === "enviado_re") continue;

    // Transição para revisao_medica
    await db.insert(caseTimeline).values({
      tenantId,
      caseId: c.id,
      event: "case:medical_review_started",
      payload: { actorRole: "md1", actorId: mdUser?.id },
    });
    await db.insert(caseTransitions).values({
      tenantId,
      caseId: c.id,
      fromState: "enviado_re",
      toState: "revisao_medica",
      actorId: mdUser?.id,
      actorRole: mdUser?.role ?? "md1",
      reason: "Início da triagem médica",
    });

    if (s.targetState === "revisao_medica") continue;

    // Transição para delegado
    await db.insert(caseSummaries).values({
      tenantId,
      schoolId: school.id,
      caseId: c.id,
      specialty: "fonoaudiologia",
      assignedProfessionalId: fonoUser?.id,
      status: s.targetState === "delegado" ? "em_andamento" : "concluido",
      summary: s.targetState === "delegado" ? null : { parecer: "Avaliação fonoaudiológica realizada com exercícios respiratórios indicados." },
      completedAt: s.targetState === "delegado" ? null : new Date(),
    });
    await db.insert(caseTimeline).values({
      tenantId,
      caseId: c.id,
      event: "case:delegated",
      payload: { actorRole: "md1", specialty: "fonoaudiologia" },
    });
    await db.insert(caseTransitions).values({
      tenantId,
      caseId: c.id,
      fromState: "revisao_medica",
      toState: "delegado",
      actorId: mdUser?.id,
      actorRole: mdUser?.role ?? "md1",
      reason: "Encaminhamento multiprofissional para fonoaudiologia",
    });

    if (s.targetState === "delegado") continue;

    // Transição para retornado
    await db.insert(caseTimeline).values({
      tenantId,
      caseId: c.id,
      event: "case:returned_to_doctor",
      payload: { actorRole: "specialist", specialty: "fonoaudiologia" },
    });
    await db.insert(caseTransitions).values({
      tenantId,
      caseId: c.id,
      fromState: "delegado",
      toState: "retornado",
      actorId: fonoUser?.id,
      actorRole: fonoUser?.role ?? "specialist",
      reason: "Parecer da fonoaudiologia anexado",
    });

    if (s.targetState === "retornado") continue;

    // Transição para encerrado
    await db.insert(caseTimeline).values({
      tenantId,
      caseId: c.id,
      event: "case:closed",
      payload: { actorRole: "md1", conclusion: "Conduta médica e plano escolar acordados" },
    });
    await db.insert(caseTransitions).values({
      tenantId,
      caseId: c.id,
      fromState: "retornado",
      toState: "encerrado",
      actorId: mdUser?.id,
      actorRole: mdUser?.role ?? "md1",
      reason: "Devolutiva à escola concluída e caso finalizado",
    });
  }

  console.log(`Sucesso: 6 casos com histórico completo de transições criados para o tenant ${tenantId}.`);
}

main().catch((e) => {
  console.error("Erro ao popular jornada:", e);
  process.exit(1);
});
