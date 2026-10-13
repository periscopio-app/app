/**
 * Catálogo dos 5 instrumentos da Triagem TEA (fonte: TRIAGEM_TEA_out26, enviado em 13/out/2026).
 * Os textos dos itens vêm do formulário-fonte; NENHUMA regra clínica nova foi criada aqui.
 * Gerado a partir do documento; qualquer correção de texto deve ser aprovada pelo dono clínico.
 *
 * Aviso de direitos: SRS-2 (© WPS / Hogrefe CETEPP) e SCQ/ASQ (© WPS) têm direitos de uso a confirmar
 * antes do piloto. M-CHAT: © Robins, Fein e Barton (tradução Pondé e Losapio).
 */

export const TEA_INSTRUMENT_CODES = ["ata", "asq", "mchat", "srs2", "abc"] as const;
export type TeaInstrumentCode = (typeof TEA_INSTRUMENT_CODES)[number];

export const TEA_CATALOG_VERSION = "out26.1";

export type TeaLicenseStatus = "confirmar" | "restrito" | "atribuicao";

export interface TeaInstrumentMeta {
  code: TeaInstrumentCode;
  title: string;
  shortTitle: string;
  /** Capítulo do formulário-fonte e quem preenche no sistema. */
  chapter: string;
  fillerLabel: string;
  /** Capacidade (privilégio) que libera o preenchimento — o Admin Master pode mudar. */
  fillCapability: string;
  audience: string;
  instruction: string;
  /** "calculado" = o sistema soma pontos pela regra do formulário; "somente_registro" = só guarda as respostas. */
  scoring: "calculado" | "somente_registro";
  scoringNote: string;
  itemCount: number;
  license: { status: TeaLicenseStatus; note: string };
  respondentRequired: boolean;
}

export const TEA_INSTRUMENTS: Record<TeaInstrumentCode, TeaInstrumentMeta> = {
  ata: {
    code: "ata",
    title: "ATA — Escala de Traços Autísticos",
    shortTitle: "ATA",
    chapter: "Escola · Capítulo do RE",
    fillerLabel: "Responsável Escolar (RE), pedindo ao responsável legal",
    fillCapability: "tea.ata.fill",
    audience: "Pai, mãe ou responsável legal responde; o RE registra.",
    instruction:
      "Para cada um dos 22 grupos, marque os comportamentos que a criança apresenta. Marque também se os sinais apareceram antes dos 36 meses.",
    scoring: "calculado",
    scoringNote:
      "Por grupo: 0 = nenhum sintoma; 1 = um sintoma; 2 = mais de um sintoma. Soma dos 22 grupos + 1 ponto se apareceu antes dos 36 meses (leitura do item 23 a confirmar).",
    itemCount: 23,
    license: { status: "confirmar", note: "Ballabriga et al., 1994; adaptação Assumpção et al. Confirmar direitos de uso da versão." },
    respondentRequired: true,
  },
  asq: {
    code: "asq",
    title: "ASQ — Questionário de Triagem do Autismo (SCQ)",
    shortTitle: "ASQ",
    chapter: "Núcleo assistencial · Capítulo do MD",
    fillerLabel: "Médico(a), em entrevista com os pais",
    fillCapability: "tea.asq.fill",
    audience: "Para crianças com mais de 4 anos (idade mental acima de 2 anos). Pais respondem com base nos últimos 3 meses.",
    instruction:
      "Responda Sim ou Não. Se a criança não conversa com frases curtas (pergunta 1), as perguntas 2 a 8 não se aplicam.",
    scoring: "calculado",
    scoringNote:
      "Cada resposta vale 0 ou 1, conforme a coluna do formulário (a pergunta 1 não pontua). O máximo depende de a criança falar: 39 com fala; 32 sem fala (o formulário cita 34 — divergência a esclarecer).",
    itemCount: 40,
    license: { status: "confirmar", note: "SCQ © Western Psychological Services (WPS). Validação brasileira: Paula, Santos, Mercadante et al. Confirmar licença." },
    respondentRequired: true,
  },
  mchat: {
    code: "mchat",
    title: "M-CHAT-R/F — Questionário Modificado para Triagem do Autismo",
    shortTitle: "M-CHAT",
    chapter: "Núcleo assistencial · Capítulo do AS",
    fillerLabel: "Assistente Social",
    fillCapability: "tea.mchat.fill",
    audience: "Crianças de 16 a 30 meses (Lei nº 13.438/2017). Pais respondem na consulta ou na avaliação do Assistente Social.",
    instruction:
      "Responda sobre como a criança geralmente é. Se o comportamento é raro (2 vezes ou menos), responda NÃO.",
    scoring: "somente_registro",
    scoringNote:
      "O sistema guarda as respostas e mostra só contagens de Sim e Não. A pontuação de risco NÃO é calculada: o formulário não diz em quais perguntas a resposta de risco é Sim ou Não, e traz 23 perguntas com faixas da versão de 20.",
    itemCount: 23,
    license: { status: "atribuicao", note: "© 1999 Diana Robins, Deborah Fein e Marianne Barton. Tradução Milena Pereira Pondé e Mirella Fiuza Losapio." },
    respondentRequired: true,
  },
  srs2: {
    code: "srs2",
    title: "SRS-2 — Escala de Responsividade Social (2ª edição)",
    shortTitle: "SRS-2",
    chapter: "Núcleo assistencial · Capítulo do Fonoaudiólogo",
    fillerLabel: "Fonoaudiólogo(a), pedindo ao responsável",
    fillCapability: "tea.srs2.fill",
    audience: "Comportamento da criança a partir dos 3 anos, nos últimos 6 meses. Mãe/pai, professor ou outro respondente.",
    instruction: "Para cada frase: 1 = não é verdade; 2 = algumas vezes é verdade; 3 = muitas vezes é verdade; 4 = quase sempre é verdade.",
    scoring: "somente_registro",
    scoringNote:
      "O sistema guarda as 65 respostas. A pontuação T e as faixas (Normal, Leve, Moderado, Grave) exigem as tabelas de normas e a lista de itens invertidos da editora, que não estão no formulário.",
    itemCount: 65,
    license: {
      status: "restrito",
      note: "© 2012 Western Psychological Services; © 2020 Editora Hogrefe CETEPP (Constantino e Gruber; adaptação brasileira de Lisandra B. V. Lima). Reprodução exige autorização por escrito. Confirmar licença ANTES do piloto.",
    },
    respondentRequired: true,
  },
  abc: {
    code: "abc",
    title: "ABC — Checklist do Comportamento Autístico (ICA, versão brasileira)",
    shortTitle: "ABC",
    chapter: "Núcleo assistencial · Capítulo do Psicólogo",
    fillerLabel: "Psicólogo(a), com pais ou professor",
    fillCapability: "tea.abc.fill",
    audience: "Crianças com mais de 3 anos. Pais ou professor respondem ao psicólogo.",
    instruction: "Marque cada comportamento que a criança apresenta. O que ficar sem marcar conta como não observado.",
    scoring: "calculado",
    scoringNote:
      "Soma dos pesos (1 a 4) dos comportamentos marcados, total e por área. O sistema NÃO classifica o resultado: o formulário traz dois critérios de corte que se contradizem.",
    itemCount: 57,
    license: { status: "confirmar", note: "Versão brasileira (ABC/ICA). Confirmar fonte e direitos de uso." },
    respondentRequired: true,
  },
};

