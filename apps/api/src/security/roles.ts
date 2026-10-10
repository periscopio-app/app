export type Role =
  // Gestores
  | "admin_platform"
  | "adm_master"
  | "board"
  | "board_especialistas"
  | "municipal_manager"
  | "gestor_municipal"
  // Escola
  | "school_manager"
  | "diretor"
  | "teacher"
  | "ppi"
  | "re"
  | "responsavel_escolar"
  // Núcleo Assistencial
  | "md1"
  | "medico"
  | "md"
  | "assistente_social"
  | "as"
  | "servico_social"
  | "neuropsicologo"
  | "neuropsicologia"
  | "psicomotricista"
  | "psicomotricidade"
  | "psicoterapeuta"
  | "psicologo"
  | "psicologa"
  | "fonoaudiologo"
  | "fonoaudiologa"
  | "psicologo_familiar"
  | "psicologa_familiar"
  | "psicopedagogo_clinico"
  | "psicopedagoga_clinica"
  | "specialist"
  | "researcher";

const roles: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "board",
  "board_especialistas",
  "municipal_manager",
  "gestor_municipal",
  "school_manager",
  "diretor",
  "teacher",
  "ppi",
  "re",
  "responsavel_escolar",
  "md1",
  "medico",
  "md",
  "assistente_social",
  "as",
  "servico_social",
  "neuropsicologo",
  "neuropsicologia",
  "psicomotricista",
  "psicomotricidade",
  "psicoterapeuta",
  "psicologo",
  "psicologa",
  "fonoaudiologo",
  "fonoaudiologa",
  "psicologo_familiar",
  "psicologa_familiar",
  "psicopedagogo_clinico",
  "psicopedagoga_clinica",
  "specialist",
  "researcher",
];

export function isRole(value: string): value is Role {
  return roles.includes(value as Role);
}

/** Verifica se um e-mail é Super Admin / Gestão Suprema (ex: bruno@oceanoazul.dev.br). */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === "bruno@oceanoazul.dev.br" ||
    normalized.endsWith("@oceanoazul.dev.br")
  );
}

/** Mapeamento de papéis equivalentes para compatibilidade retroativa. */
const ROLE_EQUIVALENTS: Record<string, string[]> = {
  admin_platform: ["admin_platform", "adm_master"],
  adm_master: ["admin_platform", "adm_master"],
  board: ["board", "board_especialistas"],
  board_especialistas: ["board", "board_especialistas"],
  municipal_manager: ["municipal_manager", "gestor_municipal"],
  gestor_municipal: ["municipal_manager", "gestor_municipal"],
  school_manager: ["school_manager", "diretor"],
  diretor: ["school_manager", "diretor"],
  ppi: ["ppi", "re", "responsavel_escolar", "teacher"],
  re: ["ppi", "re", "responsavel_escolar"],
  responsavel_escolar: ["ppi", "re", "responsavel_escolar"],
  teacher: ["teacher", "ppi", "re"],
  md1: ["md1", "medico", "md"],
  medico: ["md1", "medico", "md"],
  md: ["md1", "medico", "md"],
  specialist: [
    "specialist",
    "assistente_social",
    "as",
    "servico_social",
    "neuropsicologo",
    "neuropsicologia",
    "psicomotricista",
    "psicomotricidade",
    "psicoterapeuta",
    "psicologo",
    "psicologa",
    "fonoaudiologo",
    "fonoaudiologa",
    "psicologo_familiar",
    "psicologa_familiar",
    "psicopedagogo_clinico",
    "psicopedagoga_clinica",
  ],
  assistente_social: ["assistente_social", "as", "servico_social", "specialist"],
  as: ["assistente_social", "as", "servico_social", "specialist"],
  servico_social: ["assistente_social", "as", "servico_social", "specialist"],
};

