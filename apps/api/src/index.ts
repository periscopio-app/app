import Fastify from "fastify";
import { healthRoutes } from "./routes/health";
import { triagemRoutes } from "./routes/triagem.routes";

try {
  process.loadEnvFile("../../.env");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Em produção (ex: Render), as variáveis vêm diretamente de process.env
  }
}

const app = Fastify({ logger: true });

app.register(healthRoutes);
app.register(triagemRoutes);

const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
