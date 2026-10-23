/**
 * Jornada do RE (Responsável Escolar) — Formulários A a I.
 *
 * Fonte: "Avaliação e Intervenção do Pedagogo Responsável Escolar (RE) pela observação e avaliação
 * do aluno com dificuldade persistente" (Cap RE ESCOLAR Plataforma 1809), formulários A a I.
 * A ordem de apresentação é A → B → C → D → E → F → G (opcional) → H → I, em um formulário único e contínuo
 * (sem bloqueio entre blocos). Ao enviar, o sistema lista o que ficou em branco e o RE decide se envia assim mesmo.
 *
 * Regras de produto (não mudar sem validação clínica):
 *  - só o que está no PDF; nenhum campo clínico inventado;
 *  - em branco continua em branco (nunca vira "não");
 *  - escores e classificações são digitados pelo profissional; o sistema não calcula nem diagnostica;
 *  - o aluno aparece só pelo código (sem nome). Campos do PDF que pedem nome de adulto, telefone ou
 *    nome da criança foram omitidos de propósito (ver `omitidosPorPrivacidade`).
 *
 * G (SNAP-IV) usa o catálogo `snap4-catalog`; H (ATA) usa `tea-catalog`; I (Sumário) usa o
 * `secao_sumario` do FOGAP (`fogap-catalog`). Os formulários A a F são definidos aqui, como dados,
 * e a mesma definição serve ao backend (validação), ao formulário do RE e à leitura do médico.
 */

import { SNAP4_ITENS } from "./snap4-catalog";
import { GENOGRAMA_JSON_MAX, lerGenograma, normalizarGenogramaTexto } from "./genograma";

export const RE_JORNADA_FORM_CODE = "re_jornada" as const;
export const RE_JORNADA_VERSION = "1.0.0-rascunho" as const;
export const RE_TEXTO_MAX = 2000;

export type RePassoId = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i";

/** Formulários cujos campos são definidos neste arquivo. */
export type ReFormId = "a" | "b" | "c" | "d" | "e" | "f";

export interface ReOpcao {
  value: string;
  label: string;
  /** Quando marcada, pede um texto complementar (ex.: "Sim. Quais?"). Guardado em `<campo>__texto`. */
  pedeTexto?: string;
}

export const OPCOES_NAO_SIM: ReOpcao[] = [
  { value: "nao", label: "Não" },
  { value: "sim", label: "Sim" },
];

export const OPCOES_NAO_SIM_AS_VEZES: ReOpcao[] = [
  { value: "nao", label: "Não" },
  { value: "sim", label: "Sim" },
  { value: "as_vezes", label: "Às vezes" },
];

export const OPCOES_RISCO_LEITURA: ReOpcao[] = [
  { value: "alto_risco", label: "Alto risco" },
  { value: "medio_risco", label: "Médio risco" },
  { value: "sem_risco", label: "Sem risco" },
];

interface CampoBase {
  /** Chave estável no payload (snake_case). Nunca renomear depois de ir para produção. */
  key: string;
  label: string;
  ajuda?: string;
  /** Campo que pode ficar em branco sem aparecer na lista de pendências (ex.: observações finais). */
  opcional?: boolean;
}

export interface CampoTexto extends CampoBase {
  tipo: "texto";
}

export interface CampoTextoLongo extends CampoBase {
  tipo: "texto_longo";
}

/** Escolha única. */
export interface CampoUnica extends CampoBase {
  tipo: "unica";
  opcoes: ReOpcao[];
  /** Mantém escolha única mesmo com 3 ou mais opções (ex.: sexo, faixa de alunos). */
  exclusiva?: boolean;
  /** Campo de observação (`<campo>__obs`). Ligado automaticamente com 3 ou mais opções. */
  comObs?: boolean;
}

/** Professor(a) entrevistado(a): preenchido automaticamente com o profissional da escola. Payload: `{ id, nome }`. */
export interface CampoProfessor extends CampoBase {
  tipo: "professor";
}

/** Múltipla escolha (valores em array). `outros` abre um campo de texto livre. */
export interface CampoMultipla extends CampoBase {
  tipo: "multipla";
  opcoes: ReOpcao[];
  outros?: string;
  /** Campo de observação (`<campo>__obs`). Ligado automaticamente com 3 ou mais opções (exceto quando há "outros"). */
  comObs?: boolean;
}

/**
 * Tabela: cada linha recebe uma resposta (e, opcionalmente, observação e/ou um número).
 * Payload: `{ [linha.key]: { r?: string|string[]|null, obs?: string, n?: number|null } }`.
 * Com 3 ou mais opções a linha aceita várias respostas (array) e ganha campo de observação.
 */
export interface CampoMatriz extends CampoBase {
  tipo: "matriz";
  linhas: { key: string; label: string }[];
  opcoes: ReOpcao[];
  comObs?: boolean;
  /** Linha com várias respostas (ligado automaticamente com 3 ou mais opções). */
  multipla?: boolean;
  /** Mantém uma resposta por linha mesmo com 3 ou mais opções (classificação do instrumento). */
  exclusiva?: boolean;
  /** Se informado, cada linha tem um campo numérico (ex.: "Total de acertos"). */
  comNumero?: string;
}

/** Genograma desenhado por parentesco (ver `genograma.ts`). Payload: texto JSON curto; em branco = sem desenho. */
export interface CampoGenograma extends CampoBase {
  tipo: "genograma";
}

export type ReCampo = CampoTexto | CampoTextoLongo | CampoUnica | CampoMultipla | CampoMatriz | CampoProfessor | CampoGenograma;

export interface ReSecao {
  id: string;
  titulo: string;
  descricao?: string;
  campos: ReCampo[];
}

/**
 * Definição genérica de formulário (campos como dados). O RE usa A–F; médico e especialistas usam o mesmo motor
 * (`especialidades-catalog.ts`, `medico-forms-catalog.ts`): mesma tela, mesma validação, nenhum campo clínico novo.
 */
export interface FormDef {
  id: string;
  /** Código do instrumento em `re_assessments.form_code`. */
  code: string;
  letra: string;
  titulo: string;
  /** Curto, para o passo a passo. */
  tituloCurto: string;
  /** Quem é a pessoa entrevistada/observada (para a frase de apoio na tela). */
  dica: string;
  secoes: ReSecao[];
  /** Itens do PDF que NÃO foram transcritos e o motivo. Para a equipe clínica/LGPD validar. */
  pendenciasDeValidacao: string[];
}

export interface ReFormDef extends FormDef {
  id: ReFormId;
}

const t = (key: string, label: string, ajuda?: string): CampoTexto => ({ key, label, ajuda, tipo: "texto" });
const tl = (key: string, label: string, ajuda?: string): CampoTextoLongo => ({ key, label, ajuda, tipo: "texto_longo" });
const u = (key: string, label: string, opcoes: ReOpcao[], ajuda?: string): CampoUnica => ({ key, label, ajuda, tipo: "unica", opcoes });
const m = (key: string, label: string, opcoes: ReOpcao[], outros?: string, ajuda?: string): CampoMultipla => ({
  key,
  label,
  ajuda,
  tipo: "multipla",
  opcoes,
  outros,
});
const o = (value: string, label: string, pedeTexto?: string): ReOpcao => ({ value, label, pedeTexto });
const linhas = (...itens: [string, string][]) => itens.map(([key, label]) => ({ key, label }));

/** Construtores de campos para os catálogos das especialidades (mesmo motor, sem repetir código). */
export const FORM_BUILDERS = { t, tl, u, m, o, linhas } as const;

const OBS_FINAL: ReSecao = {
  id: "observacoes",
  titulo: "Observações",
  campos: [{ ...tl("observacoes", "Observações"), opcional: true }],
};

