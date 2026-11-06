/**
 * Grupos de etiquetas. As etiquetas em si (o texto de cada uma) são cadastradas pelo Administrador Master, por município.
 * O RE só escolhe; nunca digita etiqueta livre. Desativar não apaga: registros antigos continuam legíveis.
 */
export const ETIQUETA_GRUPOS = [
  {
    id: "dificuldades_persistentes",
    titulo: "Dificuldades persistentes (opção \"Outra\")",
    descricao: "Aparecem para o RE quando ele marca \"Outra\" nas dificuldades persistentes do aluno.",
  },
] as const;

export type EtiquetaGrupoId = (typeof ETIQUETA_GRUPOS)[number]["id"];

export const ETIQUETA_GRUPO_IDS: readonly string[] = ETIQUETA_GRUPOS.map((g) => g.id);

export const ETIQUETA_ROTULO_MIN = 2;
export const ETIQUETA_ROTULO_MAX = 80;

export interface EtiquetaItem {
  id: string;
  grupo: string;
  rotulo: string;
  ativo?: boolean;
}
