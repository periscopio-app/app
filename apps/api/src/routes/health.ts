import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/health/db", async (request, reply) => {
    try {
      const result = await db.execute(
        sql`SELECT NOW() as current_time, current_database() as database, version() as version`
      );
      return {
        status: "connected",
        database: result.rows[0]?.database,
        currentTime: result.rows[0]?.current_time,
        version: result.rows[0]?.version,
      };
    } catch (error: any) {
      reply.status(500);
      return {
        status: "error",
        message: error.message,
      };
    }
  });
}