export function hasRole(
  role: Role,
  allowedRoles: readonly (Role | string)[],
  email?: string | null
): boolean {
  // Super Admin com e-mail autorizado possui todas as permissões no sistema (Bypass de homologação/demonstração)
  if (isSuperAdminEmail(email)) return true;

  if (allowedRoles.includes(role)) return true;

  // Checa equivalências de papéis (ex: 're' satisfaz 'ppi', 'medico' satisfaz 'md1')
  const myEquivalents = ROLE_EQUIVALENTS[role] ?? [role];
  for (const allowed of allowedRoles) {
    if (myEquivalents.includes(allowed)) return true;
    const allowedEquivalents = ROLE_EQUIVALENTS[allowed] ?? [allowed];
    if (allowedEquivalents.includes(role)) return true;
  }

  return false;
}

/** Rótulos humanizados para todos os papéis do sistema. */
export const ROLE_HUMAN_LABELS: Record<string, string> = {
  admin_platform: "Administrador Master (ADM)",
  adm_master: "Administrador Master (ADM)",
  board: "Board de Especialistas",
  board_especialistas: "Board de Especialistas",
  municipal_manager: "Gestor(a) Municipal",
  gestor_municipal: "Gestor(a) Municipal",
  school_manager: "Gestor(a) Escolar / Diretor(a)",
  diretor: "Gestor(a) Escolar / Diretor(a)",
  ppi: "Responsável Escolar (RE)",
  re: "Responsável Escolar (RE)",
  responsavel_escolar: "Responsável Escolar (RE)",
  teacher: "Professor(a)",
  md1: "Médico(a) (MD)",
  medico: "Médico(a) (MD)",
  md: "Médico(a) (MD)",
  assistente_social: "Assistente Social (AS)",
  as: "Assistente Social (AS)",
  servico_social: "Assistente Social (AS)",
  neuropsicologo: "Neuropsicólogo(a)",
  neuropsicologia: "Neuropsicólogo(a)",
  psicomotricista: "Psicomotricista",
  psicomotricidade: "Psicomotricista",
  psicoterapeuta: "Psicoterapeuta / Psicólogo(a)",
  psicologo: "Psicólogo(a)",
  psicologa: "Psicóloga",
  fonoaudiologo: "Fonoaudiólogo(a)",
  fonoaudiologa: "Fonoaudiólogo(a)",
  psicologo_familiar: "Psicólogo(a) Familiar",
  psicologa_familiar: "Psicóloga Familiar",
  psicopedagogo_clinico: "Psicopedagogo(a) Clínico(a)",
  psicopedagoga_clinica: "Psicopedagoga Clínica",
  specialist: "Especialista do Núcleo Assistencial",
  researcher: "Pesquisador(a)",
};

/** Papéis puramente administrativos — Sem acesso a prontuário ou registros clínicos. */
export const ADMINISTRATIVE_ONLY_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "board",
  "board_especialistas",
  "municipal_manager",
  "gestor_municipal",
  "school_manager",
  "diretor",
] as const;

/** Papéis clínicos autorizados a acessar/editar registros clínicos. */
export const CLINICAL_ROLES: readonly Role[] = [
  "teacher",
  "ppi",
  "re",
  "responsavel_escolar",
  "md1",
  "medico",
  "md",
  "specialist",
  "assistente_social",
  "as",
  "servico_social",
  "neuropsicologo",
  "psicomotricista",
  "psicoterapeuta",
  "psicologo",
  "psicologa",
  "fonoaudiologo",
  "fonoaudiologa",
  "psicologo_familiar",
  "psicologa_familiar",
  "psicopedagogo_clinico",
  "psicopedagoga_clinica",
] as const;

/** Papéis para triagem e encaminhamento inicial. */
export const TRIAGEM_ROLES: readonly Role[] = [
  "teacher",
  "ppi",
  "re",
  "responsavel_escolar",
] as const;

/** Papéis de especialista clínico para prontuário multidisciplinar delegado. */
export const SPECIALIST_CLINICAL_ROLES: readonly Role[] = [
  "specialist",
  "assistente_social",
  "as",
  "servico_social",
  "neuropsicologo",
  "psicomotricista",
  "psicoterapeuta",
  "psicologo",
  "psicologa",
  "fonoaudiologo",
  "fonoaudiologa",
  "psicologo_familiar",
  "psicologa_familiar",
  "psicopedagogo_clinico",
  "psicopedagoga_clinica",
] as const;


