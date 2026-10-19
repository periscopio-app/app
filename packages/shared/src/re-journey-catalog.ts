/**
 * Jornada do RE (Responsável Escolar) — Formulários A a I.
 *
 * Fonte: "Avaliação e Intervenção do Pedagogo Responsável Escolar (RE) pela observação e avaliação
 * do aluno com dificuldade persistente" (Cap RE ESCOLAR Plataforma 1809), formulários A a I.
 * A sequência é obrigatória: A → B → C → D → E → F → G (opcional) → H → I.
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
}

/** Múltipla escolha (valores em array). `outros` abre um campo de texto livre. */
export interface CampoMultipla extends CampoBase {
  tipo: "multipla";
  opcoes: ReOpcao[];
  outros?: string;
}

/**
 * Tabela: cada linha recebe uma resposta (e, opcionalmente, observação e/ou um número).
 * Payload: `{ [linha.key]: { r?: string|null, obs?: string, n?: number|null } }`.
 */
export interface CampoMatriz extends CampoBase {
  tipo: "matriz";
  linhas: { key: string; label: string }[];
  opcoes: ReOpcao[];
  comObs?: boolean;
  /** Se informado, cada linha tem um campo numérico (ex.: "Total de acertos"). */
  comNumero?: string;
}

export type ReCampo = CampoTexto | CampoTextoLongo | CampoUnica | CampoMultipla | CampoMatriz;

export interface ReSecao {
  id: string;
  titulo: string;
  descricao?: string;
  campos: ReCampo[];
}