// ─── ATA ────────────────────────────────────────────────────────────────────
export interface AtaGroup { n: number; name: string; help: string; options: string[] }
export const ATA_GROUPS: readonly AtaGroup[] = [
  {
    "n": 1,
    "name": "DIFICULDADE NA INTERAÇÃO SOCIAL",
    "help": "O desvio da sociabilidade pode oscilar entre formas leves como, um certo negativismo e a evitação do contato ocular, até formas mais graves, como um isolamento grave.",
    "options": [
      "Não sorri",
      "Ausência de aproximações espontâneas",
      "Não busca companhia",
      "Busca constantemente seu cantinho (esconderijo)",
      "Evita pessoas",
      "É incapaz de manter um intercâmbio social",
      "Isolamento intenso"
    ]
  },
  {
    "n": 2,
    "name": "MANIPULAÇÃO DO AMBIENTE",
    "help": "O problema da manipulação do ambiente pode apresentar-se em nível mais ou menos grave, como não responder às solicitações e manter-se indiferente ao ambiente. O fato mais comum é a crise de birra abrupta e passageira, risos incontroláveis e sem motivo, para ser o centro da atenção.",
    "options": [
      "Não responde às solicitações",
      "Mudança repentina de humor",
      "Mantém-se indiferente, sem expressão",
      "Risos compulsivos",
      "Birra e raiva passageira",
      "Excitação motora ou verbal (ir de um lugar a outro, falar sem parar)"
    ]
  },
  {
    "n": 3,
    "name": "UTILIZAÇÃO DAS PESSOAS A SEU REDOR",
    "help": "A relação que mantém com o adulto quase nunca é interativa, utiliza do adulto para conseguir o que deseja.",
    "options": [
      "Utiliza-se do adulto como um objeto, levando-o até aquilo que deseja.",
      "O adulto lhe serve como apoio para conseguir o que deseja (p.ex.: utiliza o adulto como apoio para pegar bolacha)",
      "O adulto é o meio para suprir uma necessidade que não é capaz de realizar só (p.ex.: amarrar sapatos)",
      "Se o adulto não responde às suas demandas, atua interferindo na conduta desse adulto."
    ]
  },
  {
    "n": 4,
    "name": "RESISTÊNCIA A MUDANÇAS",
    "help": "A resistência a mudanças vai de irritabilidade até franca recusa.",
    "options": [
      "Insistente em manter a rotina",
      "Grande dificuldade em aceitar fatos que alteram sua rotina, tais como mudanças de lugar, de vestuário e na alimentação",
      "Apresenta resistência a mudanças, persistindo na mesma resposta ou atividade"
    ]
  },
  {
    "n": 5,
    "name": "BUSCA DE UMA ORDEM RÍGIDA",
    "help": "Manifesta tendência a ordenar tudo, até a obsessividade, sem a qual não consegue desenvolver nenhuma atividade.",
    "options": [
      "Ordenação dos objetos de acordo com critérios próprios e pré-estabelecidos",
      "Prende-se a uma ordenação espacial (Cada coisa sempre em seu lugar)",
      "Prende-se a uma sequência temporal (Cada coisa em seu tempo)",
      "Prende-se a uma correspondência pessoa-lugar (Cada pessoa sempre no lugar determinado)"
    ]
  },
  {
    "n": 6,
    "name": "FALTA DE CONTATO VISUAL. OLHAR INDEFINIDO",
    "help": "olhar estranho até evitação.",
    "options": [
      "Desvia os olhares diretos, não olhando nos olhos",
      "Volta a cabeça ou o olhar quando é chamado (olhar para fora)",
      "Expressão do olhar vazio e sem vida",
      "Quando segue os estímulos com os olhos, somente o faz de maneira intermitente",
      "Fixa os objetos com um olhar periférico, não central",
      "Dá a sensação de que não olha"
    ]
  },
  {
    "n": 7,
    "name": "MÍMICA INEXPRESSIVA",
    "help": "A inexpressividade mímica revela a carência da comunicação não verbal: pouca até nenhuma.",
    "options": [
      "Se fala, não utiliza a expressão facial, gestual ou vocal com a frequência esperada",
      "Não mostra uma reação antecipatória",
      "Não expressa através da mímica ou olhar aquilo que quer ou o que sente.",
      "Imobilidade facial"
    ]
  },
  {
    "n": 8,
    "name": "DISTÚRBIOS DE SONO",
    "help": "Dorme muitas horas quando criança e maior, dorme poucas horas, de acordo com a idade. Esta conduta pode ser constante, ou não.",
    "options": [
      "Não quer ir dormir",
      "Levanta-se muito cedo",
      "Sono irregular (em intervalos)",
      "Troca ou dia pela noite",
      "Dorme poucas horas."
    ]
  },
  {
    "n": 9,
    "name": "ALTERAÇÃO NA ALIMENTAÇÃO",
    "help": "Pode ser quantitativa e/ou qualitativa: deixa de comer até evita certos alimentos.",
    "options": [
      "Seletividade alimentar rígida (ex.: come o mesmo tipo de alimento sempre)",
      "Come outras coisas além de alimentos (papel, insetos)",
      "Quando pequeno não mastigava",
      "Apresenta uma atividade ruminante",
      "Vômitos",
      "Come grosseiramente, esparrama a comida ou a atira",
      "Rituais (esfarela alimentos antes da ingestão)",
      "Ausência de paladar (falta de sensibilidade gustativa)"
    ]
  },
  {
    "n": 10,
    "name": "DIFICULDADE NO CONTROLE DOS ESFÍNCTERES",
    "help": "O controle dos esfíncteres pode existir, usa para manipular ou chamar a atenção do adulto",
    "options": [
      "Medo de sentar-se no vaso sanitário",
      "Utiliza os esfíncteres para manipular o adulto",
      "Utiliza os esfíncteres como estimulação corporal, para obtenção de prazer",
      "Tem controle diurno, porém o noturno é tardio ou ausente"
    ]
  },
  {
    "n": 11,
    "name": "EXPLORAÇÃO DOS OBJETOS (APALPAR, CHUPAR)",
    "help": "Analisa os objetos sensorialmente, além da visão, porém sem uma finalidade específica",
    "options": [
      "Morde e engole objetos não alimentares",
      "Chupa e coloca as coisas na boca",
      "Cheira tudo",
      "Apalpa tudo. Examina as superfícies com os dedos de uma maneira minuciosa"
    ]
  },
  {
    "n": 12,
    "name": "USO INAPROPRIADO DOS OBJETOS",
    "help": "Utiliza objetos de modo não funcional.",
    "options": [
      "Ignora os objetos ou mostra um interesse momentâneo",
      "Pega, golpeia ou simplesmente os atira no chão",
      "Conduta atípica com os objetos (segura indiferentemente nas mãos ou gira)",
      "Carrega insistentemente consigo determinado objeto",
      "Se interessa somente por uma parte do objeto ou do brinquedo",
      "Coleciona objetos estranhos",
      "Utiliza os objetos de forma particular e inadequada"
    ]
  },
  {
    "n": 13,
    "name": "FALTA DE ATENÇÃO",
    "help": "Dificuldades na atenção e concentração, sensação de que se encontra ausente.",
    "options": [
      "Quando realiza uma atividade, fixa a atenção por curto espaço de tempo ou é incapaz de fixá-la",
      "Age como se fosse surdo",
      "Tempo de latência de resposta aumentado. Entende as instruções com dificuldade (quando não lhe interessa, não as entende)",
      "Resposta retardada",
      "Muitas vezes dá a sensação de ausência"
    ]
  },
  {
    "n": 14,
    "name": "AUSÊNCIA DE INTERESSE PELA APRENDIZAGEM",
    "help": "Não tem interesse por aprender, busca solução nos demais, é uma ruptura em sua rotina.",
    "options": [
      "Não quer aprender",
      "Cansa-se muito depressa, ainda que de atividade que goste",
      "Esquece rapidamente",
      "Insiste em ser ajudado, ainda que saiba fazer",
      "Insiste constantemente em mudar de atividade"
    ]
  },
  {
    "n": 15,
    "name": "FALTA DE INICIATIVA",
    "help": "Busca constantemente a comodidade, quer pronto. Não realiza nenhuma atividade funcional por iniciativa própria.",
    "options": [
      "É incapaz de ter iniciativa própria",
      "Busca a comodidade",
      "Passividade, falta de interesse",
      "Lentidão",
      "Prefere que outro faça o trabalho para ele"
    ]
  },
  {
    "n": 16,
    "name": "ALTERAÇÃO DE LINGUAGEM E COMUNICAÇÃO",
    "help": "desde um atraso de linguagem até formas mais graves, fala particular e estranha.",
    "options": [
      "Mutismo",
      "Estereotipias vocais",
      "Entonação incorreta",
      "Ecolalia imediata e/ou retardada",
      "Repetição de palavras ou frases que podem (ou não) ter valor comunicativo",
      "Emite sons estereotipados quando está agitado e em outras ocasiões, sem nenhuma razão aparente",
      "Não se comunica por gestos",
      "As interações com adulto não são nunca um diálogo"
    ]
  },
  {
    "n": 17,
    "name": "NÃO MANIFESTA HABILIDADES E CONHECIMENTOS",
    "help": "Nunca manifesta tudo aquilo que é capaz de fazer ou agir, dificultando a avaliação dos profissionais.",
    "options": [
      "Ainda que saiba fazer uma coisa, não a realiza, se não quiser",
      "Não demonstra o que sabe, até ter uma necessidade primária ou um interesse eminentemente específico",
      "Aprende coisas, porém somente a demonstra em determinados lugares e com determinadas pessoas",
      "Às vezes, surpreende por suas habilidades inesperadas"
    ]
  },
  {
    "n": 18,
    "name": "REAÇÕES INAPROPRIADAS ANTE A FRUSTRAÇÃO",
    "help": "aborrecimento até cólera.",
    "options": [
      "Reações de desagrado caso seja esquecida alguma coisa",
      "Reações de desagrado caso seja interrompida alguma atividade que goste",
      "Desgostoso quando os desejos e as expectativas não se cumprem",
      "Reações de birra"
    ]
  },
  {
    "n": 19,
    "name": "NÃO ASSUME RESPONSABILIDADES",
    "help": "Incapaz de fazer-se responsável.",
    "options": [
      "Não assume nenhuma responsabilidade, por menor que seja",
      "Para chegar a fazer alguma coisa, há que se repetir muitas vezes ou elevar o tom de voz"
    ]
  },
  {
    "n": 20,
    "name": "HIPERATIVIDADE/ HIPOATIVIDADE",
    "help": "Agitação, excitação desordenada e incontrolada, até grande passividade, com ausência total de resposta.",
    "options": [
      "A criança está constantemente em movimento",
      "Mesmo estimulada, não se move",
      "Barulhento. Dá a sensação de que é obrigado a fazer ruído/barulho",
      "Vai de um lugar a outro, sem parar",
      "Fica pulando (saltando) no mesmo lugar",
      "Não se move nunca do lugar onde está sentado"
    ]
  },
  {
    "n": 21,
    "name": "MOVIMENTOS ESTEREOTIPADOS E REPETITIVOS",
    "help": "Em repouso ou atividade, com início repentino.",
    "options": [
      "Balanceia-se",
      "Olha e brinca com as mãos e os dedos",
      "Tapa os olhos e as orelhas",
      "Dá pontapés",
      "Faz caretas e movimentos estranhos com a face",
      "Roda objetos ou sobre si mesmo",
      "Caminha na ponta dos pés ou saltando, arrasta os pés, anda fazendo movimentos estranhos",
      "Torce o corpo, mantém uma postura desequilibrada, pernas dobradas, cabeça recolhida aos pés, extensões violentas do corpo"
    ]
  },
  {
    "n": 22,
    "name": "IGNORA O PERIGO",
    "help": "Expõe-se a riscos sem ter consciência do perigo",
    "options": [
      "Não se dá conta do perigo",
      "Sobe em todos os lugares",
      "Parece insensível à dor"
    ]
  }
];
export const ATA_ONSET_LABEL = "Aparecimento antes dos 36 meses (DSM-IV)";

