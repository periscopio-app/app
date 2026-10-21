/**
 * Formulários do médico (md1) — estrutura provisória.
 *
 * Fonte das famílias: CATALOGO_FORMULARIOS_ESTADOS_PROMPTS_FIGMA.md (4/out/2026) e Prompt 2 do Figma Make:
 * "anamnese/biografia, exame, genograma, hipótese e conduta, encaminhamentos, seguimento e sumário"
 * (Capi MD plataforma 1809 + ANEXOS cap MD 2109). SNAP-IV e ASO são instrumentos externos: só anexar resultado.
 *
 * REGRA DE PRODUTO (não mudar sem validação clínica):
 *  - Este arquivo NÃO contém as perguntas do capítulo médico (o PDF ainda não foi catalogado pergunta a pergunta).
 *    Cada seção tem um único campo de texto livre curto ("Registro do médico"), no mesmo desenho do P0-03
 *    ("payload com texto livre curto, versionado"). Quando o dono clínico aprovar o texto exato, as perguntas
 *    entram aqui como dados, com nova versão — sem mexer em tela nem em API.
 *  - Em branco continua em branco. O sistema não calcula, não sugere, não classifica e não preenche hipótese,
 *    conduta, prescrição ou alta: tudo é digitado pelo médico responsável.
 */

export const MD_FORMS_VERSION = "md-0.1-rascunho" as const;
export const MD_TEXTO_MAX = 4000;

export const MD_FORM_IDS = [
  "anamnese_biografica",
  "exame_psiquiatrico_fisico",
  "genograma",
  "hipotese_conduta",
  "encaminhamentos",
  "seguimento",
  "sumario_medico",
] as const;
export type MdFormId = (typeof MD_FORM_IDS)[number];

export interface MdCampo {
  id: string;
  rotulo: string;
  ajuda?: string;
  max: number;
}

export interface MdForm {
  id: MdFormId;
  titulo: string;
  /** O que a seção registra, em linguagem simples. */
  descricao: string;
  campos: MdCampo[];
  /** Aviso fixo exibido na seção. */
  aviso?: string;
}

const AVISO_PENDENTE =
  "Estrutura provisória: as perguntas exatas do capítulo médico entram aqui depois da validação clínica. Registre em texto livre, em linguagem observável.";

const registro = (ajuda?: string): MdCampo[] => [{ id: "registro", rotulo: "Registro do médico", ajuda, max: MD_TEXTO_MAX }];

export const MD_FORMS: Record<MdFormId, MdForm> = {
  anamnese_biografica: {
    id: "anamnese_biografica",
    titulo: "Anamnese biográfica",
    descricao: "História do aluno contada pelo responsável e pela escola, registrada pelo médico.",
    campos: registro("Não escreva nome, telefone ou endereço. Use o código do aluno."),
    aviso: AVISO_PENDENTE,
  },
  exame_psiquiatrico_fisico: {
    id: "exame_psiquiatrico_fisico",
    titulo: "Exame psiquiátrico e físico",
    descricao: "Exame feito pelo médico na consulta.",
    campos: registro(),
    aviso: AVISO_PENDENTE,
  },
  genograma: {
    id: "genograma",
    titulo: "Genograma",
    descricao: "Descrição da composição e das relações familiares. O desenho gráfico ainda não está digitalizado.",
    campos: registro("Descreva em texto. Evite nomes: use o parentesco (mãe, avó, irmão mais velho)."),
    aviso: AVISO_PENDENTE,
  },
  hipotese_conduta: {
    id: "hipotese_conduta",
    titulo: "Hipótese e conduta",
    descricao: "Campo exclusivo do médico responsável. O sistema não sugere, não classifica e não preenche.",
    campos: registro(),
    aviso: AVISO_PENDENTE,
  },
  encaminhamentos: {
    id: "encaminhamentos",
    titulo: "Encaminhamentos",
    descricao:
      "Registro do que o médico decidiu encaminhar. Para designar os especialistas do núcleo, use “Encaminhar a especialistas”.",
    campos: registro("Aqui vai o registro escrito. A designação dos especialistas é feita no botão “Encaminhar a especialistas”."),
    aviso: AVISO_PENDENTE,
  },
  seguimento: {
    id: "seguimento",
    titulo: "Seguimento e manutenção",
    descricao: "Plano de seguimento definido pelo médico.",
    campos: registro(),
    aviso: AVISO_PENDENTE,
  },
  sumario_medico: {
    id: "sumario_medico",
    titulo: "Sumário médico",
    descricao: "Resumo do médico sobre o caso, para o prontuário.",
    campos: registro(),
    aviso: AVISO_PENDENTE,
  },
};

export function isMdFormId(v: string): v is MdFormId {
  return (MD_FORM_IDS as readonly string[]).includes(v);
}

/** Instrumentos externos do capítulo médico: o sistema só guarda o resultado anexado (aba "Exames e anexos"). */
export const MD_INSTRUMENTOS_EXTERNOS = [
  { id: "snap_iv", nome: "SNAP-IV", motivo: "Versão e licença a confirmar. No fluxo do RE, a escala já tem espaço próprio (Formulário G)." },
  { id: "aso", nome: "ASO", motivo: "Versão e licença a confirmar. Anexe o resultado autorizado em “Exames e anexos”." },
] as const;

/** Limpa o payload recebido: só campos conhecidos, só texto, aparado e limitado. Em branco fica em branco. */
export function normalizarPayloadMedico(id: MdFormId, bruto: unknown): Record<string, string> {
  const form = MD_FORMS[id];
  const origem = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {};
  const saida: Record<string, string> = {};
  for (const c of form.campos) {
    const v = origem[c.id];
    saida[c.id] = typeof v === "string" ? v.slice(0, c.max) : "";
  }
  return saida;
}

/** Pelo menos um campo com texto. */
export function medicoTemConteudo(payload: Record<string, string>): boolean {
  return Object.values(payload).some((v) => v.trim().length > 0);
}
