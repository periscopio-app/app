try {
  process.loadEnvFile("../../.env");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health";
import { triagemRoutes } from "./routes/triagem.routes";
import { authRoutes } from "./routes/auth.routes";
import { onboardingRoutes } from "./routes/onboarding.routes";
import { casesRoutes } from "./routes/cases.routes";
import { leadsRoutes } from "./routes/leads.routes";

const app = Fastify({ logger: true });

// CORS configurado para Vercel, Cloudflare e ambiente local
await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.register(healthRoutes);
app.register(triagemRoutes);
app.register(authRoutes);
app.register(onboardingRoutes);
app.register(casesRoutes);
app.register(leadsRoutes);

const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