// ─── ASQ / SCQ ──────────────────────────────────────────────────────────────
/** `sim` / `nao` = pontos quando a resposta é Sim / Não (coluna do formulário). A pergunta 1 não pontua. */
export interface AsqItem { n: number; text: string; scored?: false; sim?: 0 | 1; nao?: 0 | 1 }
export const ASQ_ITEMS: readonly AsqItem[] = [
  {
    "n": 1,
    "text": "Ele é capaz de conversar usando frases curtas ou sentenças?",
    "scored": false
  },
  {
    "n": 2,
    "text": "Ele fala com você só para ser simpático, mais do que para obter algo?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 3,
    "text": "Você pode ter um diálogo (uma conversa com ele que envolva alternância, isto é, um de cada vez) a partir do que você disse?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 4,
    "text": "Ele usa frases estranhas ou diz algumas coisas repetidamente da mesma maneira? Isto é, ele copia ou repete qualquer frase que ele ouve outra pessoa dizer, ou ainda, ele constrói frases estranhas?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 5,
    "text": "Ele costuma usar socialmente perguntas inapropriadas ou declarações? Ele costuma fazer perguntas pessoais ou comentários em momentos inadequados?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 6,
    "text": "Ele costuma usar pronomes de forma invertida, dizendo você ou ele quando deveria usar eu?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 7,
    "text": "Ele costuma usar palavras que parece ter inventado ou criado sozinho, ou usa maneiras estranhas, indiretas, ou metafóricas para dizer coisas? Diz “chuva quente” aio invés de vapor.",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 8,
    "text": "Ele costuma dizer a mesma coisa repetidamente, exatamente da mesma maneira, ou insiste para você dizer as mesmas coisas muitas vezes?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 9,
    "text": "Existem coisas que são feitas por ele de maneira muito particular ou em determinada ordem, ou seguindo rituais que ele te obriga a fazer?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 10,
    "text": "Até onde você percebe, a expressão dele geralmente parece apropriada à situação particular?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 11,
    "text": "Ele alguma vez usou a tua mão como uma ferramenta, ou como se fosse parte do próprio corpo dele (por exemplo, apontando com o seu dedo, pondo a sua mão numa maçaneta para abrir a porta)?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 12,
    "text": "Ele costuma ter interesses especiais que parecem esquisitos as outras pessoas (semáforos, ralos de pia, ou itinerários de ônibus)?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 13,
    "text": "Ele costuma se interessar mais por partes de um objeto ou brinquedo (girar as rodas de um carro), mais do que usá-lo com sua função original?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 14,
    "text": "Ele costuma ter interesses específicos, apropriados para sua idade e para seu grupo de colegas, porém estranhos pela intensidade do interesse (conhecer todos os tipos de trens, conhecer muitos detalhes sobre dinossauros)?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 15,
    "text": "Ele costuma de maneira estranha olhar, sentir/examinar, escutar, provar ou cheirar coisas ou pessoas?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 16,
    "text": "Ele costuma ter maneirismos ou jeitos estranhos de mover suas mãos e dedos, tal como “um bater de asas” (flapping), ou mover seus dedos na frente dos seus olhos?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 17,
    "text": "Ele costuma fazer movimentos completos (e esquisitos) com o corpo inteiro, tal como girar, pular ou balancear repetidamente para frente e para trás?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 18,
    "text": "Ele costuma machucar-se de propósito, por exemplo, mordendo o braço ou batendo a cabeça?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 19,
    "text": "Ele tem algum objeto (que não um brinquedo macio ou cobertor) que ele carrega por toda parte?",
    "sim": 1,
    "nao": 0
  },
  {
    "n": 20,
    "text": "Ele tem algum amigo em particular ou melhor amigo?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 21,
    "text": "Quando ele tinha 4-5 anos ele repetia ou imitava espontaneamente o que você fazia (ou as outras pessoas) (tal como passar o aspirador no chão, cuidar da casa, lavar pratos, jardinagem, consertar coisas)?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 22,
    "text": "Quando ele tinha 4-5 anos ele apontava as coisas ao redor espontaneamente apenas para mostrar coisas a você (e não porque ele as desejava?)",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 23,
    "text": "Quando ele tinha 4-5 anos, costumava gesticular para mostrar o que ele queria (não considere se ele usava tua mão para apontar o que queria)?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 24,
    "text": "Quando ele tinha 4-5 anos usava a cabeça para dizer “sim”?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 25,
    "text": "Quando ele tinha 4-5 anos usava a cabeça para dizer “não”?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 26,
    "text": "Quando ele tinha 4-5 anos ele habitualmente olhava você diretamente no rosto quando fazia coisas com você ou conversava com você?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 27,
    "text": "Quando ele tinha 4-5 anos ele sorrida de volta de alguém sorrisse pra ele?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 28,
    "text": "Quando ele tinha 4-5 anos ele costumava mostrar coisas de seu interesse para chamar sua atenção?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 29,
    "text": "Quando ele tinha 4-5 anos ele costumava dividir coisas com você, além de alimentos?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 30,
    "text": "Quando ele tinha 4-5 anos ele costumava querer que você participasse de algo que estava divertindo?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 31,
    "text": "Quando ele tinha 4-5 anos ele costumava tentar confortá-lo se você ficasse triste ou magoado?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 32,
    "text": "Entre as idades de 4 a 5 anos, quando queria algo ou alguma ajuda, costumava olhar para você e fazia uso de sons ou palavras para receber sua atenção?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 33,
    "text": "Entre as idades de 4 a 5 anos tinha expressões faciais normais, insto é, demonstrava suas emoções por expressões faciais?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 34,
    "text": "Entre as idades de 4 a 5 anos, ele costumava participar espontaneamente e/ou tentava imitar ações em jogos sociais- tais como “pega-pega”?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 35,
    "text": "Quando ele estava com 4-5 anos jogava jogos imaginários ou brincava de “faz de conta”?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 36,
    "text": "Quando ele estava com 4-5 anos parecia interessado em outras crianças da mesma idade que ele não conhecia?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 37,
    "text": "Quando ele estava com 4-5 anos reagia positivamente quando outra criança se aproximava dele?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 38,
    "text": "Quando ele estava com 4-5 anos, se você entrasse no quarto e iniciasse uma com versa com ele sem chamar seu nome, ele habitualmente te olhava e prestava atenção em você?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 39,
    "text": "Quando ele estava com 4-5 anos ele costumava brincar de “faz de conta” com outras crianças, de forma que você percebia que eles estavam entendendo ser uma brincadeira?",
    "sim": 0,
    "nao": 1
  },
  {
    "n": 40,
    "text": "Quando ele estava com 4-5 anos ele brincava cooperativamente em jogos de grupo, tal como esconde-esconde e jogos com bola?",
    "sim": 0,
    "nao": 1
  }
];
/** Se a resposta à pergunta 1 for Não, estas perguntas não se aplicam. */
export const ASQ_SKIPPED_WHEN_NONVERBAL = [2, 3, 4, 5, 6, 7, 8] as const;

