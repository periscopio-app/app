import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@periscopio/shared";
try {
  process.loadEnvFile("../../.env");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl:
    connectionString?.includes("sslmode=require") ||
    connectionString?.includes("neon.tech") ||
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

export const db = drizzle(pool, { schema });
