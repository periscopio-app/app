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
