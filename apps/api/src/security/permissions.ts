/**
 * Matriz de privilégios do Periscópio (fonte única).
 * Regras do PM (André, 09/out/2026) sobre quem faz e vê o quê:
 *
 *  GESTORES        admin_platform (ADM master) · board (Board de especialistas) · municipal_manager
 *  ESCOLA          school_manager (gestor/diretor) · ppi (RE)
 *  NÚCLEO ASSIST.  md1 (médico) · specialist (AS, neuropsicologia, psicomotricidade, psicoterapia,
 *                  fonoaudiologia, psicologia familiar, psicopedagogia clínica)
 *
 *  - Gestor municipal e diretor só veem o SUMÁRIO DO RE e a LISTA FINAL de alunos encaminhados ao núcleo.
 *  - O RE cadastra professores e a si mesmo, acompanha os alunos com dificuldade, faz o sumário e a lista
 *    para o núcleo e pode pedir ajuda ao Board em casos graves.
 *  - O médico recebe a lista do RE, avalia e direciona aos especialistas; só ele encerra.
 *  - Especialistas preenchem só a própria seção e veem o sumário concluído dos colegas.
 *  - Board e ADM não leem prontuário: o Board atua pelos pedidos de ajuda (reuniões).
 *  Cada constante abaixo é usada pelas rotas; os testes em e2e/privileges.e2e.test.ts fixam a matriz.
 */
import type { Role } from "./roles";

/** Cadastra alunos (código pseudonimizado) e abre casos. Apoio do ADM é auditado e sem leitura clínica. */
export const REGISTRY_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "ppi",
  "re",
  "responsavel_escolar",
  "teacher",
];

/** Diretório de profissionais da escola (nome, papel, especialidade): dado administrativo, não clínico. */
export const STAFF_DIRECTORY_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "municipal_manager",
  "gestor_municipal",
  "school_manager",
  "diretor",
  "ppi",
  "re",
  "responsavel_escolar",
];

/** Diretório dos especialistas do núcleo (nome, especialidade): o médico precisa dele para delegar. Dado administrativo, não clínico. */
export const NUCLEO_DIRECTORY_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "md1",
  "medico",
  "md",
];

/** Lista os casos e lê a avaliação do RE: RE (da própria escola), médico (da rede) e ADM. */
export const CASE_LIST_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "ppi",
  "re",
  "responsavel_escolar",
  "md1",
  "medico",
  "md",
];

/** Visões da gestão sobre o sumário do RE e a lista de encaminhados ao núcleo. */
export const MANAGEMENT_VIEW_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "municipal_manager",
  "gestor_municipal",
  "school_manager",
  "diretor",
];

/** Pode pedir ajuda ao Board de especialistas. */
export const BOARD_REQUESTER_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "ppi",
  "re",
  "responsavel_escolar",
  "teacher",
  "md1",
  "medico",
  "md",
];

/** Atende os pedidos ao Board e gere a agenda. */
export const BOARD_MANAGER_ROLES: readonly Role[] = [
  "board",
  "board_especialistas",
  "admin_platform",
  "adm_master",
];

/** Núcleo assistencial que preenche seções delegadas. */
export const NUCLEO_SECTION_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "md1",
  "medico",
  "md",
  "specialist",
  "assistente_social",
  "neuropsicologo",
  "psicomotricista",
  "psicoterapeuta",
  "fonoaudiologa",
  "psicologo_familiar",
  "psicopedagogo_clinico",
];

/** Papéis que usam as escalas/avaliações clínicas (nunca gestão pura). */
export const CLINICAL_SCALE_ROLES: readonly Role[] = [
  "admin_platform",
  "adm_master",
  "ppi",
  "re",
  "responsavel_escolar",
  "teacher",
  "md1",
  "medico",
  "md",
  "specialist",
  "assistente_social",
  "neuropsicologo",
  "psicomotricista",
  "psicoterapeuta",
  "fonoaudiologa",
  "psicologo_familiar",
  "psicopedagogo_clinico",
];

