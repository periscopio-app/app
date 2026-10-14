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
  uniqueIndex,
  doublePrecision,
  real,
  smallint,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  externalCode: varchar("external_code", { length: 30 }), // sigla usada na base populacional importada
  address: text("address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  enrollment: integer("enrollment"), // alunos matriculados (denominador da prevalência)
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
  // Só vira true quando o profissional confirma o e-mail do convite enviado pela escola.
  accessEnabled: boolean("access_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Vínculos explícitos entre usuários, escolas e papéis no escopo. */
export const userSchoolAssignments = pgTable("user_school_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  schoolId: uuid("school_id").notNull().references(() => schools.id),
  role: varchar("role", { length: 40 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Pseudonimizado — nunca guardar nome direto do aluno aqui. */
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  schoolId: uuid("school_id").notNull().references(() => schools.id),
  studentCode: varchar("student_code", { length: 64 }).notNull().unique(),
  birthYear: integer("birth_year"),
  birthMonth: integer("birth_month"), // 1–12; null = não informado
  ageBracket: varchar("age_bracket", { length: 20 }), // ex: "04-06", "07-10"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Cofre de Identidade do Aluno — Acesso Estritamente Restrito e Auditado.
 * NUNCA consultado por BI ou perfis administrativos.
 */
export const studentIdentityVault = pgTable("student_identity_vault", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  studentId: uuid("student_id").notNull().references(() => students.id).unique(),
  encryptedFullName: text("encrypted_full_name").notNull(),
  encryptedDocument: text("encrypted_document"),
  encryptedContact: text("encrypted_contact"),
  lastAccessReason: text("last_access_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  // triagem | sisreg | investigacao | reabilitacao (legado, mantido por compatibilidade)
  journeyState: varchar("journey_state", { length: 30 }).notNull().default("rascunho"),
  // rascunho | enviado_re | revisao_medica | delegado | retornado | encerrado
  assignedToId: uuid("assigned_to_id").references(() => users.id),
  dataInicioIntervencao: date("data_inicio_intervencao"),
  slaDueAt: timestamp("sla_due_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Histórico imutável — apenas insert, nunca update/delete. Rastreável por eventId UUID. */
export const caseTimeline = pgTable("case_timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").defaultRandom().notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  actorId: uuid("actor_id").references(() => users.id),
  event: varchar("event", { length: 60 }).notNull(),
  version: integer("version").default(1).notNull(),
  previousVersionId: uuid("previous_version_id"),
  correlationId: varchar("correlation_id", { length: 120 }),
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

/** LGPD e Trilha de Auditoria Imutável (Retenção mínima de 5 anos). */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").defaultRandom().notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  actorId: uuid("actor_id").references(() => users.id),
  userEmail: varchar("user_email", { length: 255 }),
  action: varchar("action", { length: 80 }).notNull(),
  entity: varchar("entity", { length: 60 }).notNull(),
  entityId: uuid("entity_id"),
  correlationId: varchar("correlation_id", { length: 120 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  durationMs: integer("duration_ms"),
  payload: jsonb("payload"),
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
  rede: varchar("rede", { length: 30 }).notNull().default("privada"),
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
 * Histórico de transições de estado do caso — append-only.
 * Toda mudança de journeyState deve passar por esta tabela na mesma transação.
 */
export const caseTransitions = pgTable("case_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  fromState: varchar("from_state", { length: 30 }),
  toState: varchar("to_state", { length: 30 }).notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  actorRole: varchar("actor_role", { length: 40 }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Avaliação do RE (FOGAP + avaliação institucional).
 * Após status = 'enviado', o payload é imutável (trigger no banco).
 * Reabertura só por devolução formal do médico (status → 'devolvido').
 */
export const reAssessments = pgTable("re_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  formCode: varchar("form_code", { length: 60 }).notNull(),
  formVersion: varchar("form_version", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("rascunho"),
  // rascunho | enviado | devolvido
  payload: jsonb("payload").notNull().default({}),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  submittedBy: uuid("submitted_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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


/**
 * Central de notificações in-app.
 * Toast é aviso transitório; persistente fica até leitura.
 * Sem e-mail, push ou WhatsApp por padrão (fora do Anexo I, item 9.1 iv).
 * event_id garante idempotência: mesmo evento entregue duas vezes gera 1 aviso.
 */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  eventId: text("event_id").notNull(), // idempotency key: e.g. "protocolo.enviado:re_assessment_id:recipient_id"
  eventType: varchar("event_type", { length: 60 }).notNull(),
  recipientId: uuid("recipient_id").notNull().references(() => users.id),
  caseId: uuid("case_id").references(() => cases.id),
  instrument: varchar("instrument", { length: 30 }),
  specialty: varchar("specialty", { length: 50 }),
  docType: varchar("doc_type", { length: 80 }),
  studentCode: varchar("student_code", { length: 64 }),
  transient: boolean("transient").default(false).notNull(),
  readAt: timestamp("read_at"),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("notifications_event_id_unique").on(t.eventId),
]);

/**
 * Agenda do Board de experts: horários liberados pela coordenação científica (papel `board`),
 * pedidos de reunião feitos pela escola e configuração da sala fixa (Google Meet).
 */
export const expertBoardSettings = pgTable("expert_board_settings", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id),
  meetUrl: text("meet_url"), // sala fixa, mesma URL em todas as reuniões
  notifyEmail: varchar("notify_email", { length: 255 }),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expertSlots = pgTable("expert_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 20 }).default("available").notNull(), // available | booked | cancelled
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("expert_slots_tenant_start_unique").on(t.tenantId, t.startsAt),
]);

export const expertMeetingRequests = pgTable("expert_meeting_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  schoolId: uuid("school_id").references(() => schools.id),
  slotId: uuid("slot_id").notNull().references(() => expertSlots.id),
  requesterId: uuid("requester_id").notNull().references(() => users.id),
  professionalName: text("professional_name").notNull(),
  topic: text("topic").notNull(), // breve descrição do problema; sem dados identificáveis do aluno
  studentCode: varchar("student_code", { length: 64 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending | confirmed | declined | cancelled
  meetUrl: text("meet_url"), // preenchido na confirmação
  decisionNote: text("decision_note"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("expert_meeting_requests_active_slot_unique")
    .on(t.slotId)
    .where(sql`${t.status} in ('pending','confirmed')`),
]);


/** Agregados populacionais por escola (ex.: base do Tarumã). Nunca contém dado individual. */
export const populationAggregates = pgTable("population_aggregates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  source: varchar("source", { length: 60 }).notNull(),
  referenceYear: integer("reference_year").notNull(),
  schoolCode: varchar("school_code", { length: 30 }).notNull(), // "TOTAL" = município inteiro
  schoolLabel: varchar("school_label", { length: 120 }),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("population_aggregates_unique").on(t.tenantId, t.source, t.schoolCode),
]);

/**
 * ── Base individual legada (ex.: planilha NEMT de Tarumã) ───────────────────────────────
 * Dado de saúde de crianças. Regras do desenho:
 *  - O nome da criança NUNCA entra: vira `legacy_patients.id` (UUID derivado por HMAC com segredo guardado fora do banco).
 *  - O endereço NUNCA entra: vira latitude/longitude em `legacy_patient_locations` (só a coordenada e a qualidade).
 *  - `legacy_import_rows.data` guarda, sem perda, cada coluna da planilha (menos nome e endereço), por linha.
 *  - Nenhuma rota da API lê estas tabelas (há teste que garante). Acesso só por quem a controladora autorizar.
 */
export const legacyImportBatches = pgTable("legacy_import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  source: varchar("source", { length: 60 }).notNull(),
  referenceYear: integer("reference_year").notNull(),
  fileSha256: varchar("file_sha256", { length: 64 }).notNull(), // da planilha original (prova de qual arquivo foi migrado)
  mappingSha256: varchar("mapping_sha256", { length: 64 }).notNull(),
  rowCount: integer("row_count").notNull(),
  columns: jsonb("columns").notNull(), // só os NOMES das colunas da planilha
  transformedColumns: jsonb("transformed_columns").notNull(), // colunas que viraram UUID/coordenada e não entram em claro
  columnNonNull: jsonb("column_non_null").notNull(), // por coluna: células preenchidas na planilha (base da conferência)
  geocoder: varchar("geocoder", { length: 40 }),
  legalBasis: text("legal_basis").notNull(),
  authorizedBy: text("authorized_by").notNull(),
  authorizationRef: text("authorization_ref"),
  status: varchar("status", { length: 20 }).default("applied").notNull(), // applied | replaced
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("legacy_import_batches_file_unique").on(t.tenantId, t.source, t.fileSha256),
]);

/** Dicionário de variáveis da planilha (aba "Variáveis"): decodifica os códigos da camada bruta. Não contém dado de paciente. */
export const legacyVariableDictionary = pgTable("legacy_variable_dictionary", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => legacyImportBatches.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  position: integer("position").notNull(), // nº da linha na aba do dicionário
  sheetColumn: varchar("sheet_column", { length: 10 }),
  variable: varchar("variable", { length: 160 }), // nome da variável vigente (herdado nas linhas de valores)
  columnName: varchar("column_name", { length: 160 }),
  description: text("description"),
  value: varchar("value", { length: 160 }),
  label: text("label"),
}, (t) => [
  uniqueIndex("legacy_variable_dictionary_pos").on(t.batchId, t.position),
  index("legacy_variable_dictionary_var").on(t.batchId, t.variable),
]);

/** Camada sem perda: uma linha por registro da planilha, cada coluna por nome. */
export const legacyImportRows = pgTable("legacy_import_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => legacyImportBatches.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  sourceRow: integer("source_row").notNull(), // nº da linha na planilha (rastreio)
  patientId: uuid("patient_id").notNull(),
  data: jsonb("data").notNull(),
}, (t) => [
  uniqueIndex("legacy_import_rows_batch_row").on(t.batchId, t.sourceRow),
]);

/** Paciente pseudonimizado: `id` é o UUID que substitui o nome. */
export const legacyPatients = pgTable("legacy_patients", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  batchId: uuid("batch_id").notNull().references(() => legacyImportBatches.id, { onDelete: "cascade" }),
  schoolId: uuid("school_id").references(() => schools.id),
  schoolCode: varchar("school_code", { length: 30 }).notNull(),
  sourceRow: integer("source_row").notNull(),
  recordNumber: varchar("record_number", { length: 60 }), // nº de prontuário da clínica
  birthDate: date("birth_date"),
  currentAge: integer("current_age"), // "ID ATUAL" da planilha
  entryYear: integer("entry_year"), // "ANO" (ingresso)
  guardianRef: uuid("guardian_ref"), // familiar responsável, quando é nome: vira UUID
  guardianRelation: varchar("guardian_relation", { length: 60 }), // quando a coluna é o parentesco (mãe, pai...)
  religion: varchar("religion", { length: 80 }),
  parentsOccupation: text("parents_occupation"),
  economicClass: varchar("economic_class", { length: 60 }),
  extra: jsonb("extra"), // colunas mapeadas como complementares
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("legacy_patients_tenant_school").on(t.tenantId, t.schoolCode),
  index("legacy_patients_tenant_entry_year").on(t.tenantId, t.entryYear),
]);

/** Localização da residência como coordenada (o endereço em texto nunca é guardado). */
export const legacyPatientLocations = pgTable("legacy_patient_locations", {
  patientId: uuid("patient_id").primaryKey().references(() => legacyPatients.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  status: varchar("status", { length: 20 }).notNull(), // ok | low_confidence | not_found | out_of_area | no_address | skipped
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  accuracy: varchar("accuracy", { length: 30 }), // rooftop, parcel, street, locality...
  confidence: varchar("confidence", { length: 20 }), // exact, high, medium, low
  addressKey: varchar("address_key", { length: 64 }), // HMAC do endereço normalizado: agrupa moradores do mesmo endereço sem guardar o texto
  provider: varchar("provider", { length: 40 }),
  permanent: boolean("permanent"),
  geocodedAt: timestamp("geocoded_at", { withTimezone: true }),
});

export const legacyPatientComplaints = pgTable("legacy_patient_complaints", {
  patientId: uuid("patient_id").notNull().references(() => legacyPatients.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  complaint: varchar("complaint", { length: 120 }).notNull(),
}, (t) => [primaryKey({ columns: [t.patientId, t.complaint] })]);

/** Cada coluna de serviço (avaliação, terapia, sessões...) com o valor original. */
export const legacyPatientServices = pgTable("legacy_patient_services", {
  patientId: uuid("patient_id").notNull().references(() => legacyPatients.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  service: varchar("service", { length: 30 }).notNull(), // fonoaudiologia, psicopedagogia, psicoterapia, psicomotricidade, neuropsicologia, assistencia_social, consulta_medica
  sourceColumn: varchar("source_column", { length: 80 }).notNull(),
  valueNum: doublePrecision("value_num"),
  valueText: text("value_text"),
}, (t) => [primaryKey({ columns: [t.patientId, t.sourceColumn] })]);

/** Texto clínico registrado pelos profissionais, um item por linha: hipótese, fármaco, antecedente familiar. */
export const legacyPatientItems = pgTable("legacy_patient_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => legacyPatients.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  kind: varchar("kind", { length: 20 }).notNull(), // hypothesis | medication | family_history
  position: integer("position").notNull(),
  text: text("text").notNull(),
}, (t) => [
  uniqueIndex("legacy_patient_items_unique").on(t.patientId, t.kind, t.position),
]);


/**
 * Perguntas feitas ao BI (linguagem natural → plano de consulta).
 * Guarda apenas a pergunta já higienizada (sem CPF/e-mail/telefone) e o plano. Nunca guarda resultado nem dado de aluno.
 * `approved` = exemplo validado por gestão; só esses alimentam o aprendizado do assistente.
 */
export const biQuestions = pgTable("bi_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: uuid("user_id").references(() => users.id),
  role: varchar("role", { length: 40 }).notNull(),
  question: text("question").notNull(),
  plan: jsonb("plan"),
  source: varchar("source", { length: 20 }).notNull(), // example | llm | rules
  confidence: real("confidence"),
  rating: smallint("rating"), // 1 útil | -1 não útil
  correctedPlan: jsonb("corrected_plan"),
  approved: boolean("approved").default(false).notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Termos de consentimento livre e esclarecido (LGPD / Art. 14 e Art. 7, I).
 */
export const consentTerms = pgTable("consent_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  version: varchar("version", { length: 20 }).notNull(),
  type: varchar("type", { length: 40 }).notNull().default("responsavel_legal"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  active: boolean("active").default(true).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("consent_terms_tenant_ver_type_unique").on(t.tenantId, t.version, t.type),
]);

/**
 * Provas de aceite do consentimento — Imutável e rastreável com hash SHA-256 (LGPD, Art. 8º § 2º).
 */
export const consentAcceptances = pgTable("consent_acceptances", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  termId: uuid("term_id").notNull().references(() => consentTerms.id),
  studentId: uuid("student_id").references(() => students.id),
  caseId: uuid("case_id").references(() => cases.id),
  userId: uuid("user_id").references(() => users.id),
  signerName: text("signer_name").notNull(),
  signerDocument: varchar("signer_document", { length: 20 }),
  signerRole: varchar("signer_role", { length: 40 }).notNull(),
  signerEmail: varchar("signer_email", { length: 255 }),
  signerPhone: varchar("signer_phone", { length: 30 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  evidenceSha256: varchar("evidence_sha256", { length: 64 }).notNull(),
  status: varchar("status", { length: 20 }).default("accepted").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: text("revoked_reason"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Anexos e documentos clínicos vinculados ao prontuário.
 * Armazenamento opaco em bucket S3/Supabase sem PII no path (Task 02B).
 */
export const clinicalAttachments = pgTable("clinical_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  studentId: uuid("student_id").references(() => students.id),
  uploaderId: uuid("uploader_id").notNull().references(() => users.id),
  storageKey: varchar("storage_key", { length: 255 }).notNull().unique(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  category: varchar("category", { length: 50 }).default("relatorio_clinico").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});



/**
 * Privilégios configuráveis pelo Administrador Master.
 * Regra por PERFIL (escopo: rede/tenant, ou global com o UUID zero) e exceção por PESSOA.
 * Ausência de linha = vale o padrão do catálogo em apps/api/src/security/capabilities.ts.
 */
export const GLOBAL_PRIVILEGE_SCOPE = "00000000-0000-0000-0000-000000000000";

export const privilegeRoleGrants = pgTable(
  "privilege_role_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeTenantId: uuid("scope_tenant_id").notNull().default(GLOBAL_PRIVILEGE_SCOPE),
    role: varchar("role", { length: 40 }).notNull(),
    capability: varchar("capability", { length: 80 }).notNull(),
    allowed: boolean("allowed").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ unique: uniqueIndex("privilege_role_grants_unique").on(t.scopeTenantId, t.role, t.capability) })
);

export const privilegeUserGrants = pgTable(
  "privilege_user_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    capability: varchar("capability", { length: 80 }).notNull(),
    allowed: boolean("allowed").notNull(),
    reason: text("reason"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ unique: uniqueIndex("privilege_user_grants_unique").on(t.userId, t.capability) })
);

/**
 * Triagem TEA: um registro por caso e instrumento (ata | asq | mchat | srs2 | abc).
 * Depois de status = 'enviado', as respostas ficam imutáveis (trigger no banco).
 * Não guarda nome, data de nascimento nem documento: o aluno é sempre o código do caso.
 */
export const teaScreenings = pgTable(
  "tea_screenings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").notNull().references(() => cases.id),
    instrument: varchar("instrument", { length: 20 }).notNull(),
    instrumentVersion: varchar("instrument_version", { length: 30 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("rascunho"),
    respondent: varchar("respondent", { length: 30 }),
    appliedOn: date("applied_on"),
    answers: jsonb("answers").notNull().default({}),
    scoring: jsonb("scoring"),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    submittedBy: uuid("submitted_by").references(() => users.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ caseInstrument: uniqueIndex("tea_screenings_case_instrument_unique").on(t.caseId, t.instrument) })
);

/**
 * Medidas de sintomas do indicador 5 do piloto (inicial x reavaliação; escola e núcleo).
 * Só a contagem calculável pela fonte (SNAP-IV itens 1 a 9). Só inserção: a mais recente por
 * (caso, fase, origem) é a que vale; as anteriores ficam como histórico. Sem classificação clínica.
 */
export const symptomMeasurements = pgTable("symptom_measurements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  schoolId: uuid("school_id").notNull().references(() => schools.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  phase: varchar("phase", { length: 15 }).notNull(), // inicial | reavaliacao
  source: varchar("source", { length: 10 }).notNull(), // escola | nucleo
  measure: varchar("measure", { length: 30 }).notNull().default("snap4_itens_1a9"),
  measureVersion: varchar("measure_version", { length: 30 }).notNull(),
  appliedOn: date("applied_on").notNull(),
  answers: jsonb("answers").notNull().default({}),
  markedCount: integer("marked_count").notNull(),
  itemsTotal: integer("items_total").notNull(),
  recordedBy: uuid("recorded_by").notNull().references(() => users.id),
  recordedRole: varchar("recorded_role", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Assinantes da Newsletter & Boletins Científicos e Pedagógicos.
 * Em conformidade com o Art. 8º da LGPD (consentimento e opt-out transparente).
 */
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: text("name"),
  role: varchar("role", { length: 50 }).default("outro"), // professor | especialista | medico | gestor | outro
  status: varchar("status", { length: 20 }).default("ativo").notNull(), // ativo | cancelado
  tenantId: uuid("tenant_id").references(() => tenants.id),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true }).defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
});

/**
 * Edições / Boletins Informativos da Newsletter.
 * Artigos científicos, novidades da plataforma e diretrizes de acolhimento.
 */
export const newsletterIssues = pgTable("newsletter_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  summary: text("summary"),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).default("geral").notNull(), // saude_mental | diretrizes_pedagogicas | plataforma_novidades | artigo_cientifico
  status: varchar("status", { length: 20 }).default("publicado").notNull(), // rascunho | publicado
  sentCount: integer("sent_count").default(0).notNull(),
  authorId: uuid("author_id").references(() => users.id),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Sistema de Suporte, Dúvidas e Diagnóstico de Erros da Plataforma.
 * Permite aos usuários tirar dúvidas ou relatar falhas técnicas com captura de telemetria.
 */
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  userId: uuid("user_id").references(() => users.id),
  userName: text("user_name"),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  userRole: varchar("user_role", { length: 50 }),
  category: varchar("category", { length: 40 }).default("duvida").notNull(), // duvida | erro_sistema | sugestao | urgente
  title: text("title").notNull(),
  description: text("description").notNull(),
  pageUrl: text("page_url"),
  browserInfo: text("browser_info"),
  errorDetails: text("error_details"), // stack trace, logs de erro ou código retornado
  status: varchar("status", { length: 20 }).default("aberto").notNull(), // aberto | em_atendimento | resolvido | fechado
  priority: varchar("priority", { length: 20 }).default("normal").notNull(), // baixa | normal | alta | critica
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