const SEXO: CampoUnica = {
  ...u("sexo", "Sexo", [o("f", "Feminino"), o("m", "Masculino"), o("nao_informado", "Prefiro não informar")]),
  exclusiva: true,
};
/** Série, escola, nascimento e idade vêm do cadastro do aluno (não se digita nos formulários). */
const PROFESSOR: CampoProfessor = {
  key: "professor",
  label: "Professor(a) entrevistado(a)",
  ajuda: "Preenchido automaticamente com o professor da escola.",
  tipo: "professor",
};

// ── Formulário A — Entrevista Inicial com Aluno do Ensino Fundamental I (6–9) ──────────────────

const FORM_A: ReFormDef = {
  id: "a",
  code: "re_form_a",
  letra: "A",
  titulo: "Formulário A — Entrevista inicial com o aluno (Ensino Fundamental I, 6 a 9 anos)",
  tituloCurto: "Entrevista com o aluno",
  dica: "Converse com o aluno e registre o que ele disser, com as palavras dele. Não escreva nomes de pessoas.",
  pendenciasDeValidacao: [
    "Campo \"Professor\" do cabeçalho do A omitido (nome de adulto). Confirmar com o responsável clínico/LGPD.",
    "Série e escola não são digitadas: vêm do cadastro do aluno (editável com auditoria).",
    "O PDF numera de novo \"1.\" em Desenvolvimento Global após Aspecto Intelectual; mantida a ordem do documento.",
    "As colunas Não/Sim/Observações aparecem só no início da tabela de Desenvolvimento Global; aplicadas também às demais tabelas (Jogo, Linguagem Matemática, Oral, Escrita, Espaço e Tempo). Confirmar.",
  ],
  secoes: [
    {
      id: "cabecalho",
      titulo: "Identificação",
      descricao: "Aluno, escola, série e nascimento vêm do cadastro. Nome do aluno não é registrado; o sistema usa só o código.",
      campos: [SEXO],
    },
    {
      id: "entrevista",
      titulo: "Conversa com o aluno",
      campos: [
        t("quem_mora_casa", "Quem mora na sua casa?", "Escreva só o parentesco (ex.: mãe, avó, irmão), sem nomes."),
        u("pai_trabalha", "Pai trabalha?", [o("nao", "Não"), o("sim", "Sim", "Onde?")]),
        u("mae_trabalha", "Mãe trabalha?", [o("nao", "Não"), o("sim", "Sim", "Onde?")]),
        tl("como_e_pai", "Como é o pai?"),
        tl("como_e_mae", "Como é a mãe?"),
        tl("mais_gosta_casa", "Do que você mais gosta na sua casa?"),
        tl("menos_gosta_casa", "Do que você menos gosta na sua casa?"),
        tl("amigos", "Quem são seus amigos?", "Sem nomes completos."),
        u("gosta_escola", "Você gosta da escola?", OPCOES_NAO_SIM_AS_VEZES),
        tl("mais_gosta_escola", "Do que você mais gosta na escola?"),
        tl("menos_gosta_escola", "Do que você menos gosta na escola?"),
        tl("dificuldade_escola", "Você tem alguma dificuldade na escola?"),
        tl("como_e_professora", "Como é sua professora?"),
      ],
    },
    {
      id: "aspecto_intelectual",
      titulo: "Aspecto intelectual",
      campos: [
        {
          key: "expressao_oral",
          label: "1. Expressão oral",
          tipo: "matriz",
          opcoes: OPCOES_NAO_SIM_AS_VEZES,
          linhas: linhas(
            ["vocabulario", "Usa vocabulário adequado à idade"],
            ["pronuncia", "Pronuncia corretamente as palavras"],
            ["logica_clareza", "Expressa-se de forma lógica e clara"],
            ["recados", "Consegue transmitir recados"]
          ),
        },
        {
          key: "atitudes",
          label: "2. Atitudes",
          tipo: "matriz",
          opcoes: OPCOES_NAO_SIM_AS_VEZES,
          linhas: linhas(
            ["atenta_instrucoes", "Atenta às instruções, faz o que é pedido"],
            ["tempo_razoavel", "Completa as atividades em tempo razoável"],
            ["licoes_organizadas", "Apresenta as lições completas e organizadas"],
            ["persistente", "É persistente"]
          ),
        },
      ],
    },
    {
      id: "desenvolvimento_global",
      titulo: "1. Desenvolvimento global",
      campos: [
        {
          key: "desenvolvimento_global",
          label: "Aspectos avaliados",
          tipo: "matriz",
          opcoes: OPCOES_NAO_SIM,
          comObs: true,
          linhas: linhas(
            ["postura", "Postura"],
            ["alimentacao", "Alimentação"],
            ["fala", "Fala"],
            ["locomocao", "Locomoção"],
            ["adaptacao", "Adaptação"],
            ["comportamento", "Comportamento"],
            ["socializacao", "Socialização"]
          ),
        },
      ],
    },
    {
      id: "jogo",
      titulo: "2. Jogo (memória ou dominó) ou jogo de raciocínio simples (perfil)",
      campos: [
        {
          key: "jogo",
          label: "Durante o jogo",
          tipo: "matriz",
          opcoes: OPCOES_NAO_SIM,
          comObs: true,
          linhas: linhas(
            ["regras", "Compreensão de regras"],
            ["planejamento", "Planejamento e organização"],
            ["memoria", "Memória"],
            ["atencao", "Atenção"],
            ["raciocinio", "Raciocínio"]
          ),
        },
      ],
    },
    {
      id: "matematica",
      titulo: "3. Linguagem matemática (com material concreto)",
      campos: [
        {
          key: "linguagem_matematica",
          label: "Aspectos avaliados",
          tipo: "matriz",
          opcoes: OPCOES_NAO_SIM,
          comObs: true,
          linhas: linhas(
            ["maior_quantidade", "Maior quantidade"],
            ["menor_quantidade", "Menor quantidade"],
            ["reconhece_numeros", "Reconhecimento dos números"],
            ["sequenciacao", "Sequenciação (1º e último)"],
            ["problemas", "Resolução de problemas orais e escritos"]
          ),
        },
      ],
    },
    {
      id: "oral",
      titulo: "4. Linguagem oral",
      campos: [
        {
          key: "linguagem_oral",
          label: "Aspectos avaliados",
          tipo: "matriz",
          opcoes: OPCOES_NAO_SIM,
          comObs: true,
          linhas: linhas(
            ["desenvolvimento_fala", "Desenvolvimento da fala"],
            ["compreensao_verbal", "Compreensão verbal"],
            ["organizacao_discurso", "Organização do discurso"],
            ["consciencia_fonologica", "Sinais de alteração na consciência fonológica"]
          ),
        },
      ],
    },
    {
      id: "escrita",
      titulo: "5. Linguagem escrita",
      campos: [
        {
          key: "linguagem_escrita",
          label: "Aspectos avaliados",
          tipo: "matriz",
          opcoes: OPCOES_NAO_SIM,
          comObs: true,
          linhas: linhas(
            ["alfabeto", "Conhecimento do alfabeto"],
            ["leitura_palavras", "Leitura de palavras"],
            ["fluencia", "Fluência leitora"],
            ["compreensao_leitora", "Compreensão leitora"],
            ["ortografia", "Ortografia"],
            ["producao_escrita", "Produção escrita"]
          ),
        },
      ],
    },
    {
      id: "espaco_tempo",
      titulo: "6. Noção de espaço e tempo",
      campos: [
        {
          key: "espaco_tempo",
          label: "Aspectos avaliados",
          tipo: "matriz",
          opcoes: OPCOES_NAO_SIM,
          comObs: true,
          linhas: linhas(
            ["sala_aula", "Sala de aula (localização/organização espacial)"],
            ["dia_mes", "Dia do mês"],
            ["dia_semana", "Dia da semana"],
            ["aniversario", "Aniversário"],
            ["ontem_hoje", "Ontem e hoje"],
            ["endereco_referencia", "Endereço ou referência"],
            ["distancia_casa_escola", "Distância da casa à escola"]
          ),
        },
      ],
    },
    OBS_FINAL,
  ],
};