export interface ReFormDef {
  id: ReFormId;
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

const OBS_FINAL: ReSecao = {
  id: "observacoes",
  titulo: "Observações",
  campos: [tl("observacoes", "Observações")],
};

const SEXO: CampoUnica = u("sexo", "Sexo", [o("f", "Feminino"), o("m", "Masculino"), o("nao_informado", "Prefiro não informar")]);
const SERIE: CampoTexto = t("serie", "Série / ano escolar", "Ex.: 3º ano");

// ── Formulário A — Entrevista Inicial com Aluno do Ensino Fundamental I (6–9) ──────────────────

const FORM_A: ReFormDef = {
  id: "a",
  code: "re_form_a",
  letra: "A",
  titulo: "Formulário A — Entrevista inicial com o aluno (Ensino Fundamental I, 6 a 9 anos)",
  tituloCurto: "Entrevista com o aluno",
  dica: "Converse com o aluno e registre o que ele disser, com as palavras dele. Não escreva nomes de pessoas.",
  pendenciasDeValidacao: [
    "Campo \"Professor\" do cabeçalho omitido (nome de adulto). Confirmar com o responsável clínico/LGPD se deve entrar como texto livre.",
    "O PDF numera de novo \"1.\" em Desenvolvimento Global após Aspecto Intelectual; mantida a ordem do documento.",
    "As colunas Não/Sim/Observações aparecem só no início da tabela de Desenvolvimento Global; aplicadas também às demais tabelas (Jogo, Linguagem Matemática, Oral, Escrita, Espaço e Tempo). Confirmar.",
  ],
  secoes: [
    {
      id: "cabecalho",
      titulo: "Identificação",
      descricao: "Nome do aluno não é registrado; o sistema usa só o código.",
      campos: [SEXO, SERIE],
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
    "Campo \"Professor\" do cabeçalho omitido (nome de adulto). Confirmar com o responsável clínico/LGPD.",
  ],
  secoes: [
    { id: "cabecalho", titulo: "Identificação", campos: [SEXO, SERIE] },
    {
      id: "queixas",
      titulo: "Queixas e desempenho",
      campos: [
        u("queixas_aprendizagem", "Você tem queixas quanto à aprendizagem dele?", [o("nao", "Não"), o("sim", "Sim", "Quais?")]),
        u("desempenho_aula", "Como é o desempenho dele na aula?", [o("otimo", "Ótimo"), o("bom", "Bom"), o("regular", "Regular"), o("ruim", "Ruim")]),
        u("alunos_turma", "Quantos alunos tem a sua turma?", [o("ate_20", "Até 20"), o("21_30", "21 a 30"), o("31_40", "31 a 40"), o("mais_40", "Mais de 40")]),
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
    "Genograma: o PDF pede para completar uma figura ao final. Transcrito como descrição em texto; a figura gráfica NAO IMPLEMENTAR ATE VALIDACAO (modelo do genograma e quem preenche).",
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
      id: "genograma",
      titulo: "Genograma",
      descricao: "Complete com as informações sobre antecedentes familiares que o responsável forneceu.",
      campos: [tl("genograma_texto", "Antecedentes familiares informados (descrição em texto)", "Sem nomes. Ex.: \"avô materno com ...\".")],
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
    "Campo \"Professor\" do cabeçalho omitido (nome de adulto). Confirmar com o responsável clínico/LGPD.",
    "Escrita \"Demostra alegria\" do PDF corrigida para \"Demonstra alegria\".",
  ],
  secoes: [
    { id: "cabecalho", titulo: "Identificação", campos: [SEXO, SERIE] },
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
    "Campo \"Escola\" é preenchido pelo cadastro; \"Aplicador\" é o RE logado (sem nome na tela).",
    "O PDF traz o quadro \"Risco para problemas de leitura / Sem risco\" e três linhas de classificação geral; transcritas como escolhas simples. Confirmar a regra de preenchimento com o responsável clínico.",
  ],
  secoes: [
    {
      id: "cabecalho",
      titulo: "Identificação",
      campos: [SEXO, SERIE, t("data_aplicacao", "Data da aplicação", "Formato AAAA-MM-DD")],
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
        u("risco_primeira", "Risco para problemas de leitura (1ª avaliação)", OPCOES_RISCO_LEITURA),
        u("risco_segunda", "Risco para problemas de leitura (2ª avaliação, pós-intervenção)", OPCOES_RISCO_LEITURA),
        u("desenvolvimento_esperado", "Desenvolvimento dentro do esperado para a idade", OPCOES_NAO_SIM),
      ],
    },
  ],
};

export const RE_FORMS: Record<ReFormId, ReFormDef> = { a: FORM_A, b: FORM_B, c: FORM_C, d: FORM_D, e: FORM_E, f: FORM_F };

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

// ── Meta da jornada e motor de sequência ───────────────────────────────────────────────────────

/**
 * Estado da jornada guardado em uma linha `re_assessments` com `form_code = re_jornada`.
 * Só a API escreve aqui (o cliente nunca envia isto), para que a ordem seja imposta no servidor.
 */
export interface ReJornadaMeta {
  /** Passo → data/hora ISO em que o RE concluiu. */
  concluidos: Partial<Record<RePassoId, string>>;
  /** G é opcional: o RE escolheu não aplicar. */
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

export type RePassoEstado =
  | "bloqueado"
  | "disponivel"
  | "concluido"
  | "pulado"
  | "aguardando_responsavel";

export interface JornadaSituacao {
  passos: { id: RePassoId; estado: RePassoEstado; temRascunho: boolean }[];
  /** Primeiro passo ainda não resolvido (onde o RE deve trabalhar agora). null = tudo resolvido. */
  atual: RePassoId | null;
  /** A→F, I concluídos; G concluído ou pulado; H concluído ou aguardando o responsável. */
  podeEnviar: boolean;
  pendencias: string[];
}

export interface JornadaEntradas {
  meta: ReJornadaMeta;
  /** Passos que já têm alguma coisa salva (rascunho). */
  comRascunho?: Partial<Record<RePassoId, boolean>>;
  /** A ATA já foi enviada (e travada) pelo RE. */
  ataEnviada?: boolean;
}

function resolvido(estado: RePassoEstado): boolean {
  return estado === "concluido" || estado === "pulado" || estado === "aguardando_responsavel";
}

/**
 * Regra única de sequência (usada pela API e pela tela):
 *  - um passo só abre quando todos os anteriores estão resolvidos;
 *  - G resolve-se concluindo ou pulando; H concluindo (ATA enviada) ou marcando "aguardando responsável";
 *  - só se envia ao médico com todos os passos resolvidos e o Sumário (I) concluído.
 */
export function situacaoDaJornada(entrada: JornadaEntradas): JornadaSituacao {
  const { meta } = entrada;
  const passos: JornadaSituacao["passos"] = [];
  let anteriorResolvido = true;
  let atual: RePassoId | null = null;
  const pendencias: string[] = [];

  for (const p of RE_PASSOS) {
    let estado: RePassoEstado;
    if (p.id === "h" && entrada.ataEnviada) {
      estado = "concluido";
    } else if (meta.concluidos[p.id]) {
      estado = "concluido";
    } else if (p.id === "g" && meta.g_pulado) {
      estado = "pulado";
    } else if (p.id === "h" && meta.h_aguardando) {
      estado = "aguardando_responsavel";
    } else {
      estado = anteriorResolvido ? "disponivel" : "bloqueado";
    }
    // Um passo "concluído" que vem depois de um não resolvido (dado inconsistente) volta a ficar travado.
    if (!anteriorResolvido && resolvido(estado)) estado = "bloqueado";

    passos.push({ id: p.id, estado, temRascunho: Boolean(entrada.comRascunho?.[p.id]) });
    if (!resolvido(estado)) {
      if (atual === null) atual = p.id;
      pendencias.push(`Falta o Formulário ${p.letra} — ${p.tituloCurto}.`);
    }
    anteriorResolvido = anteriorResolvido && resolvido(estado);
  }

  return { passos, atual, podeEnviar: pendencias.length === 0, pendencias };
}

export function passoEstado(sit: JornadaSituacao, id: RePassoId): RePassoEstado {
  return sit.passos.find((p) => p.id === id)?.estado ?? "bloqueado";
}

// ── Validação e progresso dos formulários A–F ──────────────────────────────────────────────────

const VALOR_LIVRE_MAX = RE_TEXTO_MAX;

function textoValido(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.length <= VALOR_LIVRE_MAX);
}

export function camposDoForm(form: ReFormDef): ReCampo[] {
  return form.secoes.flatMap((s) => s.campos);
}

/**
 * Valida o payload de um formulário A–F. Aceita só chaves conhecidas, valores dentro das opções e
 * textos curtos. Não exige preenchimento (em branco é permitido) e nunca preenche padrão "não".
 */
export function validarPayloadReForm(formId: ReFormId, payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Payload inválido";
  const form = RE_FORMS[formId];
  const p = payload as Record<string, unknown>;
  const campos = new Map<string, ReCampo>();
  for (const c of camposDoForm(form)) campos.set(c.key, c);

  for (const [key, val] of Object.entries(p)) {
    // Textos complementares: "<campo>__texto" e "<campo>__outros"
    const base = key.replace(/__(texto|outros)$/, "");
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
        break;
      case "unica":
        if (typeof val !== "string" || !campo.opcoes.some((op) => op.value === val)) return `Campo "${campo.label}": opção inválida.`;
        break;
      case "multipla":
        if (!Array.isArray(val) || val.some((x) => typeof x !== "string" || !campo.opcoes.some((op) => op.value === x))) {
          return `Campo "${campo.label}": opção inválida.`;
        }
        break;
      case "matriz": {
        if (typeof val !== "object" || Array.isArray(val)) return `Campo "${campo.label}" inválido.`;
        for (const [lk, lv] of Object.entries(val as Record<string, unknown>)) {
          if (!campo.linhas.some((l) => l.key === lk)) return `Campo "${campo.label}": linha desconhecida (${lk}).`;
          if (!lv || typeof lv !== "object" || Array.isArray(lv)) return `Campo "${campo.label}": linha inválida.`;
          const cel = lv as Record<string, unknown>;
          for (const ck of Object.keys(cel)) {
            if (!["r", "obs", "n"].includes(ck)) return `Campo "${campo.label}": chave desconhecida (${ck}).`;
          }
          if (cel.r !== undefined && cel.r !== null && (typeof cel.r !== "string" || !campo.opcoes.some((op) => op.value === cel.r))) {
            return `Campo "${campo.label}": opção inválida.`;
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

  // Data de aplicação do IPPL-R: se informada, formato válido e não futura (verificada na API com hojeBrasilia).
  if (formId === "f") {
    const d = p["data_aplicacao"];
    if (d !== undefined && d !== null && d !== "") {
      if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return "Data da aplicação inválida (use AAAA-MM-DD).";
    }
  }
  return null;
}

/** Quantos campos/linhas já têm resposta (para a barra de progresso; em branco continua em branco). */
export function progressoReForm(formId: ReFormId, payload: unknown): { respondidos: number; total: number } {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
  let respondidos = 0;
  let total = 0;
  for (const c of camposDoForm(RE_FORMS[formId])) {
    if (c.tipo === "matriz") {
      const v = (p[c.key] && typeof p[c.key] === "object" ? p[c.key] : {}) as Record<string, any>;
      for (const l of c.linhas) {
        total += 1;
        const cel = v[l.key];
        if (cel && (cel.r || (typeof cel.n === "number") || (typeof cel.obs === "string" && cel.obs.trim()))) respondidos += 1;
      }
      continue;
    }
    total += 1;
    const v = p[c.key];
    if (c.tipo === "multipla") {
      if ((Array.isArray(v) && v.length > 0) || (typeof p[`${c.key}__outros`] === "string" && p[`${c.key}__outros`].trim())) respondidos += 1;
    } else if (typeof v === "string" && v.trim()) respondidos += 1;
  }
  return { respondidos, total };
}
