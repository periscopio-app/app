import Fastify from "fastify";
import { healthRoutes } from "./routes/health";

const app = Fastify({ logger: true });

app.register(healthRoutes);

const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
