import "dotenv/config";
try {
  process.loadEnvFile("../../.env");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {}
}

// Load local configuration before importing modules that initialize database/auth clients.
const [{ ensureSchema }, { incr }] = await Promise.all([
  import("./services/schema-guard.service"),
  import("./observability/metrics"),
]);

await ensureSchema().catch((err) => console.error("[schema-guard] falha ao preparar schema:", err));

const [{ buildApp }, { healCredentialAccounts, seedMasterAccounts }] = await Promise.all([
  import("./app"),
  import("./auth/credentials"),
]);

const app = await buildApp();

process.on("unhandledRejection", (reason) => {
  incr("unhandled_rejections");
  app.log.error({ err: reason instanceof Error ? { name: reason.name, message: reason.message, stack: reason.stack } : String(reason) }, "promessa rejeitada sem tratamento");
});
process.on("uncaughtException", (err) => {
  app.log.fatal({ err: { name: err.name, message: err.message, stack: err.stack } }, "exceção não capturada; reiniciando");
  setTimeout(() => process.exit(1), 200).unref();
});
const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .then(async () => {
    await ensureSchema().catch((err) => app.log.error({ err: String(err) }, "falha no schema-guard"));
    try {
      const fixed = await healCredentialAccounts();
      if (fixed > 0) app.log.info({ fixed }, "credenciais de login corrigidas (accountId = id do usuário)");
    } catch (err: any) {
      app.log.error({ err: err?.message ?? String(err) }, "falha ao corrigir credenciais de login");
    }
    try {
      await seedMasterAccounts();
      app.log.info("usuários master sincronizados no banco");
    } catch (err: any) {
      app.log.error({ err: err?.message ?? String(err) }, "falha ao sincronizar usuários master");
    }
    // Envio das métricas ao Grafana Cloud (desligado sem GRAFANA_OTLP_*). Nunca derruba a API.
    try {
      const { startOtlpPush, otlpPushStatus } = await import("./observability/otlp-push");
      startOtlpPush();
      if (otlpPushStatus().enabled) app.log.info("envio de métricas ao Grafana ligado");
    } catch (err: any) {
      app.log.error({ err: err?.message ?? String(err) }, "falha ao ligar o envio de métricas");
    }
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
