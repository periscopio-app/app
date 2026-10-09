import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { auditLogs, populationAggregates, schools } from "@periscopio/shared";
import { requireActor } from "../security/actor";
import { canAccessSchool } from "../security/tenancy";
import {
  SERVICES,
  SERVICE_LABELS,
  CAPACITY_DEFAULTS,
  missingInfo,
  parseCapacity,
  planSchool,
  type AggregatePayload,
} from "../services/population-planning.service";
import { TARUMA_SOURCE, buildTarumaDashboard } from "../services/taruma-dashboard.service";

const READ_ROLES = ["admin_platform", "municipal_manager", "school_manager", "ppi", "board", "researcher", "md1"] as const;
const GEO_ROLES = ["admin_platform", "municipal_manager", "school_manager", "ppi"] as const;

const count = z.number().int().min(0).nullable();
// strict: qualquer campo fora do esperado (ex.: nome, prontuário) derruba a importação.
const payloadSchema = z
  .object({
    total: count,
    ageBands: z.record(count),
    complaints: z.record(count),
    services: z.record(count),
  })
  .strict();
export const importSchema = z
  .object({
    source: z.string().min(3).max(60),
    referenceYear: z.number().int().min(2000).max(2100),
    smallCellThreshold: z.number().optional(),
    total: payloadSchema,
    schools: z
      .array(
        z
          .object({
            schoolCode: z.string().min(1).max(30),
            schoolLabel: z.string().max(120),
          })
          .merge(payloadSchema)
          .strict(),
      )
      .max(500),
    createMissingSchools: z.boolean().optional(),
  })
  .strict();

