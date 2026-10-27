/**
 * Formulários do médico (md1): reprodução do capítulo "Anamnese Médica Biográfica" (Núcleo de Saúde Mental,
 * Capi MD plataforma 1809, seções B a R) e dos anexos (ANEXOS cap MD 2109).
 *
 * REGRA DE PRODUTO (Dra., 23/out e 26/out/2026): os campos são os do papel, com o mesmo texto das perguntas.
 * Não há pesos, pontos de corte, escore nem classificação. O sistema não calcula, não sugere e não preenche
 * hipótese, conduta, prescrição ou alta: tudo é marcado ou digitado pelo médico responsável.
 * A seção A (Cadastro) é o cabeçalho do prontuário: a tela mostra só o código do aluno e a escola
 * (sem nome do aluno, da mãe nem endereço).
 *
 * Armazenamento: cada campo vira um texto curto no payload (`Record<string,string>`):
 *  - escolha: o valor da opção marcada ("" se nada marcado);
 *  - multi: valores marcados separados por vírgula, na ordem das opções.
 */

import { GENOGRAMA_JSON_MAX, normalizarGenogramaTexto } from "./genograma";

export const MD_FORMS_VERSION = "md-1.1-hipotese-cid" as const;
export const MD_TEXTO_MAX = 4000;
const CURTO = 300;
/** Hipótese diagnóstica (seção I): um campo para CID 10 e um para CID 11; cabe mais de um código, separados por vírgula. */
const CID_MAX = 120;

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

export interface MdOpcao {
  valor: string;
  rotulo: string;
}

export type MdTipo = "texto" | "texto_curto" | "data" | "numero" | "escolha" | "multi" | "genograma";

