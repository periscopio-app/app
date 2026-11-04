export const DEV_AUTH_SECRET = "dev_only_secret_replace_in_production";
export const MIN_AUTH_SECRET_LENGTH = 32;

type AuthEnv = Record<string, string | undefined>;

/**
 * Fora de development/test o segredo do Better Auth é obrigatório, não pode ser o
 * valor de desenvolvimento e precisa ter ao menos 32 caracteres. Falha no boot.
 * Em development/test devolve o segredo informado ou o valor de desenvolvimento.
 */
export function assertAuthSecret(env: AuthEnv = process.env): string {
  const secret = env.BETTER_AUTH_SECRET || env.AUTH_SECRET;
  const isLocal = env.NODE_ENV === "development" || env.NODE_ENV === "test";

  if (isLocal) {
    if (!secret) {
      console.warn(
        "[auth] BETTER_AUTH_SECRET não definida — usando valor padrão inseguro. Defina a variável antes de qualquer ambiente não-local.",
      );
    }
    return secret ?? DEV_AUTH_SECRET;
  }

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET é obrigatória fora do ambiente de desenvolvimento.");
  }
  if (secret === DEV_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET não pode ser o valor de desenvolvimento.");
  }
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(`BETTER_AUTH_SECRET deve ter ao menos ${MIN_AUTH_SECRET_LENGTH} caracteres.`);
  }
  return secret;
}