const geoSchema = z.object({
  address: z.string().max(300).optional(),
  latitude: z.number().min(-34).max(6).nullable().optional(), // limites aproximados do Brasil
  longitude: z.number().min(-74).max(-28).nullable().optional(),
  enrollment: z.number().int().min(1).max(100000).nullable().optional(),
  externalCode: z.string().max(30).optional(),
});

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function populationRoutes(app: FastifyInstance) {
  // ── Mapa de prevalência + profissionais necessários ──────────────────────
  app.get("/api/population/map", async (request, reply) => {
    const actor = await requireActor(request, reply, READ_ROLES);
    if (!actor) return;

    const q = request.query as Record<string, string | undefined>;
    let capRaw: unknown;
    try {
      capRaw = q.capacity ? JSON.parse(q.capacity) : undefined;
    } catch {
      return reply.status(400).send({ error: "Parâmetro de capacidade inválido" });
    }
    const capacity = parseCapacity(capRaw);

    const allSchools = await db.select().from(schools).where(eq(schools.tenantId, actor.tenantId));
    const visible = allSchools.filter((s) => canAccessSchool(actor, s.tenantId, s.id));
    const aggs = await db.select().from(populationAggregates).where(eq(populationAggregates.tenantId, actor.tenantId));
    const total = aggs.find((a) => a.schoolCode === "TOTAL") ?? null;
    const perSchool = aggs.filter((a) => a.schoolCode !== "TOTAL");

    const matched = new Set<string>();
    const points = visible.map((s) => {
      const agg = perSchool.find(
        (a) =>
          (s.externalCode && norm(s.externalCode) === norm(a.schoolCode)) ||
          norm(s.name) === norm(a.schoolLabel ?? "") ||
          norm(s.name) === norm(`escola ${a.schoolLabel ?? ""}`),
      );
      if (agg) matched.add(agg.id);
      const payload = (agg?.payload ?? null) as AggregatePayload | null;
      return {
        schoolId: s.id,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        enrollment: s.enrollment,
        externalCode: s.externalCode,
        planning: payload ? planSchool(payload, s.enrollment, capacity) : null,
        ageBands: payload?.ageBands ?? null,
        complaints: payload?.complaints ?? null,
        services: payload?.services ?? null,
        semInformacao: missingInfo({
          latitude: s.latitude,
          longitude: s.longitude,
          enrollment: s.enrollment,
          hasAggregate: !!agg,
        }),
      };
    });

    // Só quem enxerga o município inteiro vê dados ainda não vinculados a uma escola cadastrada.
    const wholeNetwork = actor.role === "admin_platform" || !actor.schoolId;
    const unlinked = wholeNetwork
      ? perSchool
          .filter((a) => !matched.has(a.id))
          .map((a) => {
            const payload = a.payload as AggregatePayload;
            return {
              schoolCode: a.schoolCode,
              schoolLabel: a.schoolLabel,
              planning: planSchool(payload, null, capacity),
              ageBands: payload.ageBands,
              services: payload.services,
            };
          })
      : [];

    const totalPayload = total ? (total.payload as AggregatePayload) : null;
    return {
      source: total?.source ?? perSchool[0]?.source ?? null,
      referenceYear: total?.referenceYear ?? perSchool[0]?.referenceYear ?? null,
      capacity,
      capacityIsPlaceholder: true,
      serviceLabels: SERVICE_LABELS,
      services: SERVICES,
      network: wholeNetwork && totalPayload ? { ...totalPayload, planning: planSchool(totalPayload, null, capacity) } : null,
      schools: points,
      unlinked,
      notice:
        "Números agregados de casos registrados. Células com menos de 5 casos são ocultadas. Não são diagnósticos e não indicam risco individual.",
    };
  });

  // ── Painel exclusivo de Tarumã: KPIs e gráficos prontos, só com agregados ─
  app.get("/api/population/taruma", async (request, reply) => {
    const actor = await requireActor(request, reply, READ_ROLES);
    if (!actor) return;

    const q = request.query as Record<string, string | undefined>;
    let capRaw: unknown;
    try {
      capRaw = q.capacity ? JSON.parse(q.capacity) : undefined;
    } catch {
      return reply.status(400).send({ error: "Parâmetro de capacidade inválido" });
    }
    const capacity = parseCapacity(capRaw);

    const rows = await db.select().from(populationAggregates).where(eq(populationAggregates.source, TARUMA_SOURCE));
    // Usuário do próprio município enxerga o dele; a administração da plataforma ou visualização demo enxergam Tarumã.
    const isDemo = q.slug === "demo-escola" || q.slug === "taruma" || q.demo === "true";
    let tenantId = rows.find((r) => r.tenantId === actor.tenantId)?.tenantId;
    if (!tenantId && (actor.role === "admin_platform" || isDemo)) {
      tenantId = rows[0]?.tenantId;
    }
    if (!tenantId) {
      const emptyBase: AggregatePayload = {
        total: 0,
        ageBands: { "3-5": 0, "6-9": 0, "10-12": 0, "13-17": 0, "18+": 0 },
        complaints: {},
        services: { fonoaudiologia: 0, psicopedagogia: 0, psicoterapia: 0, psicomotricidade: 0, neuropsicologia: 0, assistencia_social: 0, consulta_medica: 0 },
      };
      const emptyDashboard = buildTarumaDashboard(emptyBase, [], capacity, "municipio");
      return reply.send({
        municipality: "Município sem dados populacionais",
        source: null,
        center: { latitude: -22.7467, longitude: -50.5811 },
        referenceYear: 2024,
        capacity,
        serviceLabels: SERVICE_LABELS,
        services: SERVICES,
        dashboard: emptyDashboard,
        schools: [],
        notice: "Nenhum dado populacional foi cadastrado para este município ainda. Para conhecer a ferramenta com dados reais, acesse a demonstração municipal de Tarumã.",
      });
    }

    const aggs = rows.filter((r) => r.tenantId === tenantId);
    const allSchools = await db.select().from(schools).where(eq(schools.tenantId, tenantId));
    const visible = allSchools.filter((s) => canAccessSchool(actor, s.tenantId, s.id));
    const wholeNetwork = actor.role === "admin_platform" || !actor.schoolId;

    const perSchool = aggs.filter((a) => a.schoolCode !== "TOTAL");
    const totalRow = aggs.find((a) => a.schoolCode === "TOTAL") ?? null;
    const matchOf = (s: (typeof allSchools)[number]) =>
      perSchool.find(
        (a) =>
          (s.externalCode && norm(s.externalCode) === norm(a.schoolCode)) ||
          norm(s.name) === norm(a.schoolLabel ?? "") ||
          norm(s.name) === norm(`escola ${a.schoolLabel ?? ""}`),
      );

    const points = visible.map((s) => {
      const agg = matchOf(s);
      const payload = (agg?.payload ?? null) as AggregatePayload | null;
      return {
        schoolId: s.id,
        name: s.name,
        label: agg?.schoolLabel ?? s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        enrollment: s.enrollment,
        externalCode: s.externalCode,
        planning: payload ? planSchool(payload, s.enrollment, capacity) : null,
        ageBands: payload?.ageBands ?? null,
        complaints: payload?.complaints ?? null,
        services: payload?.services ?? null,
        semInformacao: missingInfo({ latitude: s.latitude, longitude: s.longitude, enrollment: s.enrollment, hasAggregate: !!agg }),
      };
    });

    let dashboard;
    if (wholeNetwork && totalRow) {
      dashboard = buildTarumaDashboard(
        totalRow.payload as AggregatePayload,
        perSchool.map((a) => ({ code: a.schoolCode, label: a.schoolLabel ?? a.schoolCode, payload: a.payload as AggregatePayload })),
        capacity,
        "municipio",
      );
    } else {
      // Escola isolada: o painel usa só o agregado da escola vinculada ao usuário.
      const own = visible.map(matchOf).find(Boolean);
      if (!own) return reply.status(404).send({ error: "Sua escola não tem dados na base de Tarumã." });
      dashboard = buildTarumaDashboard(
        own.payload as AggregatePayload,
        [{ code: own.schoolCode, label: own.schoolLabel ?? own.schoolCode, payload: own.payload as AggregatePayload }],
        capacity,
        "escola",
      );
    }

    if (tenantId !== actor.tenantId) {
      await db.insert(auditLogs).values({
        tenantId: actor.tenantId, actorId: actor.id, action: "population:taruma_view", entity: "population_aggregates",
        metadata: { role: actor.role, source: TARUMA_SOURCE },
      });
    }

    return {
      municipality: "Tarumã",
      // Referência do município (centro aproximado), não é a localização de escola alguma.
      center: { latitude: -22.7467, longitude: -50.5811 },
      source: TARUMA_SOURCE,
      referenceYear: totalRow?.referenceYear ?? perSchool[0]?.referenceYear ?? null,
      capacity,
      capacityIsPlaceholder: true,
      serviceLabels: SERVICE_LABELS,
      services: SERVICES,
      dashboard,
      schools: points,
      notice: dashboard.notes[0],
    };
  });

  // ── Cadastro de localização/matrícula (gestor ou RE da escola) ───────────
  app.put("/api/schools/:schoolId/geo", async (request, reply) => {
    const actor = await requireActor(request, reply, GEO_ROLES);
    if (!actor) return;
    const { schoolId } = request.params as { schoolId: string };
    const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
    if (!school || !canAccessSchool(actor, school.tenantId, school.id)) {
      return reply.status(404).send({ error: "Escola não encontrada" });
    }
    const parse = geoSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ error: "Dados inválidos", issues: parse.error.issues });
    const d = parse.data;
    if ((d.latitude == null) !== (d.longitude == null) && (d.latitude !== undefined || d.longitude !== undefined)) {
      return reply.status(400).send({ error: "Informe latitude e longitude juntas" });
    }
    const [updated] = await db
      .update(schools)
      .set({
        ...(d.address !== undefined && { address: d.address || null }),
        ...(d.latitude !== undefined && { latitude: d.latitude }),
        ...(d.longitude !== undefined && { longitude: d.longitude }),
        ...(d.enrollment !== undefined && { enrollment: d.enrollment }),
        ...(d.externalCode !== undefined && { externalCode: d.externalCode || null }),
      })
      .where(eq(schools.id, school.id))
      .returning();
    await db.insert(auditLogs).values({
      tenantId: actor.tenantId, actorId: actor.id, action: "school:geo_update", entity: "school", entityId: school.id,
    });
    return { success: true, school: updated };
  });

  // Geocodificação pelo endereço cadastrado (Mapbox). Falha com mensagem clara se o token não existir.
  app.post("/api/schools/:schoolId/geocode", async (request, reply) => {
    const actor = await requireActor(request, reply, GEO_ROLES);
    if (!actor) return;
    const { schoolId } = request.params as { schoolId: string };
    const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
    if (!school || !canAccessSchool(actor, school.tenantId, school.id)) {
      return reply.status(404).send({ error: "Escola não encontrada" });
    }
    const token = process.env.MAPBOX_TOKEN;
    if (!token) return reply.status(503).send({ error: "Mapbox não configurado (MAPBOX_TOKEN ausente)" });
    if (!school.address) return reply.status(400).send({ error: "Cadastre o endereço da escola primeiro" });
    try {
      const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(school.address)}&country=br&limit=1&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok) return reply.status(502).send({ error: "Falha ao consultar o Mapbox" });
      const data = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
      const c = data.features?.[0]?.geometry?.coordinates;
      if (!c) return reply.status(404).send({ error: "Endereço não encontrado no mapa" });
      const [updated] = await db
        .update(schools)
        .set({ longitude: c[0], latitude: c[1] })
        .where(eq(schools.id, school.id))
        .returning();
      return { success: true, school: updated };
    } catch {
      return reply.status(502).send({ error: "Falha ao consultar o Mapbox" });
    }
  });

  // ── Importação de agregados (admin da plataforma) ─────────────────────────
  app.post("/api/population/import", { bodyLimit: 2 * 1024 * 1024 }, async (request, reply) => {
    const actor = await requireActor(request, reply, ["admin_platform"]);
    if (!actor) return;
    const parse = importSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: "Arquivo fora do formato de agregados (campos individuais não são aceitos)", issues: parse.error.issues.slice(0, 5) });
    }
    const { source, referenceYear, total, schools: rows, createMissingSchools } = parse.data;

    await db.transaction(async (tx) => {
      const all = [{ schoolCode: "TOTAL", schoolLabel: "Município", ...total }, ...rows];
      for (const r of all) {
        const { schoolCode, schoolLabel, ...payload } = r;
        await tx
          .insert(populationAggregates)
          .values({ tenantId: actor.tenantId, source, referenceYear, schoolCode, schoolLabel, payload })
          .onConflictDoUpdate({
            target: [populationAggregates.tenantId, populationAggregates.source, populationAggregates.schoolCode],
            set: { referenceYear, schoolLabel, payload },
          });
      }
      if (createMissingSchools) {
        const existing = await tx.select().from(schools).where(eq(schools.tenantId, actor.tenantId));
        for (const r of rows) {
          if (r.schoolCode === "0") continue; // "Não se aplica" não é escola
          const has = existing.some(
            (s) => (s.externalCode && norm(s.externalCode) === norm(r.schoolCode)) || norm(s.name) === norm(`escola ${r.schoolLabel}`),
          );
          if (has) continue;
          const slug = `${norm(source).replace(/ /g, "-").slice(0, 20)}-${norm(r.schoolLabel).replace(/ /g, "-")}`;
          await tx
            .insert(schools)
            .values({ tenantId: actor.tenantId, name: `Escola ${r.schoolLabel}`, slug, status: "active", externalCode: r.schoolCode })
            .onConflictDoNothing();
        }
      }
      await tx.insert(auditLogs).values({
        tenantId: actor.tenantId, actorId: actor.id, action: "population:import", entity: "population_aggregates", metadata: { source, referenceYear, schools: rows.length },
      });
    });
    return reply.status(201).send({ success: true, imported: rows.length + 1 });
  });
}

export { CAPACITY_DEFAULTS };
