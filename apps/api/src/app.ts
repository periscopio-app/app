import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health";
import { triagemRoutes } from "./routes/triagem.routes";
import { authRoutes } from "./routes/auth.routes";
import { onboardingRoutes } from "./routes/onboarding.routes";
import { accessRoutes } from "./routes/access.routes";
import { casesRoutes } from "./routes/cases.routes";
import { leadsRoutes } from "./routes/leads.routes";
import { usersRoutes } from "./routes/users.routes";
import { notionRoutes } from "./routes/notion.routes";
import { evaluationsRoutes } from "./routes/evaluations.routes";
import { coursesRoutes } from "./routes/courses.routes";
import { notificationsRoutes } from "./routes/notifications.routes";
import { expertMeetingsRoutes } from "./routes/expert-meetings.routes";
import { populationRoutes } from "./routes/population.routes";
import { biRoutes } from "./routes/bi.routes";
import { managementRoutes } from "./routes/management.routes";
import { locationsRoutes } from "./routes/locations.routes";

export async function buildApp(opts: { logger?: boolean } = {}) {
const app = Fastify({ logger: opts.logger ?? true, trustProxy: true });
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

await app.register(cors, {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const isAllowed = allowedOrigins.some((pattern) => {
      if (pattern.startsWith("*.")) {
        const domain = pattern.slice(2);
        try {
          const parsed = new URL(origin);
          return parsed.hostname.endsWith(domain) || parsed.hostname === domain;
        } catch {
          return false;
        }
      }
      return false;
    });
    if (isAllowed) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.register(healthRoutes);
app.register(triagemRoutes);
app.register(authRoutes);
app.register(onboardingRoutes);
app.register(accessRoutes);
app.register(casesRoutes);
app.register(leadsRoutes);
app.register(usersRoutes);
app.register(notionRoutes);
app.register(evaluationsRoutes);
app.register(coursesRoutes);
app.register(notificationsRoutes);
app.register(expertMeetingsRoutes);
app.register(populationRoutes);
app.register(biRoutes);
app.register(managementRoutes);
app.register(locationsRoutes);

return app;
}
