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
export const REGISTRY_ROLES: readonly Role[] = ["ppi", "admin_platform"];

/** Diretório de profissionais da escola (nome, papel, especialidade): dado administrativo, não clínico. */
export const STAFF_DIRECTORY_ROLES: readonly Role[] = ["admin_platform", "municipal_manager", "school_manager", "ppi"];

/** Diretório dos especialistas do núcleo (nome, especialidade): o médico precisa dele para delegar. Dado administrativo, não clínico. */
export const NUCLEO_DIRECTORY_ROLES: readonly Role[] = ["md1"];

/** Lista os casos e lê a avaliação do RE: RE (da própria escola) e médico (da rede). */
export const CASE_LIST_ROLES: readonly Role[] = ["ppi", "md1"];

/** Visões da gestão sobre o sumário do RE e a lista de encaminhados ao núcleo. */
export const MANAGEMENT_VIEW_ROLES: readonly Role[] = ["municipal_manager", "school_manager"];

/** Pode pedir ajuda ao Board de especialistas. */
export const BOARD_REQUESTER_ROLES: readonly Role[] = ["ppi", "md1"];

/** Atende os pedidos ao Board e gere a agenda. */
export const BOARD_MANAGER_ROLES: readonly Role[] = ["board", "admin_platform"];

/** Núcleo assistencial que preenche seções delegadas. */
export const NUCLEO_SECTION_ROLES: readonly Role[] = ["md1", "specialist"];

/** Papéis que usam as escalas/avaliações clínicas (nunca gestão). */
export const CLINICAL_SCALE_ROLES: readonly Role[] = ["ppi", "md1", "specialist"];