// ─── M-CHAT-R/F ─────────────────────────────────────────────────────────────
export interface PlainItem { n: number; text: string }
export const MCHAT_ITEMS: readonly PlainItem[] = [
  {
    "n": 1,
    "text": "Seu ﬁlho gosta de se balançar, de pular no seu joelho etc.?"
  },
  {
    "n": 2,
    "text": "Seu ﬁlho tem interesse por outras crianças?"
  },
  {
    "n": 3,
    "text": "Seu ﬁlho gosta de subir em coisas, como escadas ou móveis?"
  },
  {
    "n": 4,
    "text": "Seu ﬁlho gosta de brincar de esconder e mostrar o rosto ou de esconde-esconde?"
  },
  {
    "n": 5,
    "text": "Seu ﬁlho já brincou de faz-de-conta, como, por exemplo, fazer de conta que está falando no telefone ou que está cuidando da boneca, ou qualquer outra brincadeira de faz -de- conta?"
  },
  {
    "n": 6,
    "text": "Seu ﬁlho já usou o dedo indicador dele para apontar, para pedir alguma coisa?"
  },
  {
    "n": 7,
    "text": "Seu ﬁlho já usou o dedo indicador dele para apontar, para indicar interesse em algo?"
  },
  {
    "n": 8,
    "text": "Seu ﬁlho consegue brincar de forma correta com brinquedos pequenos (ex. carros ou blocos), sem apenas colocar na boca, remexer no brinquedo ou deixar o brinquedo cair?"
  },
  {
    "n": 9,
    "text": "O seu ﬁlho alguma vez trouxe objetos para você (pais) para lhe mostrar este objeto?"
  },
  {
    "n": 10,
    "text": "O seu ﬁlho olha para você no olho por mais de um segundo ou dois?"
  },
  {
    "n": 11,
    "text": "O seu ﬁlho já pareceu muito sensível ao barulho (ex. tapando os ouvidos)?"
  },
  {
    "n": 12,
    "text": "O seu ﬁlho sorri em resposta ao seu rosto ou ao seu sorriso?"
  },
  {
    "n": 13,
    "text": "O seu ﬁlho imita você? (ex. você faz expressões/caretas e seu ﬁlho imita?)"
  },
  {
    "n": 14,
    "text": "O seu ﬁlho responde quando você o chama pelo nome?"
  },
  {
    "n": 15,
    "text": "Se você aponta um brinquedo do outro lado do cômodo, o seu ﬁlho olha para ele?"
  },
  {
    "n": 16,
    "text": "Seu ﬁlho já sabe andar?"
  },
  {
    "n": 17,
    "text": "O seu ﬁlho olha para coisas que você está olhando?"
  },
  {
    "n": 18,
    "text": "O seu ﬁlho faz movimentos estranhos com os dedos perto do rosto dele?"
  },
  {
    "n": 19,
    "text": "O seu ﬁlho tenta atrair a sua atenção para a atividade dele?"
  },
  {
    "n": 20,
    "text": "Você alguma vez já se perguntou se seu ﬁlho é surdo?"
  },
  {
    "n": 21,
    "text": "O seu ﬁlho entende o que as pessoas dizem?"
  },
  {
    "n": 22,
    "text": "O seu ﬁlho às vezes ﬁca aéreo, “olhando para o nada” ou caminhando sem direção deﬁnida?"
  },
  {
    "n": 23,
    "text": "O seu ﬁlho olha para o seu rosto para conferir a sua reação quando vê algo estranho?"
  }
];