// ── Formulário B — Entrevista com o Professor ───────────────────────────────────────────────────

const FORM_B: ReFormDef = {
  id: "b",
  code: "re_form_b",
  letra: "B",
  titulo: "Formulário B — Entrevista com o professor",
  tituloCurto: "Entrevista com o professor",
  dica: "Pergunte ao professor e marque o que ele responder. Não escreva o nome do professor nem do aluno.",
  pendenciasDeValidacao: [
    "O nome do professor entrevistado vem automaticamente do cadastro de profissionais da escola (decisão de 19/out). Confirmar com o responsável clínico/LGPD que isso pode aparecer no formulário.",
  ],
  secoes: [
    { id: "cabecalho", titulo: "Professor(a)", campos: [PROFESSOR] },
    {
      id: "queixas",
      titulo: "Queixas e desempenho",
      campos: [
        u("queixas_aprendizagem", "Você tem queixas quanto à aprendizagem dele?", [o("nao", "Não"), o("sim", "Sim", "Quais?")]),
        u("desempenho_aula", "Como é o desempenho dele na aula?", [o("otimo", "Ótimo"), o("bom", "Bom"), o("regular", "Regular"), o("ruim", "Ruim")]),
        { ...u("alunos_turma", "Quantos alunos tem a sua turma?", [o("ate_20", "Até 20"), o("21_30", "21 a 30"), o("31_40", "31 a 40"), o("mais_40", "Mais de 40")]), exclusiva: true },
      ],
    },
    {
      id: "trabalho",
      titulo: "Trabalho pedagógico",
      campos: [
        u("trabalho_adaptado", "É feito algum trabalho adaptado?", [o("nao", "Não"), o("sim", "Sim", "Qual?")]),
        m(
          "materiais",
          "Quais são os materiais utilizados para aquele com mais dificuldade?",
          [
            o("apostilas", "Apostilas"),
            o("atividades_ludicas", "Atividades lúdicas"),
            o("atividades_impressas", "Atividades impressas"),
            o("copia_lousa", "Cópia da lousa"),
            o("desenhos", "Desenhos"),
            o("livro", "Livro"),
            o("recursos_visuais", "Recursos visuais"),
          ],
          "Outros. Quais?"
        ),
        u(
          "orienta_trabalho",
          "Quem orienta o trabalho pedagógico?",
          [o("coordenador", "O coordenador pedagógico"), o("vice_diretor", "O vice-diretor"), o("diretor", "O diretor"), o("outros", "Outros", "Quem?")]
        ),
        m(
          "aspectos_atividades",
          "Quais são os aspectos que considera ao elaborar as atividades para o aluno?",
          [
            o("nivel_aprendizado_atual", "Nível de aprendizado em que o indivíduo está"),
            o("nivel_relacional", "Nível relacional do indivíduo"),
            o("nivel_aprendizado_alvo", "Nível de aprendizado que o indivíduo deve alcançar"),
            o("nivel_linguagem", "Nível de linguagem do indivíduo"),
            o("nivel_cognitivo", "Nível cognitivo do indivíduo"),
            o("nivel_motor", "Nível motor do indivíduo"),
          ],
          "Outros. Quais?"
        ),
        u(
          "avaliacao_turma",
          "De que forma são feitas as avaliações para a turma toda?",
          [o("escrito", "De modo escrito"), o("oral", "De modo oral"), o("oral_escrito", "De modo oral e escrito"), o("outro", "De outro modo", "Qual?")]
        ),
        u(
          "avaliacao_dificuldade",
          "De que forma são feitas as avaliações para aquele com dificuldade?",
          [o("mesma", "É aplicada a mesma avaliação feita para os demais"), o("diferenciada", "É aplicada uma avaliação diferenciada", "Qual?")]
        ),
        u(
          "lugar_sentado",
          "Em que lugar o aluno está sentado?",
          [
            o("frente_perto", "Na frente, perto da porta ou da janela"),
            o("frente_longe", "Na frente, longe da porta ou da janela"),
            o("meio", "No meio"),
            o("fundo", "No fundo"),
          ]
        ),
      ],
    },
    {
      id: "relacao",
      titulo: "Relação com o aluno e intervenções",
      campos: [
        u(
          "atencao_exigida",
          "Como é o seu relacionamento com ele? (atenção exigida)",
          [o("mais_atencao", "Exige mais atenção"), o("mesma_atencao", "Exige a mesma atenção que os demais")]
        ),
        u(
          "relacionamento",
          "Como é o seu relacionamento com ele? (qualidade)",
          [o("positivo", "Apresenta aspectos positivos"), o("dificuldades", "Apresenta dificuldades no relacionamento")]
        ),
        u("outras_intervencoes", "Foram realizadas outras intervenções diferenciadas com o aluno?", [o("nao", "Não"), o("sim", "Sim", "Quais?")]),
        u("houve_resultado", "Em caso positivo, houve algum resultado?", [o("nao", "Não"), o("sim", "Sim", "Qual?")]),
        m(
          "potencialidades",
          "Quais as maiores potencialidades observadas nele?",
          [o("atencao", "Atenção"), o("capricho", "Capricho"), o("dedicacao", "Dedicação"), o("inquiricao", "Inquirição"), o("inteligencia", "Inteligência")],
          "Outras. Quais?"
        ),
        m(
          "dificuldades",
          "Quais as maiores dificuldades observadas?",
          [
            o("demora_assimilar", "Demora a assimilar o conteúdo"),
            o("nao_mantem_atencao", "Não mantém a atenção"),
            o("desiste_logo", "Desiste logo das atividades quando sente dificuldade"),
            o("conversa_muito", "Conversa muito em sala de aula"),
            o("nao_participa", "Não participa das aulas, não esclarece as dúvidas"),
            o("quieto_demais", "É quieto demais"),
            o("nao_compreende_comandos", "Não compreende comandos com facilidade"),
            o("pertences_desorganizados", "Não mantém seus pertences organizados"),
            o("sem_leitura_mundo", "Não faz leitura de mundo"),
          ],
          "Outras. Quais?"
        ),
        u("trabalhou_antes", "Já trabalhou com o aluno antes?", OPCOES_NAO_SIM),
      ],
    },
    OBS_FINAL,
  ],
};

// ── Formulário C — Entrevista com a Família ─────────────────────────────────────────────────────

