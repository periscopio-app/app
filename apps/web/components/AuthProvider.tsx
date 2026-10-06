"use client";

/**
 * A sessão vive no Better Auth da API (ver lib/auth-client.ts). O provider do
 * Neon Auth foi removido: ele criava uma sessão paralela que a API não reconhece.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