// ─── SRS-2 ──────────────────────────────────────────────────────────────────
export const SRS2_ITEMS: readonly PlainItem[] = [
  {
    "n": 1,
    "text": "Parece muito mais inquieta em situações sociais do que quanto está sozinha."
  },
  {
    "n": 2,
    "text": "As expressões em seu rosto são combinam com o que está dizendo."
  },
  {
    "n": 3,
    "text": "Parece confiante (ou segura) quanto está interagindo com outras pessoas."
  },
  {
    "n": 4,
    "text": "na sobrecarga de estímulos, apresenta padrões rígidos ou inflexíveis de comportamento que parecem estranhos."
  },
  {
    "n": 5,
    "text": "Não percebe quando os outros estão tentando tirar vantagem dela."
  },
  {
    "n": 6,
    "text": "Prefere estar sozinho a estar com os outros."
  },
  {
    "n": 7,
    "text": "Demonstra perceber o que os outros estão pensando ou sentindo."
  },
  {
    "n": 8,
    "text": "Se comporta de maneira estranha ou bizarra."
  },
  {
    "n": 9,
    "text": "Fica próxima a adultos, parece ser muito dependente deles."
  },
  {
    "n": 10,
    "text": "Leva as coisas muito “ao pé da letra” e não compreende o real significado de uma conversa."
  },
  {
    "n": 11,
    "text": "É autoconfiante."
  },
  {
    "n": 12,
    "text": "É capaz de comunicar seus sentimentos para as outras pessoas."
  },
  {
    "n": 13,
    "text": "É estranha na “tomada de vez” das interações com seus colegas (por exemplo, não parece entender a reciprocidade de uma conversa)."
  },
  {
    "n": 14,
    "text": "Não tem boa coordenação."
  },
  {
    "n": 15,
    "text": "É capaz de entender o tom de voz e as expressões faciais das outras pessoas."
  },
  {
    "n": 16,
    "text": "Evita o contato visual ou tem contato visual diferente."
  },
  {
    "n": 17,
    "text": "Reconhece quando algo é injusto."
  },
  {
    "n": 18,
    "text": "Tem dificuldade em fazer amigos, mesmo tentando dar o melhor de si."
  },
  {
    "n": 19,
    "text": "Fica frustrada quando não consegue expressar suas ideias em uma conversa."
  },
  {
    "n": 20,
    "text": "Mostra interesses sensoriais incomuns (por exemplo, coloca na boca ou gira objetos) ou formar estranhas de brincar com brinquedos."
  },
  {
    "n": 21,
    "text": "É capaz de imitar as ações de outras pessoas."
  },
  {
    "n": 22,
    "text": "Brinca adequadamente com crianças da sua idade."
  },
  {
    "n": 23,
    "text": "Não participa de atividades em grupo a menos que seja convidada a fazê-lo."
  },
  {
    "n": 24,
    "text": "Tem mais dificuldade do que outras crianças com mudanças na sua rotina."
  },
  {
    "n": 25,
    "text": "Não parece de importar em estar fora de sintonia ou em um “mundo” diferente dos outros."
  },
  {
    "n": 26,
    "text": "Oferece conforto para os outros quando estão tristes."
  },
  {
    "n": 27,
    "text": "Evita iniciar interações sociais com seus colegas ou adultos."
  },
  {
    "n": 28,
    "text": "Pensa ou fala sobre a mesma coisa repetidamente."
  },
  {
    "n": 29,
    "text": "É considerada como estranha ou esquisita por outras crianças."
  },
  {
    "n": 30,
    "text": "Fica perturbada em uma situação com muitas coisas acontecendo."
  },
  {
    "n": 31,
    "text": "Não consegue tirar algo da sua mente uma vez que começa a pensar."
  },
  {
    "n": 32,
    "text": "Tem boa higiene pessoal."
  },
  {
    "n": 33,
    "text": "É socialmente desajeitada, mesmo quando tenta ser educada."
  },
  {
    "n": 34,
    "text": "Evita pessoas que querem se aproximar dela por meio de contato afetivo."
  },
  {
    "n": 35,
    "text": "Tem dificuldade em acompanhar o fluxo de uma conversa normal."
  },
  {
    "n": 36,
    "text": "Tem dificuldade em se relacionar com adultos."
  },
  {
    "n": 37,
    "text": "Tem dificuldade em se relacionar com seus colegas."
  },
  {
    "n": 38,
    "text": "Responde adequadamente às mudanças de humor dos outros (por exemplo, quando o humor de um amigo ou companheiro muda de feliz para triste)."
  },
  {
    "n": 39,
    "text": "Tem uma variedade de interesses extraordinariamente incomuns."
  },
  {
    "n": 40,
    "text": "É imaginativa, hábil em fantasiar (sem perder contato com a realidade)."
  },
  {
    "n": 41,
    "text": "Muda de uma atividade para outra sem objetivo aparente."
  },
  {
    "n": 42,
    "text": "Parece excessivamente sensível aos sons, texturas e cheiros."
  },
  {
    "n": 43,
    "text": "Se separa facilmente (ou frequentemente) dos cuidadores."
  },
  {
    "n": 44,
    "text": "Não entende como os acontecimentos se encadeiam entre si (causa e efeito), da mesma maneira que outros da sua idade fazem."
  },
  {
    "n": 45,
    "text": "Dirige sua atenção para onde os outros estão olhando ou ouvindo."
  },
  {
    "n": 46,
    "text": "Tem expressão facial excessivamente séria."
  },
  {
    "n": 47,
    "text": "Comporta-se como tola ou ri de forma inadequada."
  },
  {
    "n": 48,
    "text": "Tem senso de humor e entende as piadas."
  },
  {
    "n": 49,
    "text": "É muito hábil em algumas tarefas específicas, mas não consegue fazer tão bem a maioria das outras tarefas."
  },
  {
    "n": 50,
    "text": "Tem comportamentos repetitivos, estranhos, agita as mãos ou balança o corpo."
  },
  {
    "n": 51,
    "text": "Tem dificuldade em responder perguntas objetivamente, e fala em torno do assunto."
  },
  {
    "n": 52,
    "text": "Sabe quando está falando muito alto ou fazendo muito barulho."
  },
  {
    "n": 53,
    "text": "Fala com as pessoas com um tom de voz incomum (por exemplo, fala como um robô ou come se estivesse dando uma palestra)."
  },
  {
    "n": 54,
    "text": "Parece agir com as pessoas como se elas fossem objetos."
  },
  {
    "n": 55,
    "text": "Sabe quando está muito próxima ou invadindo o espaço de alguém."
  },
  {
    "n": 56,
    "text": "Caminha entre duas pessoas que estão conversando."
  },
  {
    "n": 57,
    "text": "Sofre provocações de colegas."
  },
  {
    "n": 58,
    "text": "Concentra-se demais em partes das coisas e não no todo: se solicitada para descrever o que aconteceu em um história, fala só das roupas."
  },
  {
    "n": 59,
    "text": "É excessivamente desconfiada."
  },
  {
    "n": 60,
    "text": "É emocionalmente distante, não demonstrando seus sentimentos."
  },
  {
    "n": 61,
    "text": "É inflexível e tem dificuldade para mudar de ideia."
  },
  {
    "n": 62,
    "text": "Dá explicações incomuns ou ilógicas do porquê de fazer as coisas."
  },
  {
    "n": 63,
    "text": "Toca os outros de maneira incomum (apenas para fazer contato e depois ir embora sem dizer nada)."
  },
  {
    "n": 64,
    "text": "Fica muito agitada em situações sociais."
  },
  {
    "n": 65,
    "text": "Fica com olhar perdido ou olha fixamente para o nada."
  }
];
export const SRS2_SCALE = [
  { value: 1, label: "Não é verdade" },
  { value: 2, label: "Algumas vezes é verdade" },
  { value: 3, label: "Muitas vezes é verdade" },
  { value: 4, label: "Quase sempre é verdade" },
] as const;