const FORM_C: ReFormDef = {
  id: "c",
  code: "re_form_c",
  letra: "C",
  titulo: "Formulário C — Entrevista com a família",
  tituloCurto: "Entrevista com a família",
  dica: "Pergunte ao responsável e registre as respostas. Não escreva nome nem telefone da família.",
  pendenciasDeValidacao: [
    "Campos \"Responsável\" (nome) e \"Contato\" omitidos (identificadores diretos). Se a equipe precisar deles, guardar no Cofre de Identidade, não no formulário.",
    "Genograma: o PDF pede para completar uma figura ao final. Há um editor por parentesco (biblioteca @famtree) e a descrição em texto; o modelo do genograma (parentescos, símbolos, quem preenche) NAO IMPLEMENTAR ATE VALIDACAO além do que já está.",
    "\"Programas vinculados pela PMT\": sigla PMT mantida como no PDF (confirmar significado com a equipe).",
  ],
  secoes: [
    {
      id: "cabecalho",
      titulo: "Identificação",
      campos: [t("parentesco", "Parentesco do responsável com o aluno", "Ex.: mãe, pai, avó. Sem nome.")],
    },
    {
      id: "gestacao_desenvolvimento",
      titulo: "Gestação e desenvolvimento",
      campos: [
        tl("gestacao", "Como foi a gestação?"),
        t("tipo_parto", "Tipo de parto"),
        tl("intercorrencia", "Houve alguma intercorrência?"),
        t("mamou_ate_quando", "Mamou no peito? Até quando?"),
        t("idade_sustentou_cabeca", "Com que idade sustentou a cabeça?"),
        t("idade_sentou", "Com que idade se sentou?"),
        t("idade_engatinhou", "Com que idade engatinhou?"),
        t("forma_engatinhar", "Forma de engatinhar"),
        t("idade_andou", "Com que idade começou a andar?"),
        t("idade_parou_fraldas", "Com que idade parou de usar fraldas?"),
        t("idade_falou", "Com que idade começou a falar?"),
      ],
    },
    {
      id: "rotina",
      titulo: "Rotina e hábitos",
      campos: [
        tl("sono", "Como é o sono?"),
        t("hora_dorme", "A que horas dorme?", "Ex.: 21h"),
        t("hora_acorda", "A que horas acorda?", "Ex.: 6h30"),
        u("cai_muito", "Cai muito?", OPCOES_NAO_SIM_AS_VEZES),
        u("esbarra", "Esbarra nos outros constantemente?", OPCOES_NAO_SIM_AS_VEZES),
        u("chupeta", "Usa chupeta?", OPCOES_NAO_SIM_AS_VEZES),
        u("mamadeira", "Usa mamadeira?", OPCOES_NAO_SIM_AS_VEZES),
        u("controle_esfincteriano", "Tem controle esfincteriano?", OPCOES_NAO_SIM_AS_VEZES),
      ],
    },
    {
      id: "escola_familia",
      titulo: "Escola e vida em família",
      campos: [
        t("idade_foi_escola", "Com que idade foi para a escola?"),
        tl("adaptacao_escola", "Como foi a adaptação?"),
        u("outra_escola", "Já frequentou outra escola?", OPCOES_NAO_SIM),
        u("pertences_organizados", "Mantém seus pertences organizados?", OPCOES_NAO_SIM),
        u("relaciona_criancas", "Relaciona-se com outras crianças?", OPCOES_NAO_SIM),
        t("tempo_eletronicos", "Passa quanto tempo por dia com aparelhos eletrônicos (TV, computador, tablet, celular, videogame)?"),
        tl("busca_livros", "A criança busca livros em casa, mesmo que seja para ver as imagens?"),
        tl("licao_sozinha", "Ela consegue fazer a lição sozinha ou precisa sempre de ajuda?"),
        tl("outra_atividade", "A criança está inserida em outra atividade além da escola? Se sim, qual?"),
        u("reunioes_escolares", "Você participa das reuniões escolares?", [o("sempre", "Sempre"), o("de_vez_em_quando", "De vez em quando"), o("nunca", "Nunca")]),
      ],
    },
    {
      id: "conversa_escola",
      titulo: "Conversa com a escola e contexto familiar",
      campos: [
        u("chamado_conversa", "Você já foi chamado para conversar em particular sobre sua criança?", OPCOES_NAO_SIM),
        t("quando_conversa", "Quando?"),
        tl("assunto_conversa", "Essa conversa foi sobre o quê?"),
        u("sentiu_acolhido", "Nessa conversa você sentiu-se acolhido?", OPCOES_NAO_SIM),
        u("percebe_dificuldade", "Você percebe alguma dificuldade de aprendizagem em sua criança?", [o("nao", "Não"), o("sim", "Sim", "Qual?")]),
        u("programas_pmt", "A família está inserida em programas vinculados pela PMT?", [o("nao", "Não"), o("sim", "Sim", "Quais?")]),
        u("pcd_familia", "Há pessoa com deficiência (PCD) na família?", [o("nao", "Não"), o("sim", "Sim", "Qual?")]),
        u("medicacao_controlada", "Algum familiar faz uso de medicação controlada?", [o("nao", "Não"), o("sim", "Sim", "Qual?")]),
        u("residiu_outro_municipio", "A família já residiu em outro município?", OPCOES_NAO_SIM),
      ],
    },
    {
      id: "escolaridade",
      titulo: "Níveis de escolaridade",
      campos: [
        t("escolaridade_mae", "Mãe"),
        t("escolaridade_pai", "Pai"),
        t("escolaridade_outro", "Outro responsável"),
      ],
    },
    {
      // O desenho do genograma saiu do fluxo do RE (23/out): só o médico monta o genograma.
      // Aqui fica apenas o relato de antecedentes familiares em texto, que a família traz ao RE.
      id: "antecedentes_familiares",
      titulo: "Antecedentes familiares",
      descricao: "Registre em texto o que o responsável informou sobre antecedentes da família. O genograma é montado depois pelo médico.",
      campos: [
        tl("genograma_texto", "Antecedentes familiares informados (descrição em texto)", "Sem nomes. Ex.: \"avô materno com ...\"."),
      ],
    },
    OBS_FINAL,
  ],
};

// ── Formulário D — Observação do aluno na sala de aula e nas demais áreas da escola ─────────────

const ASPECTOS_FUNCIONAIS = linhas(
  ["timidez", "Mostra timidez"],
  ["agressivo", "Mostra-se agressivo"],
  ["alegria", "Demonstra alegria"],
  ["chora_facilmente", "Chora com facilidade"],
  ["afeto", "Demonstra afeto, carinho"],
  ["solicita_afeto", "Solicita afeto"],
  ["dependencia", "Mostra dependência"],
  ["agitacao", "Mostra agitação"],
  ["reage_contrariado", "Costuma reagir quando contrariado"],
  ["seguranca_novas", "Mostra segurança diante de situações novas"],
  ["seguranca_tarefas", "Mostra segurança na realização das tarefas"]
);

const FORM_D: ReFormDef = {
  id: "d",
  code: "re_form_d",
  letra: "D",
  titulo: "Formulário D — Observação do aluno na sala de aula e nas demais áreas da escola",
  tituloCurto: "Observação na escola",
  dica: "Marque o que você viu. Se não observou, deixe em branco: em branco não vale como \"não\".",
  pendenciasDeValidacao: [
    "Bloco de identificação removido do D (fica só no A). Série, escola e nascimento vêm do cadastro do aluno.",
    "Escrita \"Demostra alegria\" do PDF corrigida para \"Demonstra alegria\".",
  ],
  secoes: [
    {
      id: "sala",
      titulo: "1. Aspecto funcional na sala de aula",
      campos: [{ key: "sala_aula", label: "Observado em sala de aula", tipo: "matriz", opcoes: OPCOES_NAO_SIM_AS_VEZES, linhas: ASPECTOS_FUNCIONAIS }],
    },
    {
      id: "demais",
      titulo: "2. Aspecto funcional nos demais ambientes escolares",
      campos: [{ key: "demais_ambientes", label: "Observado nos demais ambientes (pátio, refeitório, quadra...)", tipo: "matriz", opcoes: OPCOES_NAO_SIM_AS_VEZES, linhas: ASPECTOS_FUNCIONAIS }],
    },
    OBS_FINAL,
  ],
};

// ── Formulário E — Síntese da OPmE ─────────────────────────────────────────────────────────────

