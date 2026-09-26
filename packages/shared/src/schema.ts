import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  boolean,
  integer,
  date,
} from "drizzle-orm/pg-core";

/**
 * Núcleo multi-tenant. Toda tabela de domínio carrega tenant_id (RLS no Postgres).
 * Ver "Periscópio Saúde — Hub do Produto v2.0" no Notion para o modelo completo.
 */

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  municipalityCode: varchar("municipality_code", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 80 }).unique(),
  cnpj: varchar("cnpj", { length: 20 }),
  responsavelNome: text("responsavel_nome"),
  responsavelEmail: varchar("responsavel_email", { length: 255 }),
  responsavelTelefone: varchar("responsavel_telefone", { length: 30 }),
  status: varchar("status", { length: 30 }).default("pending_onboarding"),
  branding: jsonb("branding"), // { logoUrl, primaryColor, theme }
  isControlGroup: boolean("is_control_group").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  schoolId: uuid("school_id").references(() => schools.id),
  name: text("name").notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  schoolId: uuid("school_id").references(() => schools.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 30 }),
  cpf: varchar("cpf", { length: 20 }),
  classCode: varchar("class_code", { length: 50 }), // Conselho de classe: CRM, CRP, etc.
  specialty: varchar("specialty", { length: 50 }), // psicopedagogia | medicina | fonoaudiologia | psicologia | psicomotricidade | servico_social
  role: varchar("role", { length: 40 }).notNull(),
  // admin_platform | municipal_manager | school_manager | teacher | ppi | md1 | board | researcher | specialist
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Pseudonimizado — nunca guardar nome direto do aluno aqui. */
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  schoolId: uuid("school_id").notNull().references(() => schools.id),
  studentCode: varchar("student_code", { length: 64 }).notNull().unique(),
  birthYear: integer("birth_year"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teacherObservations = pgTable("teacher_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  studentId: uuid("student_id").notNull().references(() => students.id),
  teacherId: uuid("teacher_id").notNull().references(() => users.id),
  kind: varchar("kind", { length: 20 }).notNull(), // flash | full
  domain: varchar("domain", { length: 20 }), // social | crisis | neuro | mental_learning
  payload: jsonb("payload").notNull(),
  marcosDesenvolvimento: jsonb("marcos_desenvolvimento"),
  statusCalculado: varchar("status_calculado", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const psychAssessments = pgTable("psych_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  studentId: uuid("student_id").notNull().references(() => students.id),
  assessorId: uuid("assessor_id").notNull().references(() => users.id),
  stage: varchar("stage", { length: 10 }).notNull(), // ppi | md1
  riskLevel: varchar("risk_level", { length: 10 }),
  cid10: varchar("cid10", { length: 10 }),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  studentId: uuid("student_id").notNull().references(() => students.id),
  status: varchar("status", { length: 30 }).notNull(),
  // triagem | sisreg | investigacao | reabilitacao
  assignedToId: uuid("assigned_to_id").references(() => users.id),
  dataInicioIntervencao: date("data_inicio_intervencao"),
  slaDueAt: timestamp("sla_due_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Histórico imutável — apenas insert, nunca update/delete. */
export const caseTimeline = pgTable("case_timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  actorId: uuid("actor_id").references(() => users.id),
  event: varchar("event", { length: 60 }).notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Sub-registros de escalas clínicas: M-CHAT, FOGAP, SRQ-20. */
export const evaluations = pgTable("evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  studentId: uuid("student_id").notNull().references(() => students.id),
  scale: varchar("scale", { length: 20 }).notNull(), // mchat | fogap | srq20
  score: integer("score"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const boardSupervision = pgTable("board_supervision", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  reviewerId: uuid("reviewer_id").notNull().references(() => users.id),
  opinion: text("opinion"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
});

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").notNull().references(() => courses.id),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
  contentUrl: text("content_url"),
});

export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  courseId: uuid("course_id").notNull().references(() => courses.id),
  progress: integer("progress").default(0).notNull(),
  completedAt: timestamp("completed_at"),
});

/** LGPD — retenção mínima de 5 anos. */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 60 }).notNull(),
  entity: varchar("entity", { length: 60 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Captação de interesse no piloto — landing page. */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  escola: text("escola").notNull(),
  cargo: varchar("cargo", { length: 60 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** DSAR — pedidos de titular sob a LGPD. */
export const lgpdRequests = pgTable("lgpd_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  requesterEmail: varchar("requester_email", { length: 255 }).notNull(),
  kind: varchar("kind", { length: 30 }).notNull(), // access | deletion | correction
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

/** Magic Links para onboarding da escola e profissionais. */
export const onboardingInvites = pgTable("onboarding_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  schoolId: uuid("school_id").notNull().references(() => schools.id),
  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 120 }).notNull().unique(),
  type: varchar("type", { length: 30 }).notNull(), // school_manager | professional
  role: varchar("role", { length: 40 }),
  specialty: varchar("specialty", { length: 50 }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Seções do Prontuário Multidisciplinar delegadas por especialidade.
 * Cada especialista acessa e sumariza apenas a sua especialidade.
 */
export const caseSummaries = pgTable("case_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  schoolId: uuid("school_id").references(() => schools.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  specialty: varchar("specialty", { length: 50 }).notNull(),
  // fonoaudiologia | medicina | psicologia | psicopedagogia | psicomotricidade | servico_social
  assignedProfessionalId: uuid("assigned_professional_id").references(() => users.id),
  status: varchar("status", { length: 30 }).default("pendente").notNull(),
  // pendente | em_andamento | concluido
  summary: jsonb("summary"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

