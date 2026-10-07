import "dotenv/config";
try {
  process.loadEnvFile("../../.env");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

import { buildApp } from "./app";
import { healCredentialAccounts } from "./auth/credentials";

const app = await buildApp();
const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .then(async () => {
    try {
      const fixed = await healCredentialAccounts();
      if (fixed > 0) app.log.info({ fixed }, "credenciais de login corrigidas (accountId = id do usuário)");
    } catch (err: any) {
      app.log.error({ err: err?.message ?? String(err) }, "falha ao corrigir credenciais de login");
    }
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