const ADEQ3 = [o("adequada", "Adequada"), o("inadequada", "Inadequada"), o("muito_inadequada", "Muito inadequada")];

const FORM_E: ReFormDef = {
  id: "e",
  code: "re_form_e",
  letra: "E",
  titulo: "Formulário E — Síntese da OPmE",
  tituloCurto: "Síntese da OPmE",
  dica: "Marque uma opção em cada bloco, conforme o que você observou. Em branco continua em branco.",
  pendenciasDeValidacao: [
    "Sigla OPmE: o PDF não a explica. Confirmar o significado com a equipe clínica antes de exibir por extenso.",
    "Preensão: o PDF traz \"Direita/Esquerda\" com os textos \"Pega com a mão D e escreve com a E\" / \"Pega com a mão E e escreve com a D\". Mantidos os dois textos como estão; confirmar a leitura clínica.",
    "Traçado: o PDF lista Instabilidade, Estabilidade, Ansiedade e Sincinesias em uma linha; tratado como múltipla escolha. Confirmar se é escolha única.",
  ],
  secoes: [
    {
      id: "grafomotricidade",
      titulo: "Corpo, preensão e traçado",
      campos: [
        u("figura_corpo", "Figura do corpo", ADEQ3),
        u("preensao", "Preensão", [
          o("direita", "Direita — pega com a mão D e escreve com a E"),
          o("esquerda", "Esquerda — pega com a mão E e escreve com a D"),
        ]),
        u("mao_apoio", "Mão de apoio", [o("presente", "Presente"), o("ausente", "Ausente")]),
        u("preensao_funcional", "Preensão funcional", [o("presente", "Presente"), o("ausente", "Ausente")]),
        u("qualidade", "Qualidade", ADEQ3),
        u("tonicidade", "Tonicidade", [
          o("adequada", "Adequada"),
          o("fraca", "Fraca"),
          o("forte", "Forte"),
          o("variavel", "Variável"),
          o("excessiva", "Excessiva"),
        ]),
        m("tracado", "Traçado", [o("instabilidade", "Instabilidade"), o("estabilidade", "Estabilidade"), o("ansiedade", "Ansiedade"), o("sincinesias", "Sincinesias")]),
        u("qualidade_tracado", "Qualidade do traçado", [o("adequada", "Adequada"), o("inadequada", "Inadequada")]),
      ],
    },
    {
      id: "lateralidade_espaco",
      titulo: "Lateralidade e orientação espacial",
      campos: [
        u("lateralidade", "Lateralidade", [o("direita", "Direita"), o("esquerda", "Esquerda"), o("indefinida", "Indefinida")]),
        u("dominancia_lateral", "Dominância lateral", [
          o("destra", "Destra"),
          o("canhota", "Canhota"),
          o("contrariada", "Contrariada"),
          o("cruzada", "Cruzada"),
          o("ambidestra", "Ambidestra"),
        ]),
        u("orientacao_espacial", "Orientação espacial", [
          o("nao_realiza", "Não realiza a trajetória"),
          o("muitas_interrupcoes", "Realiza a trajetória com frequentes interrupções"),
          o("algumas_interrupcoes", "Realiza a trajetória com algumas interrupções"),
          o("perfeita", "Realiza a trajetória de maneira perfeita e bem orientada"),
        ]),
      ],
    },
    OBS_FINAL,
  ],
};

// ── Formulário F — IPPL-R (Identificação Precoce dos Problemas de Leitura) ───────────────────────

const FORM_F: ReFormDef = {
  id: "f",
  code: "re_form_f",
  letra: "F",
  titulo: "Formulário F — Identificação precoce dos problemas de leitura (IPPL-R)",
  tituloCurto: "IPPL-R (leitura)",
  dica: "Digite o total de acertos de cada prova e a classificação que o próprio instrumento indica. O sistema não calcula nem classifica.",
  pendenciasDeValidacao: [
    "Direitos de uso e versão do IPPL-R a confirmar antes de produção (instrumento externo). Aqui só se registra o resultado digitado pelo profissional; as provas e o ponto de corte NÃO estão no sistema.",
    "Bloco de identificação removido do F (fica só no A). \"Escola\" vem do cadastro; \"Aplicador\" é o RE logado (sem nome na tela).",
    "O PDF traz o quadro \"Risco para problemas de leitura / Sem risco\" e três linhas de classificação geral; transcritas como escolhas simples. Confirmar a regra de preenchimento com o responsável clínico.",
  ],
  secoes: [
    {
      id: "aplicacao",
      titulo: "Aplicação",
      campos: [t("data_aplicacao", "Data da aplicação", "Escolha a data em que a prova foi aplicada.")],
    },
    {
      id: "provas",
      titulo: "Provas",
      campos: [
        {
          key: "provas",
          label: "Total de acertos e classificação por prova",
          tipo: "matriz",
          opcoes: OPCOES_RISCO_LEITURA,
          exclusiva: true,
          comObs: true,
          comNumero: "Total de acertos",
          linhas: linhas(
            ["conhecimento_alfabeto", "1. Conhecimento do alfabeto"],
            ["segmentacao_silabica", "2. Segmentação silábica"],
            ["identificacao_rima", "3. Identificação de rima"],
            ["producao_palavras_fonema", "4. Produção de palavras a partir do fonema dado"],
            ["memoria_operacional_fonologica", "5. Memória operacional fonológica"],
            ["nomeacao_automatica_rapida", "6. Nomeação automática rápida"],
            ["leitura_silenciosa", "7. Leitura silenciosa"],
            ["leitura_palavras_pseudopalavras", "8. Leitura de palavras e pseudopalavras"]
          ),
        },
      ],
    },
    {
      id: "classificacao_geral",
      titulo: "Classificação geral",
      campos: [
        { ...u("risco_primeira", "Risco para problemas de leitura (1ª avaliação)", OPCOES_RISCO_LEITURA), exclusiva: true },
        { ...u("risco_segunda", "Risco para problemas de leitura (2ª avaliação, pós-intervenção)", OPCOES_RISCO_LEITURA), exclusiva: true },
        u("desenvolvimento_esperado", "Desenvolvimento dentro do esperado para a idade", OPCOES_NAO_SIM),
      ],
    },
  ],
};

/**
 * Regras de opções (pedido de 19/out):
 *  - 2 opções (Não/Sim etc.): escolha única, como no PDF;
 *  - 3 ou mais opções: várias respostas permitidas e um campo de observação;
 *  - exceções de escolha única (`exclusiva`): sexo, faixa de alunos e classificações de risco do IPPL-R,
 *    onde marcar mais de uma contradiz a própria pergunta/instrumento. Elas também ganham observação (menos o sexo).
 */
export const MIN_OPCOES_MULTIPLA = 3;

function regraDoCampo(c: ReCampo): ReCampo {
  switch (c.tipo) {
    case "unica": {
      if (c.opcoes.length < MIN_OPCOES_MULTIPLA) return c;
      if (c.exclusiva) return { ...c, comObs: c.comObs ?? c.key !== "sexo" };
      return {
        key: c.key,
        label: c.label,
        ajuda: c.ajuda,
        opcional: c.opcional,
        tipo: "multipla",
        opcoes: c.opcoes,
        comObs: c.comObs ?? true,
      };
    }
    case "multipla":
      if (c.opcoes.length < MIN_OPCOES_MULTIPLA || c.outros) return c;
      return { ...c, comObs: c.comObs ?? true };
    case "matriz":
      if (c.opcoes.length < MIN_OPCOES_MULTIPLA) return c;
      return { ...c, multipla: !c.exclusiva, comObs: c.comObs ?? true };
    default:
      return c;
  }
}

