/**
 * Fixture de teste: libera Indicadores do piloto, BI e Mapa para os perfis de gestão que os testes de escopo usam.
 * Desde 07/nov/2026 o PADRÃO dessas três capacidades é só o Administrador Master; a liberação a outros perfis
 * é feita pelo admin na tela de privilégios, o que este fixture reproduz. Os testes de "padrão negado" não chamam isto.
 */
import { privilegeRoleGrants } from "@periscopio/shared";

const CAPACIDADES_DE_GESTAO = ["pilot.indicators.view", "bi.view", "population.view"] as const;

export async function liberarGestaoParaTeste(
  db: { insert: (t: typeof privilegeRoleGrants) => any },
  roles: readonly string[]
): Promise<void> {
  const values = roles.flatMap((role) => CAPACIDADES_DE_GESTAO.map((capability) => ({ role, capability, allowed: true })));
  await db.insert(privilegeRoleGrants).values(values).onConflictDoNothing();
}
