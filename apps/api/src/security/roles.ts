export type Role =
  | "admin_platform"
  | "municipal_manager"
  | "school_manager"
  | "teacher"
  | "ppi"
  | "md1"
  | "board"
  | "researcher"
  | "specialist";

const roles: readonly Role[] = [
  "admin_platform",
  "municipal_manager",
  "school_manager",
  "teacher",
  "ppi",
  "md1",
  "board",
  "researcher",
  "specialist",
];

export function isRole(value: string): value is Role {
  return roles.includes(value as Role);
}

export function hasRole(role: Role, allowedRoles: readonly Role[]) {
  return allowedRoles.includes(role);
}

/** Papéis puramente administrativos — Sem acesso a prontuário ou registros clínicos. */
export const ADMINISTRATIVE_ONLY_ROLES: readonly Role[] = [
  "admin_platform",
  "municipal_manager",
  "school_manager",
] as const;

/** Papéis clínicos autorizados a acessar/editar registros clínicos. */
export const CLINICAL_ROLES: readonly Role[] = [
  "teacher",
  "ppi",
  "md1",
  "board",
  "specialist",
] as const;

/** Papéis para triagem e encaminhamento inicial. */
export const TRIAGEM_ROLES: readonly Role[] = [
  "teacher",
  "ppi",
] as const;

/** Papéis de especialista clínico para prontuário multidisciplinar delegado. */
export const SPECIALIST_CLINICAL_ROLES: readonly Role[] = [
  "ppi",
  "md1",
  "board",
  "specialist",
] as const;