export function aplicarRegrasDeOpcoes<F extends FormDef>(form: F): F {
  return { ...form, secoes: form.secoes.map((sec) => ({ ...sec, campos: sec.campos.map(regraDoCampo) })) };
}

export const RE_FORMS: Record<ReFormId, ReFormDef> = {
  a: aplicarRegrasDeOpcoes(FORM_A),
  b: aplicarRegrasDeOpcoes(FORM_B),
  c: aplicarRegrasDeOpcoes(FORM_C),
  d: aplicarRegrasDeOpcoes(FORM_D),
  e: aplicarRegrasDeOpcoes(FORM_E),
  f: aplicarRegrasDeOpcoes(FORM_F),
};

// ── Passos da jornada ──────────────────────────────────────────────────────────────────────────

export type RePassoTipo = "formulario" | "snap4" | "ata" | "sumario";

export interface RePasso {
  id: RePassoId;
  letra: string;
  titulo: string;
  tituloCurto: string;
  tipo: RePassoTipo;
  opcional: boolean;
}

export const RE_PASSOS: RePasso[] = [
  { id: "a", letra: "A", titulo: RE_FORMS.a.titulo, tituloCurto: RE_FORMS.a.tituloCurto, tipo: "formulario", opcional: false },
  { id: "b", letra: "B", titulo: RE_FORMS.b.titulo, tituloCurto: RE_FORMS.b.tituloCurto, tipo: "formulario", opcional: false },
  { id: "c", letra: "C", titulo: RE_FORMS.c.titulo, tituloCurto: RE_FORMS.c.tituloCurto, tipo: "formulario", opcional: false },
  { id: "d", letra: "D", titulo: RE_FORMS.d.titulo, tituloCurto: RE_FORMS.d.tituloCurto, tipo: "formulario", opcional: false },
  { id: "e", letra: "E", titulo: RE_FORMS.e.titulo, tituloCurto: RE_FORMS.e.tituloCurto, tipo: "formulario", opcional: false },
  { id: "f", letra: "F", titulo: RE_FORMS.f.titulo, tituloCurto: RE_FORMS.f.tituloCurto, tipo: "formulario", opcional: false },
  { id: "g", letra: "G", titulo: "Formulário G — SNAP-IV (opcional)", tituloCurto: "SNAP-IV (opcional)", tipo: "snap4", opcional: true },
  {
    id: "h",
    letra: "H",
    titulo: "Formulário H — Escala de Traços Autísticos (ATA), respondida pelo responsável",
    tituloCurto: "ATA (responsável)",
    tipo: "ata",
    opcional: false,
  },
  { id: "i", letra: "I", titulo: "Formulário I — Sumário da avaliação do RE", tituloCurto: "Sumário do RE", tipo: "sumario", opcional: false },
];

export const RE_PASSO_IDS: RePassoId[] = RE_PASSOS.map((p) => p.id);

export function isRePassoId(v: unknown): v is RePassoId {
  return typeof v === "string" && (RE_PASSO_IDS as string[]).includes(v);
}

export function isReFormId(v: unknown): v is ReFormId {
  return typeof v === "string" && ["a", "b", "c", "d", "e", "f"].includes(v);
}

/** Campos do PDF omitidos por serem identificadores diretos (para a equipe jurídica/LGPD conferir). */
export const omitidosPorPrivacidade: string[] = [
  "Nome do aluno (A, B, C, D, F, G, H, I)",
  "Nome do professor (A, B, D)",
  "Nome e contato do responsável (C)",
  "Nome do pai/mãe/responsável na ATA (H)",
];

// ── Meta da jornada ────────────────────────────────────────────────────────────────────────────

/**
 * Estado da jornada guardado em uma linha `re_assessments` com `form_code = re_jornada`.
 * Só a API escreve aqui (o cliente nunca envia isto).
 */
export interface ReJornadaMeta {
  /** (legado) Passo → data/hora ISO. Mantido só para ler registros criados antes do formulário único. */
  concluidos: Partial<Record<RePassoId, string>>;
  /** G é opcional: o RE escolheu "Não vou aplicar" (auditado em `re_optional_step_usage`). */
  g_pulado: boolean;
  /** H: o responsável ainda não respondeu; a jornada segue. */
  h_aguardando: boolean;
}

export function metaVazia(): ReJornadaMeta {
  return { concluidos: {}, g_pulado: false, h_aguardando: false };
}

export function metaComPadroes(raw: unknown): ReJornadaMeta {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ReJornadaMeta>;
  const concluidos: Partial<Record<RePassoId, string>> = {};
  if (r.concluidos && typeof r.concluidos === "object") {
    for (const [k, v] of Object.entries(r.concluidos)) {
      if (isRePassoId(k) && typeof v === "string") concluidos[k] = v;
    }
  }
  return { concluidos, g_pulado: r.g_pulado === true, h_aguardando: r.h_aguardando === true };
}

// ── Situação e pendências (formulário único, sem bloqueio entre blocos) ────────────────────────

export type RePassoEstado = "vazio" | "parcial" | "completo" | "pulado" | "aguardando_responsavel";

export interface PassoSituacao {
  id: RePassoId;
  letra: string;
  tituloCurto: string;
  estado: RePassoEstado;
  respondidos: number;
  total: number;
}

/** Um campo em branco. `rotulo` já vem legível: "Formulário A › Jogo › Memória". */
export interface Lacuna {
  passo: RePassoId;
  /** Chave do campo no payload (para a tela rolar até ele). Vazia nas lacunas de decisão (G, H). */
  campo: string;
  /** Linha da matriz, quando for o caso. */
  linha?: string;
  rotulo: string;
  /** Campo obrigatório: sem ele o envio ao médico não acontece (nem com "enviar assim mesmo"). */
  bloqueante?: boolean;
}

/** Mínimos de caracteres dos textos livres do Formulário I (guardrail do produto, não critério clínico). */
export const SUMARIO_MIN_CARACTERES = {
  queixa_professor: 20,
  hipotese_espectro: 15,
  qual: 10,
  tempo: 3,
  resultado: 10,
} as const;

export interface JornadaSituacao {
  passos: PassoSituacao[];
  lacunas: Lacuna[];
}

export interface JornadaEntradas {
  meta: ReJornadaMeta;
  /** Payload salvo de cada formulário A–F (ausente = nada salvo). */
  payloads: Partial<Record<ReFormId, unknown>>;
  /** Payload do SNAP-IV (G), se algo foi salvo. */
  snap4?: unknown;
  /** `secao_sumario` do Formulário I, se algo foi salvo. */
  sumario?: unknown;
  /** ATA (H): existe rascunho / já foi enviada. */
  ata: { existe: boolean; enviada: boolean };
  /** Série cadastrada no aluno (o Sumário I a carrega automaticamente). */
  serieDoAluno?: string | null;
}