// ─── ABC ────────────────────────────────────────────────────────────────────
export const ABC_DOMAINS = [
  { code: "ES", label: "Estímulo sensorial" },
  { code: "RE", label: "Relacionamento" },
  { code: "CO", label: "Uso do corpo e objetos" },
  { code: "LG", label: "Linguagem" },
  { code: "PS", label: "Pessoal / social" },
] as const;
export type AbcDomainCode = (typeof ABC_DOMAINS)[number]["code"];
export interface AbcTeaItem { n: number; text: string; domain: AbcDomainCode; weight: 1 | 2 | 3 | 4 }
export const ABC_TEA_ITEMS: readonly AbcTeaItem[] = [
  {
    "n": 1,
    "text": "Gira em torno de si por longo período de tempo",
    "domain": "CO",
    "weight": 4
  },
  {
    "n": 2,
    "text": "Aprende uma tarefa, mas esquece rapidamente",
    "domain": "PS",
    "weight": 2
  },
  {
    "n": 3,
    "text": "É raro atender a estímulo não-verbal social (expressões, gestos)",
    "domain": "RE",
    "weight": 4
  },
  {
    "n": 4,
    "text": "Ausência de resposta para solicitações verbais (fala/comandos)",
    "domain": "LG",
    "weight": 4
  },
  {
    "n": 5,
    "text": "Usa brinquedos de maneira inapropriada/não funcional",
    "domain": "CO",
    "weight": 2
  },
  {
    "n": 6,
    "text": "Apresenta fraco desenvolvimento de linguagem pronominal (reversa)",
    "domain": "LG",
    "weight": 3
  },
  {
    "n": 7,
    "text": "Apresenta sobressalto ou pisca quando luz forte é acesa",
    "domain": "ES",
    "weight": 1
  },
  {
    "n": 8,
    "text": "Não estabelece contato visual com as pessoas",
    "domain": "RE",
    "weight": 4
  },
  {
    "n": 9,
    "text": "Isola-se de outras pessoas e crianças",
    "domain": "RE",
    "weight": 4
  },
  {
    "n": 10,
    "text": "Emite sons estranhos, agudos ou gritos de forma repetitiva",
    "domain": "LG",
    "weight": 3
  },
  {
    "n": 11,
    "text": "Balança-se por longos períodos de tempo",
    "domain": "CO",
    "weight": 4
  },
  {
    "n": 12,
    "text": "Não reage a estímulos dolorosos intensos",
    "domain": "ES",
    "weight": 3
  },
  {
    "n": 13,
    "text": "Apresenta ecolalia (imediata ou tardia)",
    "domain": "LG",
    "weight": 3
  },
  {
    "n": 14,
    "text": "Não responde quando o chamam pelo próprio nome",
    "domain": "RE",
    "weight": 2
  },
  {
    "n": 15,
    "text": "Anda nas pontas dos pés",
    "domain": "CO",
    "weight": 2
  },
  {
    "n": 16,
    "text": "Apresenta crises de birra violentas e/ou frequentes",
    "domain": "PS",
    "weight": 3
  },
  {
    "n": 17,
    "text": "Não usa gestos ou mímica para se comunicar ou pedir algo",
    "domain": "LG",
    "weight": 2
  },
  {
    "n": 18,
    "text": "Executa rituais motores rígidos (como alinhar objetos)",
    "domain": "CO",
    "weight": 4
  },
  {
    "n": 19,
    "text": "Parece não ouvir (comportamento de surdez aparente)",
    "domain": "ES",
    "weight": 4
  },
  {
    "n": 20,
    "text": "Segura insistentemente determinado objeto nas mãos",
    "domain": "CO",
    "weight": 3
  },
  {
    "n": 21,
    "text": "Demonstra apego excessivo a objetos específicos",
    "domain": "RE",
    "weight": 3
  },
  {
    "n": 22,
    "text": "Cheira ou morde objetos não alimentares frequentemente",
    "domain": "ES",
    "weight": 4
  },
  {
    "n": 23,
    "text": "Leva a mão do adulto até o objeto que deseja (uso instrumental)",
    "domain": "RE",
    "weight": 3
  },
  {
    "n": 24,
    "text": "Bate palmas ou balança as mãos (flapping) quando agitado",
    "domain": "CO",
    "weight": 4
  },
  {
    "n": 25,
    "text": "Tem rituais rígidos de alimentação ou seletividade severa",
    "domain": "PS",
    "weight": 3
  },
  {
    "n": 26,
    "text": "Repete frases inteiras ou comerciais fora de contexto",
    "domain": "LG",
    "weight": 3
  },
  {
    "n": 27,
    "text": "Não responde a elogios ou demonstrações de afeto",
    "domain": "RE",
    "weight": 2
  },
  {
    "n": 28,
    "text": "Apresenta risos incontroláveis ou sem motivo aparente",
    "domain": "PS",
    "weight": 2
  },
  {
    "n": 29,
    "text": "Não aceita mudanças na sua rotina diária",
    "domain": "RE",
    "weight": 3
  },
  {
    "n": 30,
    "text": "Machuca a si mesmo (autoagressão: morder-se, bater a cabeça)",
    "domain": "CO",
    "weight": 2
  },
  {
    "n": 31,
    "text": "Não demonstra medo ante perigos reais",
    "domain": "PS",
    "weight": 3
  },
  {
    "n": 32,
    "text": "Demonstra hipersensibilidade a ruídos ou sons comuns",
    "domain": "ES",
    "weight": 3
  },
  {
    "n": 33,
    "text": "Apresenta flacidez ou hipotonia muscular generalizada",
    "domain": "CO",
    "weight": 1
  },
  {
    "n": 34,
    "text": "É incapaz de imitar sons ou palavras de forma intencional",
    "domain": "LG",
    "weight": 4
  },
  {
    "n": 35,
    "text": "Apresenta distúrbios graves ou persistentes do sono",
    "domain": "PS",
    "weight": 3
  },
  {
    "n": 36,
    "text": "Prefere brincar sozinho do que acompanhado",
    "domain": "RE",
    "weight": 4
  },
  {
    "n": 37,
    "text": "Olha fixamente para o vazio por longos períodos de tempo",
    "domain": "ES",
    "weight": 4
  },
  {
    "n": 38,
    "text": "Lambe ou chupa objetos e superfícies",
    "domain": "ES",
    "weight": 3
  },
  {
    "n": 39,
    "text": "Não sorri ao interagir com outras pessoas",
    "domain": "RE",
    "weight": 2
  },
  {
    "n": 40,
    "text": "Não consegue se vestir ou fazer higiene sem ajuda total",
    "domain": "PS",
    "weight": 1
  },
  {
    "n": 41,
    "text": "Repete a mesma pergunta várias vezes de forma mecânica",
    "domain": "LG",
    "weight": 3
  },
  {
    "n": 42,
    "text": "Resiste fortemente ao toque físico ou ao ser abraçado",
    "domain": "RE",
    "weight": 3
  },
  {
    "n": 43,
    "text": "Apresenta fascinação por objetos que giram (ex: ventilador, rodas)",
    "domain": "ES",
    "weight": 4
  },
  {
    "n": 44,
    "text": "Gosta de empilhar objetos de forma muito específica",
    "domain": "CO",
    "weight": 2
  },
  {
    "n": 45,
    "text": "Não se assusta com ruídos fortes repentinos",
    "domain": "ES",
    "weight": 2
  },
  {
    "n": 46,
    "text": "Parece não reconhecer membros da própria família",
    "domain": "RE",
    "weight": 3
  },
  {
    "n": 47,
    "text": "Não chora ou pede ajuda quando está com dor real",
    "domain": "PS",
    "weight": 2
  },
  {
    "n": 48,
    "text": "Tem dificuldades motoras ou de equilíbrio (atrapalhado)",
    "domain": "CO",
    "weight": 2
  },
  {
    "n": 49,
    "text": "Apresenta pouco ou nenhum interesse pelo aprendizado",
    "domain": "PS",
    "weight": 2
  },
  {
    "n": 50,
    "text": "Fala de si mesmo na terceira pessoa (ex: \"O João quer\")",
    "domain": "LG",
    "weight": 3
  },
  {
    "n": 51,
    "text": "Interrompe o diálogo ou a atividade de forma abrupta",
    "domain": "LG",
    "weight": 2
  },
  {
    "n": 52,
    "text": "Passa a mão na parede, mesas ou texturas minuciosamente",
    "domain": "ES",
    "weight": 2
  },
  {
    "n": 53,
    "text": "Não brinca de \"faz de conta\" (ausência de jogo simbólico)",
    "domain": "RE",
    "weight": 3
  },
  {
    "n": 54,
    "text": "Não responde a expressões faciais de outras pessoas",
    "domain": "RE",
    "weight": 3
  },
  {
    "n": 55,
    "text": "Apresenta movimentos estereotipados com os dedos",
    "domain": "CO",
    "weight": 3
  },
  {
    "n": 56,
    "text": "Apresenta habilidades isoladas e inesperadas (ex: memória)",
    "domain": "PS",
    "weight": 1
  },
  {
    "n": 57,
    "text": "Tem medo irracional de objetos ou situações inofensivas",
    "domain": "PS",
    "weight": 2
  }
];

