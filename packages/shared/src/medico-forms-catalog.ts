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

import { GENOGRAMA_JSON_MAX, normalizarGenogramaTexto } from "./genograma";

export const MD_FORMS_VERSION = "md-0.2-rascunho" as const;
export const MD_TEXTO_MAX = 4000;

/**
 * Ficha do médico, na sequência do formulário em papel (ajustes de 23/out/2026): seções B a R.
 * A seção A é o cabeçalho do prontuário (identificação do aluno), que a tela já mostra.
 * Os ids de C (anamnese_biografica), G (genograma), K (encaminhamentos) e Q (sumario_medico) foram mantidos
 * para não perder o que já foi registrado.
 */
export const MD_FORM_IDS = [
  "queixa_escola",
  "anamnese_biografica",
  "avaliacao_psiquiatrica",
  "outras_queixas",
  "exame_fisico",
  "genograma",
  "conclusao",
  "hipotese_diagnostica",
  "conduta",
  "encaminhamentos",
  "retorno_reavaliacao",
  "testes_complementares",
  "tcle",
  "entrevista_seguimento",
  "entrevista_manutencao",
  "sumario_medico",
  "recomendacao_escola",
] as const;
export type MdFormId = (typeof MD_FORM_IDS)[number];

export interface MdCampo {
  id: string;
  rotulo: string;
  ajuda?: string;
  max: number;
  /** "texto" (padrão), "data" (AAAA-MM-DD) ou "genograma": editor por parentesco que guarda o desenho como JSON curto (ver `genograma.ts`). */
  tipo?: "texto" | "genograma" | "data";
}

export interface MdForm {
  id: MdFormId;
  /** Letra da seção na ficha em papel (B a R). */
  letra: string;
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

const secao = (
  id: MdFormId,
  letra: string,
  titulo: string,
  descricao: string,
  campos: MdCampo[] = registro(),
  aviso: string | undefined = AVISO_PENDENTE
): MdForm => ({ id, letra, titulo, descricao, campos, aviso });

export const MD_FORMS: Record<MdFormId, MdForm> = {
  queixa_escola: secao(
    "queixa_escola", "B", "Queixa da Escola",
    "O que a escola relatou, na leitura do médico. A queixa registrada pelo RE aparece acima do campo, só para consulta.",
    registro("Não escreva nome, telefone ou endereço. Use o código do aluno.")
  ),
  anamnese_biografica: secao(
    "anamnese_biografica", "C", "Biografia com eventos normativos ou disruptivos",
    "História do aluno contada pelo responsável e pela escola, com os eventos esperados da vida e os que a interromperam.",
    registro("Não escreva nome, telefone ou endereço. Use o código do aluno.")
  ),
  avaliacao_psiquiatrica: secao("avaliacao_psiquiatrica", "D", "Avaliação Psiquiátrica", "Avaliação feita pelo médico na consulta."),
  outras_queixas: secao("outras_queixas", "E", "Outras Queixas", "Queixas que não são da escola: da família, do próprio aluno ou observadas na consulta."),
  exame_fisico: secao("exame_fisico", "F", "Exame físico", "Exame físico feito pelo médico na consulta."),
  genograma: secao(
    "genograma", "G", "Genograma",
    "Composição familiar desenhada por parentesco, mais a descrição em texto do que o desenho ainda não mostra. Legenda: 1. Mãe / 2. Pai.",
    [
      {
        id: "estrutura",
        rotulo: "Desenho do genograma",
        ajuda: "Escolha o parentesco para adicionar cada figura. Não use nomes. Legenda: 1. Mãe / 2. Pai.",
        max: GENOGRAMA_JSON_MAX,
        tipo: "genograma",
      },
      ...registro("Complete em texto o que o desenho não mostra (ex.: meio-irmãos, padrasto ou madrasta, antecedentes). Evite nomes: use o parentesco."),
    ]
  ),
  conclusao: secao("conclusao", "H", "Conclusão", "Conclusão do médico sobre a avaliação."),
  hipotese_diagnostica: secao(
    "hipotese_diagnostica", "I", "Hipótese diagnóstica",
    "Campo exclusivo do médico responsável. O sistema não sugere, não classifica e não preenche."
  ),
  conduta: secao(
    "conduta", "J", "Conduta",
    "Campo exclusivo do médico responsável. O sistema não sugere, não prescreve e não preenche."
  ),
  encaminhamentos: secao(
    "encaminhamentos", "K", "Encaminhamentos",
    "Registro do que o médico decidiu encaminhar. Para designar os especialistas do núcleo, use “Encaminhar a especialistas”.",
    registro("Aqui vai o registro escrito. A designação dos especialistas é feita no botão “Encaminhar a especialistas”.")
  ),
  retorno_reavaliacao: secao(
    "retorno_reavaliacao", "L", "Retorno para reavaliação",
    "Data marcada pelo médico para o retorno.",
    [{ id: "data", rotulo: "Retorno para reavaliação em", ajuda: "Escolha o dia, mês e ano.", max: 10, tipo: "data" }],
    undefined
  ),
  testes_complementares: secao(
    "testes_complementares", "M", "Quais testes complementares foram aplicados?",
    "Lista dos testes complementares aplicados. SNAP-IV e ASO são instrumentos externos: o sistema só guarda o resultado anexado.",
    registro("Escreva o nome do teste e a data. O resultado em arquivo vai na aba “Exames & Anexos”.")
  ),
  tcle: secao(
    "tcle", "N", "Termo de Consentimento Livre e Esclarecido",
    "Registro de que o termo foi apresentado e assinado. O texto do termo e a prova de aceite dependem de validação jurídica.",
    registro("Escreva se o termo foi assinado e em que data. Não escreva nome do responsável.")
  ),
  entrevista_seguimento: secao("entrevista_seguimento", "O", "Entrevista Médica de Seguimento", "Registro das consultas de seguimento."),
  entrevista_manutencao: secao(
    "entrevista_manutencao", "P", "Entrevista Médica de Manutenção Individual ou Grupal",
    "Registro das consultas de manutenção, individuais ou em grupo."
  ),
  sumario_medico: secao(
    "sumario_medico", "Q", "Sumário da Avaliação Médica",
    "Resumo do médico sobre o caso. É este sumário executivo que os especialistas escolhidos recebem, depois que você concluir a seção.",
    registro("Só o que o especialista precisa para a avaliação dele. Rascunho nunca sai do seu perfil.")
  ),
  recomendacao_escola: secao(
    "recomendacao_escola", "R", "Recomendação para a Escola",
    "Orientação do médico para a escola, em linguagem simples e observável.",
    registro("Escreva o que a escola pode observar ou fazer. Não escreva diagnóstico.")
  ),
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
    if (c.tipo === "genograma") saida[c.id] = normalizarGenogramaTexto(v);
    else if (c.tipo === "data") saida[c.id] = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : "";
    else saida[c.id] = typeof v === "string" ? v.slice(0, c.max) : "";
  }
  return saida;
}

/** Pelo menos um campo com texto. */
export function medicoTemConteudo(payload: Record<string, string>): boolean {
  return Object.values(payload).some((v) => v.trim().length > 0);
}