function vazioTexto(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

function celulaRespondida(cel: any, comNumero: boolean): boolean {
  if (!cel || typeof cel !== "object") return false;
  const r = cel.r;
  if (Array.isArray(r) ? r.length > 0 : typeof r === "string" && r !== "") return true;
  if (comNumero && typeof cel.n === "number") return true;
  return false;
}

function campoRespondido(c: ReCampo, p: Record<string, any>): boolean {
  const v = p[c.key];
  switch (c.tipo) {
    case "texto":
    case "texto_longo":
      return !vazioTexto(v);
    case "unica":
      return typeof v === "string" && v !== "";
    case "multipla":
      return (Array.isArray(v) && v.length > 0) || !vazioTexto(p[`${c.key}__outros`]);
    case "professor":
      return Boolean(v && typeof v === "object" && (v.id || !vazioTexto(v.nome)));
    case "genograma":
      return lerGenograma(v) !== null;
    case "matriz":
      return false; // tratado por linha
  }
}

/** Lista o que ficou em branco em um formulário A–F (campos "opcionais" não entram). */
export function lacunasDoForm(formId: ReFormId, payload: unknown): Lacuna[] {
  const form = RE_FORMS[formId];
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
  const out: Lacuna[] = [];
  for (const sec of form.secoes) {
    for (const c of sec.campos) {
      if (c.opcional) continue;
      const base = `Formulário ${form.letra} › ${sec.titulo}`;
      if (c.tipo === "matriz") {
        const m = (p[c.key] && typeof p[c.key] === "object" ? p[c.key] : {}) as Record<string, any>;
        for (const l of c.linhas) {
          if (!celulaRespondida(m[l.key], Boolean(c.comNumero))) {
            out.push({ passo: formId, campo: c.key, linha: l.key, rotulo: `${base} › ${l.label}` });
          }
        }
      } else if (!campoRespondido(c, p)) {
        out.push({ passo: formId, campo: c.key, rotulo: `${base} › ${c.label.replace(/\?$/, "")}` });
      }
    }
  }
  return out;
}

/** Quantos campos/linhas já têm resposta (para a barra de progresso; em branco continua em branco). */
export function progressoDef(form: FormDef, payload: unknown): { respondidos: number; total: number } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
  let total = 0;
  let respondidos = 0;
  for (const c of camposDoForm(form)) {
    if (c.opcional) continue;
    if (c.tipo === "matriz") {
      const m = (p[c.key] && typeof p[c.key] === "object" ? p[c.key] : {}) as Record<string, any>;
      for (const l of c.linhas) {
        total += 1;
        if (celulaRespondida(m[l.key], Boolean(c.comNumero))) respondidos += 1;
      }
    } else {
      total += 1;
      if (campoRespondido(c, p)) respondidos += 1;
    }
  }
  return { respondidos, total };
}

export function progressoReForm(formId: ReFormId, payload: unknown): { respondidos: number; total: number } {
  return progressoDef(RE_FORMS[formId], payload);
}

function lacunasSnap4(snap4: unknown): { respondidos: number; total: number; faltam: number[] } {
  const r = ((snap4 as any)?.respostas ?? {}) as Record<string, unknown>;
  const faltam: number[] = [];
  let respondidos = 0;
  for (const it of SNAP4_ITENS) {
    if (typeof r[it.id] === "string" && r[it.id]) respondidos += 1;
    else faltam.push(it.n);
  }
  return { respondidos, total: SNAP4_ITENS.length, faltam };
}

export function lacunasDoSumario(sumario: unknown, serieDoAluno?: string | null): Lacuna[] {
  const s = (sumario && typeof sumario === "object" ? sumario : {}) as Record<string, any>;
  const out: Lacuna[] = [];
  const push = (campo: string, rotulo: string) => out.push({ passo: "i", campo, rotulo: `Formulário I › ${rotulo}`, bloqueante: true });
  const texto = (campo: keyof typeof SUMARIO_MIN_CARACTERES, rotulo: string) => {
    const min = SUMARIO_MIN_CARACTERES[campo];
    const v = typeof s[campo] === "string" ? s[campo].trim() : "";
    if (v === "") push(campo, rotulo);
    else if (v.length < min) push(campo, `${rotulo} (escreva pelo menos ${min} caracteres)`);
  };
  if (vazioTexto(serieDoAluno)) push("serie", "Série do aluno (edite os dados do aluno)");
  texto("queixa_professor", "Queixa do professor");
  texto("hipotese_espectro", "Hipótese do RE");
  if (!Array.isArray(s.dificuldades_persistentes) || s.dificuldades_persistentes.length === 0) {
    push("dificuldades_persistentes", "Dificuldades persistentes");
  }
  if (s.conduta !== "sim" && s.conduta !== "nao") push("conduta", "Houve conduta do PpI?");
  else if (s.conduta === "sim") {
    texto("qual", "Qual conduta");
    texto("tempo", "Por quanto tempo");
    texto("resultado", "Resultado da conduta");
  }
  return out;
}

/**
 * Situação de cada formulário e lista do que está em branco. Não bloqueia nada: quem decide enviar assim mesmo é o RE.
 *  - G: "pulado" (botão "Não vou aplicar") ou itens do SNAP-IV; sem nenhuma das duas coisas, vira lacuna de decisão;
 *  - H: ATA enviada, "aguardando o responsável" ou lacuna de decisão;
 *  - I: campos do Sumário; a série vem do cadastro do aluno.
 */
export function situacaoDaJornada(entrada: JornadaEntradas): JornadaSituacao {
  const passos: PassoSituacao[] = [];
  const lacunas: Lacuna[] = [];

  for (const passo of RE_PASSOS) {
    const base = { id: passo.id, letra: passo.letra, tituloCurto: passo.tituloCurto };
    if (passo.tipo === "formulario") {
      const id = passo.id as ReFormId;
      const payload = entrada.payloads[id];
      const prog = progressoReForm(id, payload);
      const falt = lacunasDoForm(id, payload);
      lacunas.push(...falt);
      const estado: RePassoEstado = falt.length === 0 ? "completo" : prog.respondidos === 0 ? "vazio" : "parcial";
      passos.push({ ...base, estado, ...prog });
    } else if (passo.tipo === "snap4") {
      if (entrada.meta.g_pulado) {
        passos.push({ ...base, estado: "pulado", respondidos: 0, total: 0 });
        continue;
      }
      const sn = lacunasSnap4(entrada.snap4);
      if (sn.respondidos === 0) {
        lacunas.push({ passo: "g", campo: "", rotulo: 'Formulário G › SNAP-IV não aplicado: preencha ou clique em "Não vou aplicar"' });
      } else if (sn.faltam.length > 0) {
        lacunas.push({ passo: "g", campo: "", rotulo: `Formulário G › SNAP-IV: sem resposta nos itens ${sn.faltam.join(", ")}` });
      }
      passos.push({
        ...base,
        estado: sn.respondidos === 0 ? "vazio" : sn.faltam.length === 0 ? "completo" : "parcial",
        respondidos: sn.respondidos,
        total: sn.total,
      });
    } else if (passo.tipo === "ata") {
      if (entrada.ata.enviada) passos.push({ ...base, estado: "completo", respondidos: 1, total: 1 });
      else if (entrada.meta.h_aguardando) {
        // Aguardando o responsável não libera o envio: a ATA é obrigatória.
        lacunas.push({ passo: "h", campo: "", rotulo: "Formulário H › ATA aguardando o responsável: o envio só é liberado com a ATA enviada", bloqueante: true });
        passos.push({ ...base, estado: "aguardando_responsavel", respondidos: 0, total: 1 });
      } else {
        lacunas.push({
          passo: "h",
          campo: "",
          rotulo: entrada.ata.existe
            ? "Formulário H › ATA em rascunho: a ATA é obrigatória, finalize e envie"
            : "Formulário H › ATA não registrada: a ATA é obrigatória",
          bloqueante: true,
        });
        passos.push({ ...base, estado: entrada.ata.existe ? "parcial" : "vazio", respondidos: 0, total: 1 });
      }
    } else {
      const falt = lacunasDoSumario(entrada.sumario, entrada.serieDoAluno);
      lacunas.push(...falt);
      const total = 5;
      const respondidos = Math.max(0, total - falt.filter((l) => l.campo !== "serie").length);
      passos.push({
        ...base,
        estado: falt.length === 0 ? "completo" : entrada.sumario ? "parcial" : "vazio",
        respondidos,
        total,
      });
    }
  }
  return { passos, lacunas };
}