export const TEA_RESPONDENTS = [
  { value: "mae_pai", label: "Mãe / pai" },
  { value: "responsavel", label: "Outro responsável legal" },
  { value: "professor", label: "Professor(a)" },
  { value: "outro", label: "Outro" },
] as const;
export type TeaRespondent = (typeof TEA_RESPONDENTS)[number]["value"];

/**
 * Textos de referência do formulário-fonte, transcritos como estão. Só aparecem para quem tiver a
 * capacidade "tea.reference.view" (desligada por padrão até a validação clínica) e NUNCA viram rótulo de diagnóstico.
 */
export const TEA_REFERENCE_NOTES: Record<TeaInstrumentCode, readonly string[]> = {
  ata: ["Formulário-fonte: ponto de corte 15 pontos."],
  asq: [
    "Formulário-fonte: menos de 15 pontos = baixa probabilidade; 15 pontos ou mais = nota de corte principal, indica encaminhar para avaliação clínica aprofundada; acima de 22 pontos = ajuda a diferenciar TEA clássico de outras variantes.",
  ],
  mchat: [
    "Formulário-fonte: 0 a 1 = risco inexistente; 2 ou mais = possibilidade de autismo, encaminhar para avaliação especializada; 8 a 20 = risco elevado, avaliação urgente. (Pendente: direção de cada pergunta e versão de 20 ou 23 itens.)",
  ],
  srs2: [
    "Formulário-fonte (pontuação T): menos de 60 = normal; 60 a 65 = leve; 66 a 75 = moderado; 76 ou mais = grave. (Requer tabelas de normas da editora.)",
  ],
  abc: [
    "Critério A do formulário-fonte: nota de corte Brasil 49 pontos (o texto traz '>49 baixa probabilidade' e '49 ou mais alta probabilidade', que se contradizem).",
    "Critério B do formulário-fonte: menos de 47 = normal; 47 a 53 = probabilidade baixa; 54 a 67 = moderada; acima de 67 = autismo.",
    "Os totais por área do quadro-resumo (ES 30, RE 38, CO 37, LG 31, PS 23 = 159) não batem com a soma dos itens da própria lista (ES 30, RE 43, CO 33, LG 30, PS 24 = 160).",
  ],
};
