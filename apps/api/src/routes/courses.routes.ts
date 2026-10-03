import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { courses, lessons, enrollments } from "@periscopio/shared";
import { requireActor } from "../security/actor";

export async function coursesRoutes(app: FastifyInstance) {
  // Listar catálogo de cursos disponíveis no LMS Periscópio
  app.get("/api/courses", async (_request, reply) => {
    const list = await db.select().from(courses);
    return reply.send({
      total: list.length,
      courses: list.length > 0 ? list : [
        {
          id: "course-01",
          title: "Sinais Precoces de Saúde Mental na Infância e Adolescência",
          description: "Capacitação prática para professores e pedagogos identificarem sinais de alerta sem diagnosticar.",
        },
        {
          id: "course-02",
          title: "Aplicação e Leitura do Protocolo SNAP-IV e M-CHAT",
          description: "Guia passo a passo para aplicação de escalas padronizadas de rastreamento escolar.",
        },
        {
          id: "course-03",
          title: "Prontuário Seguro & LGPD na Gestão Escolar",
          description: "Boas práticas para pseudonimização, guarda de histórico e sigilo no ambiente escolar.",
        },
      ],
    });
  });

  // Obter detalhes de um curso e suas aulas
  app.get("/api/courses/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);

    const courseLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, id));

    return reply.send({
      course: course || {
        id,
        title: "Sinais Precoces de Saúde Mental na Infância e Adolescência",
        description: "Capacitação prática para professores e pedagogos identificarem sinais de alerta sem diagnosticar.",
      },
      lessons: courseLessons.length > 0 ? courseLessons : [
        { id: "les-01", courseId: id, title: "Módulo 1: O Papel da Escola na Observação de Sinais", order: 1, contentUrl: "#" },
        { id: "les-02", courseId: id, title: "Módulo 2: Diferença entre Comportamento Esperado e Sinal de Alerta", order: 2, contentUrl: "#" },
        { id: "les-03", courseId: id, title: "Módulo 3: Encaminhamento Ético e Relação com a Família", order: 3, contentUrl: "#" },
      ],
    });
  });

  // Matrícula / Progresso do usuário no curso
  app.post("/api/courses/:id/enroll", async (request, reply) => {
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const { id } = request.params as { id: string };

    const [enrollment] = await db
      .insert(enrollments)
      .values({
        tenantId: actor.tenantId,
        userId: actor.id,
        courseId: id,
        progress: 0,
      })
      .returning();

    return reply.status(201).send({
      success: true,
      enrollment: enrollment || {
        id: "mock-enrollment",
        tenantId: actor.tenantId,
        userId: actor.id,
        courseId: id,
        progress: 0,
      },
    });
  });
}