export function passoEstado(sit: JornadaSituacao, id: RePassoId): RePassoEstado {
  return sit.passos.find((p) => p.id === id)?.estado ?? "vazio";
}

// ── Validação e normalização dos formulários A–F ───────────────────────────────────────────────

const VALOR_LIVRE_MAX = RE_TEXTO_MAX;

function textoValido(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.length <= VALOR_LIVRE_MAX);
}

export function camposDoForm(form: FormDef): ReCampo[] {
  return form.secoes.flatMap((s) => s.campos);
}

/** Chaves que existiam antes (identificação digitada) e que agora vêm do cadastro do aluno. Ignoradas e removidas. */
const CHAVES_LEGADAS: Record<ReFormId, string[]> = {
  a: ["serie"],
  b: ["sexo", "serie"],
  c: [],
  d: ["sexo", "serie"],
  e: [],
  f: ["sexo", "serie"],
};

/** Aceita rascunhos antigos: remove chaves legadas e passa respostas únicas para lista onde o campo agora é múltiplo. */
export function normalizarPayloadDef(form: FormDef, payload: Record<string, unknown>, chavesLegadas: string[] = []): Record<string, unknown> {
  const campos = new Map(camposDoForm(form).map((c) => [c.key, c] as const));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload)) {
    if (chavesLegadas.includes(key)) continue;
    const campo = campos.get(key);
    if (campo?.tipo === "genograma") {
      out[key] = normalizarGenogramaTexto(val);
    } else if (campo?.tipo === "multipla" && typeof val === "string") {
      out[key] = val ? [val] : [];
    } else if (campo?.tipo === "matriz" && campo.multipla && val && typeof val === "object" && !Array.isArray(val)) {
      const nova: Record<string, unknown> = {};
      for (const [lk, lv] of Object.entries(val as Record<string, any>)) {
        nova[lk] = lv && typeof lv === "object" && typeof lv.r === "string" ? { ...lv, r: lv.r ? [lv.r] : [] } : lv;
      }
      out[key] = nova;
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Valida o payload de um formulário A–F. Aceita só chaves conhecidas, valores dentro das opções e
 * textos curtos. Não exige preenchimento (em branco é permitido) e nunca preenche padrão "não".
 */
export function validarPayloadDef(form: FormDef, payload: unknown, chavesLegadas: string[] = []): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Payload inválido";
  const p = normalizarPayloadDef(form, payload as Record<string, unknown>, chavesLegadas);
  const campos = new Map<string, ReCampo>();
  for (const c of camposDoForm(form)) campos.set(c.key, c);

  for (const [key, val] of Object.entries(p)) {
    // Textos complementares: "<campo>__texto", "<campo>__outros" e "<campo>__obs"
    const base = key.replace(/__(texto|outros|obs)$/, "");
    const campo = campos.get(base);
    if (!campo) return `Campo desconhecido: ${key}`;
    if (key !== base) {
      if (!textoValido(val)) return `Campo "${key}" inválido ou longo demais.`;
      continue;
    }
    if (val === null || val === undefined) continue;

    switch (campo.tipo) {
      case "texto":
      case "texto_longo":
        if (!textoValido(val)) return `Campo "${campo.label}" inválido ou longo demais (máximo ${VALOR_LIVRE_MAX} caracteres).`;
        // Campos de data (chave "data_*" ou "*_data_*"): em branco ou AAAA-MM-DD.
        if (/(^|_)data_/.test(campo.key) && typeof val === "string" && val !== "") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || Number.isNaN(Date.parse(val))) return `Campo "${campo.label}": data inválida (use AAAA-MM-DD).`;
        }
        break;
      case "unica":
        if (typeof val !== "string" || !campo.opcoes.some((op) => op.value === val)) return `Campo "${campo.label}": opção inválida.`;
        break;
      case "multipla":
        if (!Array.isArray(val) || val.some((x) => typeof x !== "string" || !campo.opcoes.some((op) => op.value === x))) {
          return `Campo "${campo.label}": opção inválida.`;
        }
        break;
      case "genograma":
        if (typeof val !== "string" || val.length > GENOGRAMA_JSON_MAX) return `Campo "${campo.label}" inválido ou longo demais.`;
        break;
      case "professor": {
        if (typeof val !== "object" || Array.isArray(val)) return `Campo "${campo.label}" inválido.`;
        const v = val as Record<string, unknown>;
        for (const k of Object.keys(v)) if (!["id", "nome"].includes(k)) return `Campo "${campo.label}": chave desconhecida (${k}).`;
        if (v.id !== undefined && v.id !== null && (typeof v.id !== "string" || v.id.length > 64)) return `Campo "${campo.label}": professor inválido.`;
        if (!textoValido(v.nome) || (typeof v.nome === "string" && v.nome.length > 200)) return `Campo "${campo.label}": nome inválido.`;
        break;
      }
      case "matriz": {
        if (typeof val !== "object" || Array.isArray(val)) return `Campo "${campo.label}" inválido.`;
        for (const [lk, lv] of Object.entries(val as Record<string, unknown>)) {
          if (!campo.linhas.some((l) => l.key === lk)) return `Campo "${campo.label}": linha desconhecida (${lk}).`;
          if (!lv || typeof lv !== "object" || Array.isArray(lv)) return `Campo "${campo.label}": linha inválida.`;
          const cel = lv as Record<string, unknown>;
          for (const ck of Object.keys(cel)) {
            if (!["r", "obs", "n"].includes(ck)) return `Campo "${campo.label}": chave desconhecida (${ck}).`;
          }
          if (cel.r !== undefined && cel.r !== null) {
            const rs = Array.isArray(cel.r) ? cel.r : [cel.r];
            if (!campo.multipla && Array.isArray(cel.r)) return `Campo "${campo.label}": só uma opção por linha.`;
            if (rs.some((x) => typeof x !== "string" || !campo.opcoes.some((op) => op.value === x))) {
              return `Campo "${campo.label}": opção inválida.`;
            }
          }
          if (!textoValido(cel.obs)) return `Campo "${campo.label}": observação longa demais.`;
          if (cel.n !== undefined && cel.n !== null) {
            if (!campo.comNumero) return `Campo "${campo.label}": número não previsto.`;
            if (typeof cel.n !== "number" || !Number.isFinite(cel.n) || cel.n < 0 || cel.n > 1000) return `Campo "${campo.label}": total de acertos inválido.`;
          }
        }
        break;
      }
    }
  }

    return null;
}

export function normalizarPayloadReForm(formId: ReFormId, payload: Record<string, unknown>): Record<string, unknown> {
  return normalizarPayloadDef(RE_FORMS[formId], payload, CHAVES_LEGADAS[formId]);
}

/**
 * Valida o payload de um formulário A–F. Aceita só chaves conhecidas, valores dentro das opções e
 * textos curtos. Não exige preenchimento (em branco é permitido) e nunca preenche padrão "não".
 */
export function validarPayloadReForm(formId: ReFormId, payload: unknown): string | null {
  const erro = validarPayloadDef(RE_FORMS[formId], payload, CHAVES_LEGADAS[formId]);
  if (erro) return erro;
  const p = normalizarPayloadReForm(formId, payload as Record<string, unknown>);

// Data de aplicação do IPPL-R: se informada, formato válido (a data pode ser futura apenas se a equipe agendou; a API só confere o formato).
  if (formId === "f") {
    const d = p["data_aplicacao"];
    if (d !== undefined && d !== null && d !== "") {
      if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return "Data da aplicação inválida (use AAAA-MM-DD).";
    }
  }
  return null;
}