export interface MdCampo {
  id: string;
  rotulo: string;
  ajuda?: string;
  max: number;
  /** "texto" (área grande, padrão), "texto_curto" (uma linha), "data" (AAAA-MM-DD), "numero", "escolha" (uma opção), "multi" (várias) ou "genograma". */
  tipo?: MdTipo;
  opcoes?: MdOpcao[];
  /** Em "multi": valor que, marcado, desmarca os demais (ex.: "0. nenhuma"). */
  exclusivo?: string;
  /** Título de bloco (linha da tabela do papel). Mostrado quando muda de um campo para o seguinte. */
  grupo?: string;
  /** Texto impresso na fonte, sem resposta (instrução ou lembrete). */
  nota?: string;
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

// ---------- construtores ----------
const NS: MdOpcao[] = [{ valor: "nao", rotulo: "Não" }, { valor: "sim", rotulo: "Sim" }];
const NA: MdOpcao[] = [{ valor: "normal", rotulo: "Normal" }, { valor: "alterada", rotulo: "Alterada" }];
const NAM: MdOpcao[] = [{ valor: "normal", rotulo: "Normal" }, { valor: "alterado", rotulo: "Alterado" }];
const BRR: MdOpcao[] = [{ valor: "bom", rotulo: "Bom" }, { valor: "regular", rotulo: "Regular" }, { valor: "ruim", rotulo: "Ruim" }];
const BORR: MdOpcao[] = [{ valor: "boa", rotulo: "Boa" }, { valor: "regular", rotulo: "Regular" }, { valor: "ruim", rotulo: "Ruim" }];
/** Exame psiquiátrico das entrevistas de seguimento e manutenção: 0 Normal, 1 Alterado, 9 Não se aplica. */
const N019: MdOpcao[] = [{ valor: "0", rotulo: "0 · Normal" }, { valor: "1", rotulo: "1 · Alterado(a, as)" }, { valor: "9", rotulo: "9 · Não se aplica(m)" }];

const esc = (id: string, rotulo: string, opcoes: MdOpcao[], extra: Partial<MdCampo> = {}): MdCampo => ({ id, rotulo, tipo: "escolha", opcoes, max: 40, ...extra });
const sn = (id: string, rotulo: string, extra: Partial<MdCampo> = {}): MdCampo => esc(id, rotulo, NS, extra);
const multi = (id: string, rotulo: string, opcoes: MdOpcao[], extra: Partial<MdCampo> = {}): MdCampo => ({ id, rotulo, tipo: "multi", opcoes, max: 400, ...extra });
const curto = (id: string, rotulo: string, extra: Partial<MdCampo> = {}): MdCampo => ({ id, rotulo, tipo: "texto_curto", max: CURTO, ...extra });
const longo = (id: string, rotulo: string, extra: Partial<MdCampo> = {}): MdCampo => ({ id, rotulo, tipo: "texto", max: MD_TEXTO_MAX, ...extra });
const num = (id: string, rotulo: string, extra: Partial<MdCampo> = {}): MdCampo => ({ id, rotulo, tipo: "numero", max: 8, ...extra });
const data = (id: string, rotulo: string, extra: Partial<MdCampo> = {}): MdCampo => ({ id, rotulo, tipo: "data", max: 10, ...extra });
const ops = (...rotulos: string[]): MdOpcao[] => rotulos.map((r, i) => ({ valor: String(i + 1), rotulo: r }));

const secao = (id: MdFormId, letra: string, titulo: string, descricao: string, campos: MdCampo[], aviso?: string): MdForm => ({
  id, letra, titulo, descricao, campos, aviso,
});

// ---------- B. Queixa da Escola ----------
const QUEIXAS_ESCOLA: MdOpcao[] = [
  { valor: "0", rotulo: "0. nenhuma" },
  { valor: "1", rotulo: "1. aprendizagem global (não lê/nem escreve)" },
  { valor: "2", rotulo: "2. leitura" },
  { valor: "3", rotulo: "3. escrita" },
  { valor: "4", rotulo: "4. intelectual" },
  { valor: "5", rotulo: "5. comportamental" },
  { valor: "6", rotulo: "6. biológica/doença física" },
  { valor: "7", rotulo: "7. social (não interage)" },
  { valor: "8", rotulo: "8. psicológico/emocional" },
  { valor: "9", rotulo: "9. familiar" },
  { valor: "10", rotulo: "10. econômica" },
  { valor: "11", rotulo: "11. PE" },
];

// ---------- C. Biografia ----------
const ANO_ESCOLAR: { ano: string; a: string; b: string }[] = [
  { ano: "3º ano", a: "Sim, esteve na escola", b: "Ajustamento bom?" },
  { ano: "4º ano", a: "Sim, esteve na escola", b: "Ajustamento bom?" },
  { ano: "5º ano", a: "Fala sem omissões ou trocas?", b: "Ajustamento bom?" },
  { ano: "6º ano", a: "Linguagem adequada", b: "Acompanha a aula com atenção" },
  { ano: "7º ano", a: "Escreve sem problemas", b: "Lê?" },
  { ano: "8º ano", a: "Aprende Aritmética", b: "Ajustamento bom?" },
  { ano: "9º ano", a: "Atraso em alguma área?", b: "Ajustamento bom?" },
  { ano: "10º ano", a: "Alguma dificuldade", b: "Ajustamento bom?" },
  { ano: "11º ano", a: "Alguma dificuldade", b: "Ajustamento bom?" },
  { ano: "12º ano", a: "Alguma dificuldade", b: "Ajustamento bom?" },
  { ano: "13º ano", a: "Alguma dificuldade", b: "Ajustamento bom?" },
];
const COLUNA_NS = "Não / Sim (coluna da direita do papel)";

const camposBiografia = (): MdCampo[] => {
  const c: MdCampo[] = [
    sn("planejamento_familiar", "Fez Planejamento Familiar"),
    multi("gestacao", "Gestação", [
      { valor: "0", rotulo: "0. Sem intercorrências" },
      { valor: "1", rotulo: "1. Com intercorrências" },
      { valor: "2", rotulo: "2. Pré-eclâmpsia" },
      { valor: "3", rotulo: "3. Prematuridade" },
    ], { grupo: "Gestação" }),
    multi("parto", "Parto", [
      { valor: "vaginal", rotulo: "Vaginal" },
      { valor: "cesariana", rotulo: "Cesariana" },
      { valor: "forceps", rotulo: "Com fórceps" },
      { valor: "inducao", rotulo: "Com indução" },
    ], { grupo: "Parto" }),
    multi("mes1", "1º mês", [{ valor: "amamentado", rotulo: "Amamentado" }], { grupo: "1º mês" }),
    multi("ano1", "1º ano", [
      { valor: "amamentado_por", rotulo: "Amamentado por.....meses" },
      { valor: "nao_por_que", rotulo: "Não, por quê?" },
      { valor: "sentou_6m", rotulo: "Sentou-se aos 6 meses?" },
      { valor: "falou_12m", rotulo: "Falou aos 12 meses?" },
      { valor: "sono_normal", rotulo: "Sono normal?" },
      { valor: "andou_12m", rotulo: "Andou aos 12 meses?" },
      { valor: "empatia", rotulo: "Teve empatia com familiares?" },
      { valor: "alimenta_sem_problemas", rotulo: "Alimenta-se sem problemas." },
    ], { grupo: "1º ano" }),
    num("ano1_amamentado_meses", "Amamentado por quantos meses", { grupo: "1º ano" }),
    curto("ano1_nao_por_que", "Se não amamentado: por quê?", { grupo: "1º ano" }),
    sn("ano1_ns", COLUNA_NS, { grupo: "1º ano" }),
    multi("ano2_escola", "Foi à escola? Ajustou-se?", [
      { valor: "sim", rotulo: "Sim" },
      { valor: "nao", rotulo: "Não" },
      { valor: "timido", rotulo: "Tímido" },
      { valor: "agressivo", rotulo: "Agressivo" },
    ], { grupo: "2º ano" }),
    sn("ano2_ns", COLUNA_NS, { grupo: "2º ano" }),
  ];
  ANO_ESCOLAR.forEach((a, i) => {
    const n = i + 3;
    c.push(sn(`ano${n}_a`, a.a, { grupo: a.ano }));
    c.push(sn(`ano${n}_b`, a.b, { grupo: a.ano }));
  });
  c.push(
    curto("adotado_idade", "Se adotado, qual foi a idade?", { grupo: "Adoção e casal parental" }),
    sn("adocao_conhecimento_cedo", "Teve conhecimento do fato cedo na vida?", { grupo: "Adoção e casal parental" }),
    curto("adocao_conhecimento_idade", "Com qual idade?", { grupo: "Adoção e casal parental" }),
    sn("relacionamento_casal_bom", "O relacionamento atual com casal parental é bom?", { grupo: "Adoção e casal parental" })
  );
  return c;
};

// ---------- exames psiquiátricos ----------
const EXAME_PSIQ = [
  "Aparência", "Atitude", "Capacidade de interação", "Atenção e concentração", "Capacidade de compreensão", "Humor",
  "Grau de orientação", "Linguagem", "Fala", "Atividade motora", "Características do pensamento", "Outros",
];
const EXAME_PSIQ_SEG = [...EXAME_PSIQ.slice(0, 11), "Outras"];

// ---------- E. Outras queixas ----------
const OUTRAS_QUEIXAS = [
  "Sistema digestivo", "Sistema urinário", "Sistema genital", "Sistema nervoso", "Sistema locomotor",
  "Pele e anexos", "Sono", "Sistema respiratório", "Sistema cardiovascular", "Outras",
];

// ---------- G. Legenda do genograma (1. MÃE / 2. PAI) ----------
const LEGENDA_GENOGRAMA: MdOpcao[] = [
  "Faleceu cedo", "Casada", "Separada", "Separou e casou", "Separou e casou e tem filhos", "Trabalha", "Desempregada", "Aposentada",
  "Ensino Fundamental ou menos", "Paga aluguel", "Abusa de álcool", "Fumante", "Usa outras drogas", "Sofreu violência física",
  "Sofreu abuso sexual", "Vive violência em casa", "Tem doença crônica (hipertensão, diabetes, obesidade, outra)", "Faz tratamento",
  "Tem transtorno mental (ansiedade, depressão, compulsão, mania)", "Faz tratamento (usa medicamento contínuo)", "Tem problema alimentar",
  "Está com sobrepeso", "Tem insônia", "Faz exercício", "Reage de forma desregulada diante de determinadas situações?",
  "Personalidade impulsiva", "Personalidade explosiva", "Teve conflitos com a lei", "Fica nas telas nas horas vagas (TV, celular/Ipad/PC)",
  "Se sim, mais que 2 horas/dia", "Irmãos com transtornos mentais", "Pais com transtornos mentais",
].map((r, i) => ({ valor: String(i + 1), rotulo: `${i + 1}. ${r}` }));

// ---------- P. Manutenção ----------
const CONDUTA_MANUTENCAO: MdOpcao[] = [
  { valor: "a", rotulo: "a. Manutenção no individual por mais 1 mês" },
  { valor: "b", rotulo: "b. Manutenção no individual por mais 3 meses" },
  { valor: "c", rotulo: "c. Encaminhado para o acompanhamento Grupal" },
  { valor: "d", rotulo: "d. Grupo-terapia por mais 1 mês" },
  { valor: "e", rotulo: "e. Grupo-terapia por mais 3 meses" },
  { valor: "f", rotulo: "f. Alta" },
];

// ---------- Q. Sumário ----------
const CONDUTA_SUMARIO: MdOpcao[] = [
  { valor: "5", rotulo: "5. não está sob farmacoterapia" },
  { valor: "6", rotulo: "6. sim, está sob farmacoterapia" },
  { valor: "7", rotulo: "7. Fez avaliação social familiar" },
  { valor: "8", rotulo: "8. Fez avaliação neuropsicológica" },
  { valor: "9", rotulo: "9. Fez avaliação motora" },
  { valor: "10", rotulo: "10. Fez avaliação fonoaudiológica" },
  { valor: "11", rotulo: "11. Fez avaliação psicológica" },
  { valor: "12", rotulo: "12. Fez avaliação psicopedagógica" },
  { valor: "13", rotulo: "13. Fez tratamento na (s) área (s)" },
  { valor: "14", rotulo: "14. Encaminhamento externo" },
];

const exameSeguimento = (prefixo: string, itens: string[], letras: boolean): MdCampo[] =>
  itens.map((r, i) => esc(`${prefixo}${i + 1}`, `${letras ? String.fromCharCode(97 + i) : i + 1}. ${r}`, N019, { grupo: "Exame Psiquiátrico" }));

export const MD_FORMS: Record<MdFormId, MdForm> = {
  queixa_escola: secao(
    "queixa_escola", "B", "Queixa da Escola",
    "Marque as queixas da escola. A queixa registrada pelo RE aparece acima, só para consulta.",
    [
      multi("queixas", "Queixa da escola", QUEIXAS_ESCOLA, { exclusivo: "0" }),
      curto("outra_queixa", "Outra queixa"),
    ]
  ),

  anamnese_biografica: secao(
    "anamnese_biografica", "C", "Biografia com eventos normativos ou disruptivos",
    "História do aluno, ano a ano, com os eventos esperados da vida e os que a interromperam.",
    camposBiografia(),
    "Use o código do aluno. Não escreva nome, telefone ou endereço."
  ),

  avaliacao_psiquiatrica: secao(
    "avaliacao_psiquiatrica", "D", "Avaliação Psiquiátrica",
    "Exame psiquiátrico feito pelo médico na consulta, item a item, com anotações.",
    EXAME_PSIQ.flatMap((r, i): MdCampo[] => [
      esc(`exame${i + 1}`, `${i + 1}. ${r}`, NA, { grupo: `${i + 1}. ${r}` }),
      curto(`exame${i + 1}_nota`, "Anotações", { grupo: `${i + 1}. ${r}` }),
    ])
  ),

  outras_queixas: secao(
    "outras_queixas", "E", "Outras Queixas",
    "Queixas por sistema: marque Não ou Sim e descreva os sintomas.",
    OUTRAS_QUEIXAS.flatMap((r, i): MdCampo[] => [
      sn(`queixa${i + 1}`, `${i + 1}. ${r}`, { grupo: `${i + 1}. ${r}` }),
      curto(`queixa${i + 1}_sintomas`, "Sintomas", { grupo: `${i + 1}. ${r}` }),
    ])
  ),

  exame_fisico: secao(
    "exame_fisico", "F", "Exame físico",
    "Exame físico feito pelo médico na consulta.",
    [
      sn("geral", "Exame físico geral"),
      num("estatura", "1. Estatura (cm)"),
      num("peso", "2. Peso (kg)"),
      num("pa_max", "3. PA máxima (mmHg)"),
      num("pa_min", "4. PA mínima (mmHg)"),
      num("pulso", "5. Pulso (bpm)"),
      num("fc", "6. FC (bpm)"),
      sn("facies", "7. Fácies alterados"),
      esc("estado_nutricional", "8. Estado nutricional", [
        { valor: "eutrofia", rotulo: "Eutrofia" },
        { valor: "desnutricao", rotulo: "Desnutrição" },
        { valor: "emagrecimento", rotulo: "Emagrecimento" },
        { valor: "obesidade", rotulo: "Obesidade" },
      ]),
      esc("hidratacao", "9. Hidratação", NA),
      esc("perfusao", "10. Perfusão tecidual", NA),
      sn("ictericia", "11. Icterícia"),
      esc("estado_geral", "12. Estado geral", [
        { valor: "bom", rotulo: "Bom" },
        { valor: "regular", rotulo: "Regular" },
        { valor: "mau", rotulo: "Mau" },
      ]),
      esc("exame_especial", "13. Exame físico especial", NAM),
      sn("hepatomegalia", "14. Hepatomegalia"),
      sn("outros_diagnosticos_clinicos", "15. Outros diagnósticos clínicos"),
      sn("diagnosticos_psiquiatricos_previos", "16. Diagnósticos psiquiátricos prévios"),
      esc("acompanhado_pe", "17. Acompanhado PE toda semana?", [
        { valor: "nao", rotulo: "Não" },
        { valor: "1a4meses", rotulo: "1 a 4 meses" },
        { valor: "outro", rotulo: "Outro" },
      ]),
    ]
  ),

  genograma: secao(
    "genograma", "G", "Genograma",
    "Composição familiar desenhada por parentesco e legenda marcada para a mãe e para o pai (1. Mãe / 2. Pai).",
    [
      {
        id: "estrutura",
        rotulo: "Desenho do genograma",
        ajuda: "Escolha o parentesco para adicionar cada figura. Não use nomes.",
        max: GENOGRAMA_JSON_MAX,
        tipo: "genograma",
      },
      multi("legenda_mae", "Legenda · 1. MÃE", LEGENDA_GENOGRAMA, { grupo: "Legenda" }),
      multi("legenda_pai", "Legenda · 2. PAI", LEGENDA_GENOGRAMA, { grupo: "Legenda" }),
      num("fr_1", "Σ FR · primeira parcela", {
        grupo: "Σ FR",
        nota: "Σ FR = ___ + ___ + ___ (impresso no formulário). Quanto maior o número de FR, maior a gravidade.",
        ajuda: "Digitado pelo médico. O sistema não soma, não compara e não interpreta.",
      }),
      num("fr_2", "Σ FR · segunda parcela", { grupo: "Σ FR" }),
      num("fr_3", "Σ FR · terceira parcela", { grupo: "Σ FR" }),
    ]
  ),

  conclusao: secao(
    "conclusao", "H", "Conclusão",
    "Conclusão do médico sobre a avaliação.",
    [
      esc("credibilidade", "1. Grau de credibilidade das respostas", BRR),
      esc("disposicao", "2. Disposição para o tratamento", BORR),
      esc("vinculo", "3. Avaliação inicial do vínculo", BORR),
      esc("prognostico", "4. Prognóstico do caso", BRR),
    ]
  ),

  hipotese_diagnostica: secao(
    "hipotese_diagnostica", "I", "Hipótese diagnóstica",
    "Campo exclusivo do médico responsável. O sistema não sugere, não classifica e não preenche.",
    [
      curto("cid10", "CID 10", { max: CID_MAX }),
      curto("cid11", "CID 11", { max: CID_MAX }),
    ]
  ),

  conduta: secao(
    "conduta", "J", "Conduta",
    "Campo exclusivo do médico responsável. O sistema não sugere nem prescreve.",
    [
      sn("farmacoterapia_previa", "1. Farmacoterapia prévia"),
      curto("farmacoterapia_previa_qual", "Qual?"),
      sn("farmacoterapia_atual", "2. Farmacoterapia atual"),
      curto("farmacoterapia_atual_qual", "Qual?"),
    ]
  ),

  encaminhamentos: secao(
    "encaminhamentos", "K", "Encaminhamentos",
    "Marque Não ou Sim para cada encaminhamento. Para designar os especialistas do núcleo, use “Encaminhar a especialistas”.",
    [
      sn("re_mantera", "1. RE manterá o acompanhamento"),
      sn("neuropsicologica", "2. Avaliação Neuropsicológica"),
      sn("psicomotora", "3. Avaliação Psicomotora"),
      sn("fonoaudiologia", "4. Fonoaudiologia"),
      sn("psicopedagogia", "5. Psicopedagogia"),
      sn("psicoterapia", "6. Psicoterapia"),
      sn("outros", "7. Outros encaminhamentos"),
    ]
  ),

  retorno_reavaliacao: secao(
    "retorno_reavaliacao", "L", "Retorno para reavaliação",
    "Data marcada pelo médico para o retorno.",
    [data("data", "Retorno para reavaliação em", { ajuda: "Escolha o dia, mês e ano." })]
  ),

  testes_complementares: secao(
    "testes_complementares", "M", "Quais testes complementares foram aplicados?",
    "Testes complementares aplicados. O resultado em arquivo vai na aba “Exames & Anexos”.",
    [
      {
        id: "anexos_aplicados",
        rotulo: "Anexos para aplicação complementar, se necessário",
        tipo: "multi",
        max: 100,
        opcoes: [
          { valor: "snap4", rotulo: "a. SNAP-IV (Formulário H, capítulo II)" },
          { valor: "asq", rotulo: "b. ASQ, se já responderam o M-CHAT" },
          { valor: "meem", rotulo: "c. MEEM (Anexo II): poderá ser aplicado nos familiares, caso haja dúvida quanto à capacidade de compreensão, maturidade, estabilidade, consciência, coerência e cognição, de acordo com a idade no responsável" },
        ],
      },
      longo("testes", "Quais testes complementares foram aplicados?"),
    ]
  ),

  tcle: secao(
    "tcle", "N", "Termo de Consentimento Livre e Esclarecido",
    "O responsável autoriza o Núcleo a fazer as avaliações e as intervenções do plano terapêutico, com equipe multiprofissional e sigilo garantido. O texto jurídico do termo depende de validação.",
    [
      data("data", "Data do termo"),
      sn("assinado_responsavel", "Responsável assinou o termo"),
      sn("assinado_medico", "Médico assinou o termo"),
    ],
    "Não escreva o nome do responsável nem do aluno."
  ),

  entrevista_seguimento: secao(
    "entrevista_seguimento", "O", "Entrevista Médica de Seguimento",
    "Registro de cada consulta de seguimento.",
    [
      num("entrevista_numero", "Entrevista número"),
      data("data_avaliacao", "Data da avaliação"),
      longo("queixas_atuais", "1. Queixas atuais"),
      longo("evolucao", "2. Evolução"),
      ...exameSeguimento("exame", EXAME_PSIQ_SEG, false),
      longo("conduta", "Conduta"),
      data("data", "Data"),
    ]
  ),

  entrevista_manutencao: secao(
    "entrevista_manutencao", "P", "Entrevista Médica de Manutenção Individual ou Grupal",
    "Registro de cada consulta de manutenção, individual ou em grupo.",
    [
      num("entrevista_numero", "1. Entrevista número"),
      data("data_avaliacao", "Data da Avaliação"),
      esc("formato", "Formato", [{ valor: "individual", rotulo: "2. Individual" }, { valor: "grupal", rotulo: "3. Grupal" }]),
      longo("queixa", "3. Queixa"),
      ...exameSeguimento("exame", EXAME_PSIQ_SEG, true).map((c) => ({ ...c, grupo: "4. Exame Psiquiátrico" })),
      multi("conduta", "5. Conduta", CONDUTA_MANUTENCAO),
      sn("prescricao_atual", "6. Prescrição atual"),
      curto("prescricao_qual", "Qual?"),
      sn("re_mantera", "7. RE manterá o acompanhamento"),
      sn("fez_anp", "8. Fez ANp?"),
      sn("fara_novamente", "9. Se sim, fará novamente?"),
      sn("fez_fono", "10. Fez avaliação/tratamento fonoaudiológicos?"),
      sn("fez_psico", "11. Fez avaliação/tratamento psicológicos?"),
      sn("fez_motor", "12. Fez avaliação/tratamento motor?"),
      sn("fez_psicopedagogico", "13. Fez avaliação/treinamento psicopedagógicos?"),
      multi("em_seguimento_com", "14. Está em seguimento com?", [
        { valor: "medico", rotulo: "a. Médico" },
        { valor: "assistente_social", rotulo: "b. Assistente social" },
        { valor: "psicomotricista", rotulo: "c. Psicomotricista" },
        { valor: "psicologo", rotulo: "d. Psicólogo" },
        { valor: "fonoaudiologo", rotulo: "e. Fonoaudiólogo" },
        { valor: "pedagogo", rotulo: "f. Pedagogo" },
      ]),
      curto("em_manutencao_com", "15. Está em manutenção com?"),
      esc("planejamento_alta", "16. Planejamento da alta", [
        { valor: "nao", rotulo: "Não" },
        { valor: "sim_1_mes", rotulo: "Sim, em 1 mês" },
        { valor: "sim_mais", rotulo: "Sim, em mais de 1 mês" },
      ]),
      data("data", "Data"),
    ]
  ),

  sumario_medico: secao(
    "sumario_medico", "Q", "Sumário da Avaliação Médica",
    "Resumo do médico sobre o caso. É este sumário executivo que os especialistas escolhidos recebem, depois que você concluir a seção.",
    [
      longo("queixa_professor", "1. Queixa do professor"),
      longo("avaliacao_re", "2. Avaliação do RE"),
      longo("hipotese", "3. Hipótese Diagnóstica"),
      multi("conduta", "4. Conduta (0. Não · 1. Sim)", CONDUTA_SUMARIO),
      data("data", "Data"),
    ],
    "Só o que o especialista precisa para a avaliação dele. Rascunho nunca sai do seu perfil."
  ),

  recomendacao_escola: secao(
    "recomendacao_escola", "R", "Recomendação para a Escola",
    "Orientação do médico para a escola.",
    [
      multi("recomendacoes", "Recomendação para a Escola", [
        { valor: "15", rotulo: "15. Manter seguimento com o RE" },
        { valor: "16", rotulo: "16. Ter agente de apoio" },
        { valor: "17", rotulo: "17. Frequentar AEE" },
        { valor: "18", rotulo: "18. Outra" },
      ]),
      curto("outra", "Outra recomendação"),
      data("data", "Data"),
    ]
  ),
};

export function isMdFormId(v: string): v is MdFormId {
  return (MD_FORM_IDS as readonly string[]).includes(v);
}

/** Instrumentos externos do capítulo médico: o sistema só guarda o resultado anexado (aba "Exames e anexos"). */
export const MD_INSTRUMENTOS_EXTERNOS = [
  { id: "snap_iv", nome: "SNAP-IV", motivo: "Está no fluxo do RE (18 itens). No capítulo médico é o Formulário H, anexo da seção M." },
  { id: "aso", nome: "ASO / ASQ", motivo: "ASQ (se já responderam o M-CHAT) e ASO (40 itens, ANEXOS cap MD 2109): versão e licença a confirmar. Anexe o resultado autorizado em “Exames e anexos”." },
  { id: "meem", nome: "MEEM", motivo: "Anexo II: pode ser aplicado nos familiares quando houver dúvida sobre a compreensão. Anexe o resultado em “Exames e anexos”." },
] as const;

const NUMERO_RE = /^\d{1,4}([.,]\d{1,2})?$/;

function normalizarCampo(c: MdCampo, v: unknown): string {
  switch (c.tipo) {
    case "genograma":
      return normalizarGenogramaTexto(v);
    case "data":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : "";
    case "numero": {
      const t = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
      return NUMERO_RE.test(t) ? t : "";
    }
    case "escolha": {
      const t = typeof v === "string" ? v.trim() : "";
      return c.opcoes?.some((o) => o.valor === t) ? t : "";
    }
    case "multi": {
      const marcados = new Set((typeof v === "string" ? v.split(",") : Array.isArray(v) ? v.map(String) : []).map((x) => x.trim()));
      let validos = (c.opcoes ?? []).map((o) => o.valor).filter((x) => marcados.has(x));
      if (c.exclusivo && validos.includes(c.exclusivo) && validos.length > 1) validos = [c.exclusivo];
      return validos.join(",");
    }
    default:
      return typeof v === "string" ? v.slice(0, c.max) : "";
  }
}

/**
 * Registros salvos com um catálogo anterior. A seção I já teve 6 células de CID 10 e 6 de CID 11
 * (`cid10_1..6`, `cid11_1..6`); hoje são dois campos. O texto antigo é dobrado nos campos novos
 * (valores não vazios, separados por "; ") para o médico não perder o que digitou.
 */
function dobrarChavesLegadas(id: MdFormId, origem: Record<string, unknown>): Record<string, unknown> {
  if (id !== "hipotese_diagnostica") return origem;
  const saida = { ...origem };
  for (const base of ["cid10", "cid11"] as const) {
    const atual = typeof saida[base] === "string" ? (saida[base] as string).trim() : "";
    if (atual) continue;
    const partes = [1, 2, 3, 4, 5, 6]
      .map((n) => origem[`${base}_${n}`])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    if (partes.length > 0) saida[base] = partes.join("; ").slice(0, CID_MAX);
  }
  return saida;
}

/** Limpa o payload recebido: só campos conhecidos, cada um no seu formato. Em branco fica em branco. */
export function normalizarPayloadMedico(id: MdFormId, bruto: unknown): Record<string, string> {
  const form = MD_FORMS[id];
  const origem = dobrarChavesLegadas(id, bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {});
  const saida: Record<string, string> = {};
  for (const c of form.campos) saida[c.id] = normalizarCampo(c, origem[c.id]);
  return saida;
}

/** Pelo menos um campo preenchido. */
export function medicoTemConteudo(payload: Record<string, string>): boolean {
  return Object.values(payload).some((v) => v.trim().length > 0);
}

/** Texto de uma resposta, com o rótulo da opção (para leitura e para o sumário executivo). */
export function respostaMedicoLegivel(c: MdCampo, valor: string): string {
  if (!valor) return "";
  if (c.tipo === "escolha") return c.opcoes?.find((o) => o.valor === valor)?.rotulo ?? "";
  if (c.tipo === "multi") {
    const s = new Set(valor.split(","));
    return (c.opcoes ?? []).filter((o) => s.has(o.valor)).map((o) => o.rotulo).join("; ");
  }
  return valor;
}

/**
 * Sumário executivo do médico em texto corrido, para o especialista. Lê o formulário Q campo a campo;
 * aceita também o formato antigo (um único campo "registro").
 */
export function sumarioMedicoComoTexto(payload: Record<string, unknown> | null | undefined): string {
  const p = payload ?? {};
  const partes: string[] = [];
  if (typeof p.registro === "string" && p.registro.trim()) partes.push(p.registro.trim());
  for (const c of MD_FORMS.sumario_medico.campos) {
    if (c.tipo === "genograma") continue;
    const t = respostaMedicoLegivel(c, typeof p[c.id] === "string" ? (p[c.id] as string) : "");
    if (t.trim()) partes.push(`${c.rotulo}: ${t.trim()}`);
  }
  return partes.join("\n\n");
}
