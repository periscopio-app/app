/**
 * Formulários das especialidades delegadas pelo médico (fonoaudiologia, psicopedagogia, psicologia,
 * neuropsicologia, psicomotricidade e serviço social).
 *
 * Fonte: capítulos "Cap FONO", "Cap PpC", "Cap Psico", "Cap PSICOMOT" (Plataforma 1809) e "Cap AS" (2109).
 * Mesmo motor do formulário do RE (`re-journey-catalog.ts`): campos como dados, mesma tela, mesma validação.
 *
 * REGRAS DE PRODUTO (não mudar sem validação clínica):
 *  - Só o que está nos PDFs. Nenhum campo clínico inventado.
 *  - INSTRUMENTOS: guardamos só o RESULTADO que o profissional digita ou marca (pontuação, percentil, classificação).
 *    Os itens dos testes (SRS-2, MASC, SCARED, CBCL, ASQ, WISC-IV, TDE II, ABFW, Bateria Psicomotora...) não são
 *    reproduzidos: dependem de licença e versão confirmadas pelo dono clínico.
 *  - NENHUM CÁLCULO: o sistema não soma, não pesa, não converte em escore padrão, não classifica e não aponta
 *    "alto/baixo". A Dra. informou que os formulários não têm peso determinado; por isso o resumo visual só mostra
 *    o que o profissional marcou, com a mesma cor para qualquer resposta (ver `resumo-visual.ts`).
 *  - Em branco continua em branco (nunca vira "não").
 *  - Aluno só por código: nome, endereço, telefone, nome de pais e responsáveis foram omitidos de propósito.
 *  - Termos de consentimento (TCLE do grupo de pais, contrato da TAC) NÃO são formulários clínicos: entram no
 *    módulo de consentimento (P1).
 */

import { FORM_BUILDERS, aplicarRegrasDeOpcoes, type CampoMatriz, type FormDef, type ReCampo, type ReOpcao, type ReSecao } from "./re-journey-catalog";

const { t, tl, u, m, o, linhas } = FORM_BUILDERS;

export const ESP_FORMS_VERSION = "esp-0.1-rascunho" as const;

export const ESPECIALIDADES_COM_FORMS = [
  "fonoaudiologia",
  "psicopedagogia",
  "psicologia",
  "neuropsicologia",
  "psicomotricidade",
  "servico_social",
] as const;
export type EspecialidadeId = (typeof ESPECIALIDADES_COM_FORMS)[number];

export const ESPECIALIDADE_NOMES: Record<EspecialidadeId, string> = {
  fonoaudiologia: "Fonoaudiologia",
  psicopedagogia: "Psicopedagogia clínica",
  psicologia: "Psicologia",
  neuropsicologia: "Neuropsicologia",
  psicomotricidade: "Psicomotricidade",
  servico_social: "Serviço social",
};

export function isEspecialidadeId(v: unknown): v is EspecialidadeId {
  return typeof v === "string" && (ESPECIALIDADES_COM_FORMS as readonly string[]).includes(v);
}

// ── Opções reutilizadas ────────────────────────────────────────────────────────────────────────

const NS: ReOpcao[] = [o("nao", "Não"), o("sim", "Sim")];
const NS_NA: ReOpcao[] = [o("nao", "Não"), o("sim", "Sim"), o("nao_se_aplica", "Não se aplica")];
const SIM_NAO_NAV: ReOpcao[] = [o("sim", "Sim"), o("nao", "Não"), o("nao_avaliado", "Não avaliado")];
const TRAT: ReOpcao[] = [o("nao", "Não"), o("realizado", "Realizado"), o("atual", "Atual")];
const ESP_ALT: ReOpcao[] = [o("esperado", "Esperado"), o("alterado", "Alterado")];
const PRES_ALT: ReOpcao[] = [o("preservada", "Preservada"), o("alterada", "Alterada")];
const ADEQ_ALT: ReOpcao[] = [o("adequado", "Adequado"), o("alterado", "Alterado")];
const NORMAL_ALT: ReOpcao[] = [o("normal", "Normal"), o("alterado", "Alterado")];
const DENTRO_FORA: ReOpcao[] = [o("dentro", "Dentro do esperado"), o("fora", "Fora do esperado")];
const ADEQ_DEF_NAV: ReOpcao[] = [o("adequado", "Adequado"), o("deficit", "Déficit"), o("nao_avaliado", "Não avaliado")];
const NORMAL_ALT_NS: ReOpcao[] = [o("normal", "Normal"), o("alterado", "Alterado"), o("nao_sei", "Não sei")];
const NORMAL_ALT_NA: ReOpcao[] = [o("normal", "Normal"), o("alterado", "Alterado"), o("nao_se_aplica", "Não se aplica")];
const ADQUIRIU: ReOpcao[] = [
  o("adquiriu", "Adquiriu"),
  o("maioria", "Adquiriu a maioria"),
  o("parcialmente", "Adquiriu parcialmente"),
  o("nao_adquiriu", "Não adquiriu"),
];
const ADQUIRIU3: ReOpcao[] = [o("adquiriu", "Adquiriu"), o("parcialmente", "Adquiriu parcialmente"), o("nao_adquiriu", "Não adquiriu")];
const VINCULO: ReOpcao[] = [
  o("adequado", "Adequado"),
  o("parcialmente", "Parcialmente comprometido"),
  o("comprometido", "Comprometido"),
];
/** Classificação que o próprio instrumento publica (o profissional escolhe; o sistema não converte). */
const CLASSE_6: ReOpcao[] = [
  o("superior", "Superior"),
  o("medio_superior", "Médio superior"),
  o("medio", "Médio"),
  o("medio_inferior", "Médio inferior"),
  o("alerta_deficit", "Alerta para déficit"),
  o("deficit", "Déficit"),
];
const CLASSE_PADRAO: ReOpcao[] = [
  o("muito_baixa", "Muito baixa"),
  o("baixa", "Baixa"),
  o("media", "Média"),
  o("alta", "Alta"),
  o("muito_alta", "Muito alta"),
];
const CLASSE_WISC: ReOpcao[] = [
  o("extremamente_baixo", "Extremamente baixo"),
  o("limitrofe", "Limítrofe"),
  o("medio_inferior", "Médio inferior"),
  o("medio", "Médio"),
  o("medio_superior", "Médio superior"),
  o("superior", "Superior"),
];
const CLASSE_REY: ReOpcao[] = [
  o("inferior", "Inferior"),
  o("medio_inferior", "Médio inferior"),
  o("medio", "Médio"),
  o("medio_superior", "Médio superior"),
  o("superior", "Superior"),
];
/** Níveis 1 a 4 marcados pelo profissional na bateria psicomotora. O significado de cada nível fica no instrumento. */
const NIVEL_1_4: ReOpcao[] = [o("1", "1"), o("2", "2"), o("3", "3"), o("4", "4")];
const NIVEL_0_5: ReOpcao[] = ["0", "1", "2", "3", "4", "5"].map((v) => o(v, v));
const DATA_NOTA = "Escolha a data no calendário.";

// ── Construtores ───────────────────────────────────────────────────────────────────────────────

/** Tabela de respostas por linha (escolha única por linha, sem observação). */
function mx(key: string, label: string, rows: [string, string][], opcoes: ReOpcao[], extra: Partial<CampoMatriz> = {}): CampoMatriz {
  return { key, label, tipo: "matriz", linhas: linhas(...rows), opcoes, exclusiva: true, comObs: false, ...extra };
}
/** Lista de perguntas Não/Sim (uma observação opcional por linha). */
const ns = (key: string, label: string, rows: [string, string][], obs = true) => mx(key, label, rows, NS, { comObs: obs });
/** Escolha única forçada (classificação que o profissional marca; nunca vira múltipla). */
const ue = (key: string, label: string, opcoes: ReOpcao[], ajuda?: string): ReCampo => ({ ...u(key, label, opcoes, ajuda), exclusiva: true, comObs: false });
const data = (key: string, label: string): ReCampo => t(key, label, DATA_NOTA);
const opc = (c: ReCampo): ReCampo => ({ ...c, opcional: true });
const sec = (id: string, titulo: string, campos: ReCampo[], descricao?: string): ReSecao => ({ id, titulo, descricao, campos });

function def(
  id: string,
  letra: string,
  titulo: string,
  tituloCurto: string,
  dica: string,
  secoes: ReSecao[],
  pendenciasDeValidacao: string[] = []
): FormDef {
  return aplicarRegrasDeOpcoes({
    id,
    code: id,
    letra,
    titulo,
    tituloCurto,
    dica,
    secoes: [...secoes, sec("observacoes", "Observações", [opc(tl("observacoes", "Observações"))])],
    pendenciasDeValidacao: [
      "Cadastro do aluno (nome, nascimento, escola, série, sexo) vem do caso. Nome, endereço, telefone e nomes de familiares foram omitidos de propósito (LGPD).",
      ...pendenciasDeValidacao,
    ],
  });
}

const AVISO_RESULTADO = "Registre só o resultado do teste, como no laudo do instrumento. O sistema não calcula nem interpreta.";

/** Perguntas de anamnese de escolaridade e tratamentos, comuns a fono e psicopedagogia. */
const TRATAMENTOS = mx(
  "tratamentos",
  "Tratamentos",
  [
    ["fonoaudiologico", "Fonoaudiológico"],
    ["medico", "Médico"],
    ["psicologico", "Psicológico"],
    ["fisioterapico", "Fisioterápico"],
    ["odontologico", "Odontológico"],
  ],
  TRAT
);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// FONOAUDIOLOGIA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const FONO_ANAMNESE = def(
  "fono_anamnese",
  "1",
  "Anamnese fonoaudiológica",
  "Anamnese",
  "Preencha com o responsável. Use a observação para o complemento (ex.: até quando, qual, quando).",
  [
    sec("audicao", "Audição", [
      ns("audicao", "Audição", [
        ["pede_repetir", "Sempre pede para repetir a informação"],
        ["escuta_nao_entende", "Parece que escuta, mas não entende"],
        ["aumenta_volume_tv", "Pede para aumentar o volume da TV"],
        ["fala_alto", "Fala alto"],
        ["otites", "Teve otites de repetição"],
        ["exame_audicao", "Já fez exame de audição (qual e quando?)"],
      ]),
    ]),
    sec("alimentacao", "Alimentação", [
      ns("alimentacao", "Alimentação", [
        ["seio", "Mamou no seio (até quando?)"],
        ["mamadeira", "Tomou mamadeira (até quando?)"],
        ["pastosa", "Aceitou bem alimentação pastosa (quando iniciou?)"],
        ["solida", "Aceitou bem alimentação sólida (quando iniciou?)"],
        ["copo", "Usa copo"],
        ["chupeta", "Usou ou usa chupeta (quando deixou de usar?)"],
        ["succao_digital", "Tem ou teve hábito de sucção digital"],
        ["baba", "Apresenta baba"],
      ]),
      opc(tl("alimentacao_atual", "Alimentação atual")),
    ]),
    sec("linguagem_oral", "Desenvolvimento da linguagem oral", [
      ns("linguagem_oral", "Linguagem oral", [
        ["balbucio", "Balbucio"],
        ["trocas_fala", "Trocas na fala (quais?)"],
        ["disfluencias", "Disfluências (como?)"],
        ["ecolalia", "Ecolalia"],
        ["estagnacao_fala", "Estagnação da fala"],
        ["procurou_ajuda", "Procurou ajuda de algum profissional (qual?)"],
        ["faz_de_conta", "Brincava de faz de conta"],
      ]),
      t("idade_primeiras_palavras", "Idade da produção das primeiras palavras"),
      t("idade_primeiras_frases", "Idade da produção das primeiras frases"),
    ]),
    sec("comunicacao", "Comunicação atual", [
      ns("comunicacao", "Comunicação atual", [
        ["compreendida", "É compreendida (se não, como reage?)"],
        ["compreende_ordens", "Compreende ordens"],
        ["bilinguismo", "Presença de bilinguismo em casa (qual a frequência?)"],
        ["usa_gestos", "Usa gestos (em que momentos?)"],
        ["estereotipias", "Apresenta estereotipias (em que momentos?)"],
        ["se_expressa", "Consegue se expressar (se não, como reage?)"],
        ["interage", "Interage adequadamente (se não, em quais situações?)"],
        ["gagueja", "Gagueja (desde quando?)"],
      ]),
    ]),
    sec("escolaridade", "Escolaridade", [
      t("idade_entrada_escola", "Com que idade entrou na escola?"),
      ns("escolaridade", "Escolaridade", [
        ["mudanca_escola", "Houve mudança de escola (por quê?)"],
        ["adaptou", "Adaptou-se bem"],
        ["gosta_escola", "Gosta de ir à escola"],
        ["vinculo_professor", "Tem bom vínculo com o professor"],
        ["vinculo_colegas", "Tem bom vínculo com os colegas"],
        ["estuda_casa", "Estuda em casa (qual frequência?)"],
        ["reprovacao", "Reprovação (quais anos?)"],
        ["notas_baixas", "Notas baixas com frequência (quais disciplinas?)"],
        ["reforco", "Indicação de reforço (quais disciplinas?)"],
      ]),
    ]),
    sec("linguagem_escrita", "Linguagem escrita", [
      ns("linguagem_escrita", "Linguagem escrita", [
        ["dif_alfabetizacao", "Dificuldades na alfabetização"],
        ["erros_leitura", "Erros na leitura"],
        ["leitura_lenta", "Leitura lenta"],
        ["erros_escrita", "Erros na escrita"],
        ["caligrafia", "Caligrafia ininteligível"],
        ["producao_texto", "Produção de texto inadequada"],
        ["pede_ajuda_leitura", "Pede ajuda para leitura"],
        ["compreende_ouvir", "Compreende melhor ao ouvir do que ao ler"],
      ]),
    ]),
    sec("tratamentos", "Tratamentos", [
      TRATAMENTOS,
      m(
        "procedimento_odontologico",
        "Procedimento realizado (odontológico)",
        [o("aparelho_fixo", "Aparelho fixo"), o("aparelho_removivel", "Aparelho removível"), o("protese", "Prótese"), o("implante", "Implante cirúrgico")],
        "Qual e quando?"
      ),
    ]),
    sec("familia", "Família", [
      ns("familia", "Família", [
        ["habito_leitura", "Hábitos de leitura (frequência)"],
        ["habito_escrita", "Hábitos de escrita (frequência)"],
        ["dificuldade_familia", "Alguém na família tem ou teve dificuldade escolar ou de fala (quem? qual?)"],
      ]),
    ]),
    sec("conclusao", "Conclusão", [tl("conclusao", "Conclusão da anamnese")]),
  ]
);

const FONO_AUDICAO = def(
  "fono_audicao",
  "2.5",
  "Avaliação audiológica",
  "Audição",
  AVISO_RESULTADO,
  [
    sec("exames", "Exames realizados", [
      m(
        "exames_realizados",
        "Exames realizados",
        [o("audiometria_tonal", "Audiometria tonal"), o("audiometria_vocal", "Audiometria vocal (logoaudiometria)"), o("impedanciometria", "Impedanciometria")],
        undefined
      ),
    ]),
    sec("resultados", "Resultados da avaliação audiológica", [
      mx(
        "limiar_auditivo",
        "Limiar auditivo (dB)",
        [
          ["od", "Orelha direita (OD)"],
          ["oe", "Orelha esquerda (OE)"],
        ],
        NORMAL_ALT,
        { comNumero: "dB" }
      ),
      mx(
        "limiar_srt",
        "Limiar de reconhecimento de fala — SRT (dB)",
        [
          ["od", "Orelha direita (OD)"],
          ["oe", "Orelha esquerda (OE)"],
        ],
        NORMAL_ALT,
        { comNumero: "dB" }
      ),
      mx(
        "iprf",
        "Índice percentual de reconhecimento de fala — IPRF (%)",
        [
          ["od", "Orelha direita (OD)"],
          ["oe", "Orelha esquerda (OE)"],
        ],
        NORMAL_ALT,
        { comNumero: "%", comObs: true }
      ),
      mx(
        "timpanometria",
        "Timpanometria",
        [
          ["od", "Orelha direita (OD)"],
          ["oe", "Orelha esquerda (OE)"],
        ],
        NORMAL_ALT,
        { comNumero: "dB" }
      ),
      mx(
        "reflexos_acusticos",
        "Reflexos acústicos (dB)",
        [
          ["od", "Orelha direita (OD)"],
          ["oe", "Orelha esquerda (OE)"],
        ],
        NORMAL_ALT,
        { comNumero: "dB" }
      ),
    ]),
  ],
  ["Valores de referência de normalidade dos exames audiológicos não foram transcritos: o profissional marca normal ou alterado."]
);

const FONO_LINGUAGEM_ORAL = def(
  "fono_linguagem_oral",
  "2.6",
  "Avaliação da linguagem oral",
  "Linguagem oral",
  AVISO_RESULTADO,
  [
    sec("proc", "PROC — 12 a 48 meses", [
      mx(
        "proc",
        "Resultados do PROC (pontuação alcançada)",
        [
          ["habilidades_comunicativas", "Habilidades comunicativas (de 70)"],
          ["compreensao", "Compreensão da linguagem oral (de 60)"],
          ["cognitivo", "Aspectos do desenvolvimento cognitivo (de 70)"],
          ["total", "Total (de 200)"],
        ],
        ESP_ALT,
        { comNumero: "Pontuação" }
      ),
    ]),
    sec("adl", "ADL — 1 ano a 6 anos e 11 meses", [
      mx(
        "adl",
        "Resultados do ADL",
        [
          ["compreensiva", "Linguagem compreensiva"],
          ["expressiva", "Linguagem expressiva"],
          ["total", "Linguagem total"],
        ],
        [
          o("acima_media", "Acima da média"),
          o("medio", "Médio"),
          o("medio_inferior", "Médio inferior"),
          o("atraso_leve", "Atraso leve"),
          o("atraso_moderado_grave", "Atraso moderado a grave"),
        ],
        { comNumero: "Escore padrão", comObs: true }
      ),
    ], "Escore bruto: registre na observação de cada linha."),
    sec("dno", "DNO — Discurso narrativo oral (6 a 12 anos)", [
      mx(
        "dno",
        "Resultados do DNO",
        [
          ["reconto_parcial_essenciais", "Reconto parcial: informações essenciais"],
          ["reconto_parcial_presentes", "Reconto parcial: informações presentes"],
          ["reconto_parcial_detalhes", "Reconto parcial: detalhes"],
          ["reconto_integral_ideias", "Reconto integral: total de ideias lembradas"],
          ["compreensao_respostas", "Compreensão: total de respostas corretas"],
          ["compreensao_inferencia", "Compreensão: momento da inferência"],
        ],
        CLASSE_6,
        { comNumero: "Pontuação", comObs: true }
      ),
      mx(
        "dno_conclusao",
        "Conclusão do DNO",
        [
          ["reconto_parcial", "Reconto parcial (memória operacional verbal)"],
          ["reconto_integral", "Reconto integral (memória episódica verbal)"],
          ["compreensao", "Compreensão"],
          ["inferencia", "Capacidade inferencial"],
        ],
        ESP_ALT
      ),
    ], "Percentil: registre na observação de cada linha."),
    sec("tin", "TIN — Teste de nomeação infantil (3 a 14 anos)", [
      t("tin_bruta", "Pontuação bruta (de 60)"),
      ue("tin_classe", "Interpretação da pontuação-padrão para a idade", CLASSE_PADRAO),
      m(
        "tin_erros",
        "Se a pontuação ficou baixa ou muito baixa, marque o que ocorreu",
        [
          o("erros_semanticos", "Erros semânticos (mesma categoria)"),
          o("erros_visuais", "Erros visuais (fisicamente semelhantes)"),
          o("erros_fonologicos", "Erros fonológicos (palavras parecidas)"),
          o("nao_conhece", "Não conhece a maior parte das figuras que não nomeou"),
          o("beneficia_pista", "Beneficia-se de pista fonológica"),
        ]
      ),
    ]),
    sec("fv", "FV — Fluência verbal (6 a 12 anos)", [
      mx(
        "fv",
        "Resultados da FV",
        [
          ["livre", "Evocação lexical livre"],
          ["letra_p", "Palavras começando com /p/"],
          ["vestimentas", "Palavras referentes a roupas/vestimentas"],
        ],
        CLASSE_6,
        { comNumero: "Nº de palavras", comObs: true }
      ),
    ], "Percentil, repetições, intrusões e clusters: registre na observação de cada linha."),
    sec("trpp", "TRPP — Repetição de palavras e pseudopalavras (3 a 14 anos)", [
      mx(
        "trpp",
        "Resultados do TRPP",
        [
          ["palavras", "Sequência de palavras (de 10)"],
          ["pseudopalavras", "Sequência de pseudopalavras (de 10)"],
          ["total", "Total (de 20)"],
        ],
        CLASSE_PADRAO,
        { comNumero: "Pontuação bruta" }
      ),
    ]),
    sec("tdf", "TDF — Discriminação fonológica (3 a 14 anos)", [
      t("tdf_bruta", "Pontuação bruta (de 23)"),
      ue("tdf_classe", "Interpretação da pontuação-padrão para a idade", CLASSE_PADRAO),
    ]),
    sec("tcfpo", "TCFPO — Consciência fonológica por produção oral (3 a 14 anos)", [
      mx(
        "tcfpo",
        "Pontuação bruta por item",
        [
          ["sintese_silabica", "Síntese silábica"],
          ["sintese_fonemica", "Síntese fonêmica"],
          ["rima", "Rima"],
          ["aliteracao", "Aliteração"],
          ["segmentacao_silabica", "Segmentação silábica"],
          ["segmentacao_fonemica", "Segmentação fonêmica"],
          ["manipulacao_silabica", "Manipulação silábica"],
          ["manipulacao_fonemica", "Manipulação fonêmica"],
          ["transposicao_silabica", "Transposição silábica"],
          ["transposicao_fonemica", "Transposição fonêmica"],
          ["total", "Total"],
        ],
        [],
        { comNumero: "Pontuação bruta" }
      ),
      ue("tcfpo_classe", "Interpretação da pontuação-padrão do total", CLASSE_PADRAO),
      m("tcfpo_nivel", "Dificuldades em nível", [o("silabico", "Silábico"), o("fonemico", "Fonêmico")]),
    ]),
    sec("sintese", "Síntese da avaliação da linguagem oral", [
      mx(
        "sintese_instrumentos",
        "Conclusão por instrumento (déficit)",
        [
          ["proc", "PROC — habilidades comunicativas e cognição"],
          ["adl", "ADL — linguagem compreensiva e expressiva"],
          ["dno", "DNO — memória, inferência e organização"],
          ["tin", "TIN — nomeação e acesso ao léxico"],
          ["fv", "FV — estratégia de busca e flexibilidade"],
          ["trpp", "TRPP — alça fonológica (curto prazo)"],
          ["tdf", "TDF — diferenciação de sons semelhantes"],
          ["tcfpo", "TCFPO — manipulação de sons e rimas"],
        ],
        SIM_NAO_NAV
      ),
      mx(
        "conclusao_areas",
        "Conclusão: presença de déficits nas áreas",
        [
          ["compreensao", "Compreensão"],
          ["expressao", "Expressão"],
          ["uso", "Uso da linguagem"],
        ],
        NS
      ),
      mx(
        "conclusao_habilidades",
        "Conclusão: presença de déficits nas habilidades",
        [
          ["fonologia", "Fonologia"],
          ["semantica", "Semântica"],
          ["sintaxe", "Sintaxe"],
          ["pragmatica", "Pragmática"],
        ],
        NS
      ),
    ]),
  ],
  [
    "Faixas de pontuação-padrão (<70 muito baixa … ≥130 muito alta) e de normalidade do ADL estão no PDF como referência do teste; o profissional escolhe a classificação e o sistema não a calcula.",
    "NAO IMPLEMENTAR ATE VALIDACAO: confirmar licença e versão de PROC, ADL, DNO, TIN, FV, TRPP, TDF e TCFPO antes de digitalizar qualquer item. Hoje só o resultado é registrado.",
  ]
);

const TDE_LINHAS: [string, string][] = [
  ["leitura_acertos", "Leitura: acertos"],
  ["leitura_tempo", "Leitura: tempo"],
  ["leitura_ppm", "Leitura: palavras por minuto"],
  ["leitura_pcpm", "Leitura: palavras corretas por minuto"],
  ["escrita_acertos", "Escrita: acertos"],
  ["escrita_tempo", "Escrita: tempo"],
  ["escrita_ppm", "Escrita: palavras por minuto"],
  ["escrita_pcpm", "Escrita: palavras corretas por minuto"],
];
const TDE_CLASSE: ReOpcao[] = [
  o("1", "1 · Déficit muito grave"),
  o("2", "2 · Déficit grave"),
  o("3", "3 · Déficit leve a moderado"),
  o("4", "4 · Alerta para déficit"),
  o("5", "5 · Médio inferior"),
  o("6", "6 · Médio"),
  o("7", "7 · Médio superior"),
  o("8", "8 · Acima do esperado"),
  o("9", "9 · Muito acima do esperado"),
];
const ERROS_LEITURA_ESCRITA: ReOpcao[] = [
  o("omissao", "Omissão"),
  o("adicao", "Adição"),
  o("inversao", "Inversão"),
  o("troca_sons_semelhantes", "Troca entre sons semelhantes"),
  o("troca_grafemas_parecidos", "Troca entre sons de grafemas parecidos"),
  o("desrespeito_regra", "Desrespeito à regra"),
  o("regularizacao", "Regularização"),
  o("substituicao_palavras", "Substituição de palavras semelhantes"),
  o("neologismo", "Neologismo"),
];

/** Resultados do TDE II e tipos de erro: iguais na fonoaudiologia e na psicopedagogia. */
function secoesTde(prefixo: string): ReSecao[] {
  return [
    sec(`${prefixo}tde`, "TDE II — Teste de desempenho escolar: leitura e escrita", [
      mx(`${prefixo}tde`, "Resultados do TDE II", TDE_LINHAS, TDE_CLASSE, { comNumero: "Resultado", comObs: true }),
    ], "Percentil: registre na observação de cada linha. A classificação 1 a 9 é a da tabela do teste, marcada por você."),
    sec(`${prefixo}tde_erros`, "Tipos de erros", [
      m(`${prefixo}tde_erros_leitura`, "Erros na leitura", ERROS_LEITURA_ESCRITA),
      m(`${prefixo}tde_erros_escrita`, "Erros na escrita", ERROS_LEITURA_ESCRITA),
    ]),
    sec(`${prefixo}tde_conclusao`, "Conclusão: decodificação e codificação", [
      mx(
        `${prefixo}tde_vias`,
        "Vias de leitura e escrita",
        [
          ["leitura_fonologica", "Leitura: via fonológica"],
          ["leitura_lexical", "Leitura: via lexical"],
          ["escrita_fonologica", "Escrita: via fonológica"],
          ["escrita_lexical", "Escrita: via lexical"],
        ],
        PRES_ALT
      ),
    ]),
  ];
}

const FONO_LINGUAGEM_ESCRITA = def(
  "fono_linguagem_escrita",
  "2.7",
  "Avaliação da linguagem escrita",
  "Linguagem escrita",
  AVISO_RESULTADO,
  [
    ...secoesTde(""),
    sec("dne_fluencia", "DNE — Discurso narrativo escrito (6 a 12 anos): fluência leitora", [
      mx(
        "dne_fluencia",
        "Resultados quantitativos",
        [
          ["tempo_leitura", "Tempo de leitura (segundos)"],
          ["velocidade", "Velocidade (palavras por minuto)"],
        ],
        CLASSE_6,
        { comNumero: "Resultado", comObs: true }
      ),
    ], "Percentil: registre na observação de cada linha."),
    sec("dne", "DNE — Resultados quantitativos", [
      mx(
        "dne",
        "Resultados do DNE",
        [
          ["reconto_parcial_essenciais", "Reconto parcial: informações essenciais"],
          ["reconto_parcial_presentes", "Reconto parcial: informações presentes"],
          ["reconto_parcial_detalhes", "Reconto parcial: detalhes"],
          ["reconto_integral_ideias", "Reconto integral: total de ideias lembradas"],
          ["compreensao_respostas", "Compreensão: total de respostas corretas"],
          ["compreensao_inferencia", "Compreensão: momento da inferência"],
        ],
        CLASSE_6,
        { comNumero: "Pontuação", comObs: true }
      ),
    ]),
    sec("producao", "Produção escrita — análise qualitativa", [
      mx(
        "producao_escrita",
        "Produção escrita",
        [
          ["convencoes", "Convenções textuais"],
          ["elaboracao", "Elaboração da história"],
          ["linguagem_contextual", "Linguagem contextual"],
        ],
        PRES_ALT
      ),
    ]),
    sec("sintese", "Síntese da avaliação da linguagem escrita", [
      mx(
        "sintese_instrumentos",
        "Conclusão por instrumento (déficit)",
        [
          ["tde_leitura", "TDE II (leitura) — precisão, tempo e eficiência leitora"],
          ["tde_escrita", "TDE II (escrita) — precisão, tempo e eficiência de escrita"],
          ["dne_tempo", "DNE — tempo de leitura e velocidade"],
          ["dne_inferencia", "DNE — capacidade inferencial e memória episódica verbal"],
          ["dne_reconto", "DNE (reconto parcial e integral) — retenção e associação de ideias"],
          ["narrativa", "Narrativa espontânea — convenções, elaboração e produção escrita"],
        ],
        NS
      ),
      mx(
        "conclusao_leitura",
        "Conclusão: déficits em leitura",
        [
          ["decodificacao", "Decodificação"],
          ["velocidade", "Velocidade"],
          ["eficiencia", "Eficiência"],
          ["compreensao", "Compreensão escrita"],
        ],
        NS
      ),
      mx(
        "conclusao_escrita",
        "Conclusão: déficits em escrita",
        [
          ["codificacao", "Codificação"],
          ["velocidade", "Velocidade"],
          ["eficiencia", "Eficiência"],
          ["producao", "Produção textual escrita"],
        ],
        NS
      ),
    ]),
  ],
  [
    "A tabela de percentis do TDE II (1 a 9) é do manual do teste. O profissional marca a classificação; o sistema não converte percentil em classe.",
    "NAO IMPLEMENTAR ATE VALIDACAO: licença e versão do TDE II e do DNE.",
  ]
);

const PROCESSOS_FONOLOGICOS: [string, string][] = [
  ["reducao_silaba", "Redução de sílaba (eliminação aos 2 anos e 6 meses)"],
  ["harmonia_consonantal", "Harmonia consonantal (2 anos e 6 meses)"],
  ["plosivacao_fricativas", "Plosivação de fricativas (2 anos e 6 meses)"],
  ["simplificacao_velar", "Simplificação de velar (3 anos)"],
  ["frontalizacao_velar", "Frontalização de velar (3 anos)"],
  ["posteriorizacao_velar", "Posteriorização para velar (3 anos e 6 meses)"],
  ["posteriorizacao_palatal", "Posteriorização para palatal (4 anos e 6 meses)"],
  ["frontalizacao_palatal", "Frontalização de palatal (4 anos e 6 meses)"],
  ["simplificacao_liquida", "Simplificação de líquida (4 anos e 6 meses)"],
  ["simplificacao_encontro", "Simplificação do encontro consonantal /R/ e /L/ (5 anos e 6 meses)"],
  ["simplificacao_final", "Simplificação da consoante final (5 anos e 6 meses)"],
  ["sonorizacao_plosivas", "Sonorização de plosivas (baixa ocorrência aos 3 anos)"],
  ["sonorizacao_fricativas", "Sonorização de fricativas (baixa ocorrência aos 3 anos)"],
  ["ensurdecimento_plosivas", "Ensurdecimento de plosivas (baixa ocorrência aos 3 anos)"],
  ["ensurdecimento_fricativas", "Ensurdecimento de fricativas (baixa ocorrência aos 3 anos)"],
  ["metatese", "Metátese (baixa ocorrência aos 3 anos)"],
];

const FONO_FALA = def(
  "fono_fala",
  "2.8",
  "Avaliação da fala",
  "Fala",
  AVISO_RESULTADO,
  [
    sec("abfw_fonologia", "ABFW — Fonologia (2 anos e 6 meses a 5 anos e 6 meses)", [
      mx("abfw_produtivo", "Processo fonológico produtivo", PROCESSOS_FONOLOGICOS, NS),
      mx("abfw_classificacao", "Classificação de cada processo", PROCESSOS_FONOLOGICOS, DENTRO_FORA),
    ]),
    sec("abfw_fluencia", "ABFW — Fluência de fala", [
      mx(
        "abfw_fluencia",
        "Aspectos avaliados",
        [
          ["disfluencias_comuns", "Disfluências comuns"],
          ["disfluencias_gagas", "Disfluências gagas"],
          ["palavras_minuto", "Fluxo de palavras por minuto (%)"],
          ["silabas_minuto", "Fluxo de sílabas por minuto (%)"],
          ["descontinuidade", "% de descontinuidade de fala"],
          ["gagas_percentual", "% de disfluências gagas"],
        ],
        DENTRO_FORA,
        { comNumero: "Porcentagem" }
      ),
      mx(
        "concomitantes",
        "Concomitantes físicos (0 a 5, conforme o protocolo)",
        [
          ["sons_dispersivos", "Sons dispersivos"],
          ["movimentos_faciais", "Movimentos faciais"],
          ["movimentos_cabeca", "Movimentos de cabeça"],
          ["movimentos_extremidade", "Movimentos de extremidade"],
        ],
        NIVEL_0_5
      ),
      ue("gravidade_gagueira", "Gravidade da gagueira", [
        o("muito_leve", "Muito leve"),
        o("leve", "Leve"),
        o("moderada", "Moderada"),
        o("grave", "Grave"),
        o("muito_grave", "Muito grave"),
      ]),
    ]),
    sec("amiofe", "AMIOFE — Avaliação miofuncional orofacial", [
      mx(
        "amiofe_estrutura",
        "Aparência e condição estrutural",
        [
          ["face", "Face"],
          ["bochechas", "Bochechas"],
          ["mandibula_maxila", "Relação mandíbula/maxila"],
          ["labios", "Lábios"],
          ["mentual", "Músculo mentual"],
          ["lingua", "Língua"],
          ["palato_duro", "Palato duro"],
        ],
        ADEQ_ALT
      ),
      mx(
        "amiofe_mobilidade",
        "Mobilidade",
        [
          ["bochechas", "Bochechas"],
          ["labios", "Lábios"],
          ["lingua", "Língua"],
          ["mandibula", "Mandíbula"],
        ],
        ADEQ_ALT
      ),
      mx(
        "amiofe_funcoes",
        "Funções",
        [
          ["respiracao", "Respiração"],
          ["mastigacao", "Mastigação"],
          ["degluticao", "Deglutição"],
        ],
        ADEQ_ALT
      ),
    ]),
    sec("voz", "Avaliação perceptivo-auditiva da voz", [
      ue("voz_queixa", "Queixas de alteração de voz", NS),
      mx(
        "voz_qualidade",
        "Análise da qualidade vocal",
        [
          ["rouquidao", "Rouquidão"],
          ["soprosidade", "Soprosidade"],
          ["aspereza", "Aspereza"],
          ["tremor", "Tremor"],
          ["tensao", "Tensão"],
        ],
        [o("ausente", "Ausente"), o("leve", "Leve"), o("moderada", "Moderada"), o("severa", "Severa")]
      ),
      t("voz_qualidade_outros", "Outros (qualidade vocal)"),
      ue("voz_pitch", "Análise do pitch", [o("grave", "Grave"), o("medio", "Médio"), o("agudo", "Agudo")]),
      mx(
        "voz_ressonancia",
        "Ressonância",
        [
          ["equilibrio", "Em equilíbrio"],
          ["hipernasal", "Hipernasal (aumento do foco nasal)"],
          ["hiponasal", "Hiponasal (redução do foco nasal)"],
        ],
        NS
      ),
      ue("voz_articulacao", "Articulação", [
        o("adequada", "Adequada"),
        o("travada", "Travada"),
        o("sobrearticulacao", "Sobrearticulação"),
        o("alteracao_fonemica", "Com alteração fonêmica"),
      ]),
      ue("voz_respiracao_tipo", "Respiração: tipo", [o("superior", "Superior"), o("media", "Média"), o("inferior", "Inferior")]),
      ue("voz_respiracao_modo", "Respiração: modo", [o("oral", "Oral"), o("nasal", "Nasal"), o("mista", "Mista")]),
      ue("voz_coordenacao", "Coordenação pneumofonoarticulatória", [o("presente", "Presente"), o("ausente", "Ausente")]),
      mx(
        "voz_tempo_fonacao",
        "Tempo de fonação sustentado (segundos)",
        [
          ["a", "Vogal /a/"],
          ["i", "Vogal /i/"],
          ["u", "Vogal /u/"],
          ["s", "Fonema /s/"],
          ["z", "Fonema /z/"],
        ],
        [],
        { comNumero: "Segundos" }
      ),
    ]),
    sec("sintese", "Síntese da avaliação da fala", [
      mx(
        "sintese_instrumentos",
        "Presença de déficit por instrumento",
        [
          ["abfw_fonologia", "ABFW fonologia — processos fonológicos produtivos"],
          ["abfw_fluencia", "ABFW fluência — disfluências, velocidade e gravidade"],
          ["amiofe", "AMIOFE — estrutura, mobilidade e funções"],
          ["voz", "Avaliação perceptivo-auditiva da voz"],
        ],
        NS
      ),
      mx(
        "conclusao_areas",
        "Conclusão: presença de déficits nas áreas da fala",
        [
          ["producao_sons", "Produção dos sons"],
          ["fluencia", "Fluência"],
          ["miofuncional", "Sistema miofuncional orofacial"],
          ["voz", "Voz"],
        ],
        NS
      ),
    ]),
  ],
  ["NAO IMPLEMENTAR ATE VALIDACAO: licença e versão do ABFW e do AMIOFE. Hoje só o resultado marcado pelo profissional é registrado."]
);

const FONO_SINTESE = def(
  "fono_sintese",
  "2.9",
  "Síntese da avaliação fonoaudiológica completa",
  "Síntese e conduta",
  "Marque o que a avaliação mostrou em cada componente. Escolha a conduta; o sistema não indica conduta.",
  [
    sec("sintese", "Síntese: déficit por componente", [
      mx("sintese_audicao", "Audição", [["limiares", "Limiares auditivos"], ["orelha_media", "Integridade de orelha média"]], SIM_NAO_NAV),
      mx(
        "sintese_linguagem_oral",
        "Linguagem oral",
        [
          ["compreensao", "Compreensão"],
          ["expressao", "Expressão"],
          ["fonologia", "Fonologia"],
          ["semantica", "Semântica"],
          ["sintaxe", "Sintaxe"],
          ["pragmatica", "Pragmática"],
        ],
        SIM_NAO_NAV
      ),
      mx(
        "sintese_linguagem_escrita",
        "Linguagem escrita",
        [
          ["decodificacao", "Decodificação"],
          ["fluencia_leitora", "Fluência leitora"],
          ["compreensao_leitora", "Compreensão leitora"],
          ["ortografia", "Ortografia"],
          ["fluencia_escrita", "Fluência de escrita"],
          ["producao_textual", "Produção escrita textual"],
        ],
        SIM_NAO_NAV
      ),
      mx(
        "sintese_fala",
        "Fala",
        [
          ["articulacao", "Articulação"],
          ["fluencia", "Fluência"],
          ["miofuncional", "Sistema miofuncional orofacial"],
          ["voz", "Voz"],
        ],
        SIM_NAO_NAV
      ),
    ]),
    sec("conduta", "Conduta: encaminhamentos e/ou terapia fonoaudiológica", [
      m(
        "conduta_audicao",
        "Audição",
        [
          o("encaminhar_orl", "Alteração em limiar auditivo e/ou orelha média: encaminhar para otorrinolaringologista"),
          o("avaliacao_pac", "Sem alteração em limiar, mas com déficit de compreensão oral, alterações na fala, memória fonológica e/ou leitura/escrita: avaliação formal do processamento auditivo central"),
        ]
      ),
      m(
        "conduta_linguagem_oral",
        "Linguagem oral",
        [
          o("estimulacao_cognitivo_linguistica", "Estimulação cognitivo-linguística"),
          o("treino_habilidades_auditivas", "Treino de habilidades auditivas (discriminação fonológica, memória auditiva e habilidades alteradas no exame formal de PAC)"),
          o("processamento_fonologico", "Estimulação do processamento fonológico (consciência fonológica, acesso lexical e memória fonológica)"),
          o("vocabulario", "Ampliação de vocabulário (organização categórica, associação, acesso lexical, nomeação e definição)"),
          o("sintaxe", "Estruturação sintática (consciência sintática, organização frasal e discursiva)"),
          o("pragmatica", "Pragmática (inferências, organização discursiva, uso da linguagem)"),
        ]
      ),
      m(
        "conduta_linguagem_escrita",
        "Linguagem escrita",
        [
          o("conhecimento_alfabetico", "Conhecimento alfabético"),
          o("rota_fonologica", "Fortalecimento da rota fonológica (processamento fonológico, associação grafema-fonema), nomeação rápida"),
          o("dominio_ortografico", "Domínio ortográfico (regras ortográficas, consciência e treino de relações múltiplas entre grafemas e fonemas)"),
          o("compreensao_leitora", "Compreensão leitora (informações literais, associação de ideias, inferências, estratégias)"),
          o("producao_textual", "Produção textual (organização de sentenças e de textos, planejamento, construção e revisão)"),
        ]
      ),
      m(
        "conduta_fala",
        "Fala",
        [
          o("encaminhar_miofuncional", "Alteração no sistema miofuncional orofacial: encaminhar para otorrinolaringologista e/ou dentista"),
          o("encaminhar_voz", "Alteração na voz: encaminhar para otorrinolaringologista"),
          o("treino_fluencia", "Treino de fluência para gagueira"),
          o("origem_linguistica", "Alteração de fala é de origem linguística (ver linguagem)"),
        ]
      ),
      tl("conclusao", "Conclusão"),
      tl("conduta", "Conduta"),
    ]),
  ],
  ["As opções de conduta são as do capítulo (foco da intervenção baseado em evidências). Quem indica é o fonoaudiólogo; o sistema não sugere."]
);

const FONO_SRS2 = def(
  "fono_srs2",
  "3",
  "SRS-2 — resultado (Escala de Responsividade Social)",
  "SRS-2",
  "Instrumento licenciado (WPS/Hogrefe CETEPP). O sistema não reproduz os itens: registre aqui só o resultado e a data da aplicação.",
  [
    sec("resultado", "Resultado informado pelo profissional", [
      data("data_aplicacao", "Data da aplicação"),
      m("respondente", "Quem respondeu", [o("mae_pai", "Mãe/Pai"), o("professor", "Professor"), o("outro", "Outro")]),
      t("resultado_informado", "Resultado informado no protocolo do instrumento"),
      tl("anotacao", "Anotações do profissional"),
    ]),
  ],
  ["NAO IMPLEMENTAR ATE VALIDACAO: itens, pontuação e licença do SRS-2 (direitos reservados à editora). Os 65 itens não foram digitalizados."]
);

const FONO_PLANO = def(
  "fono_plano_terapeutico",
  "4",
  "Plano terapêutico fonoaudiológico",
  "Plano terapêutico",
  "Preenchido pelo fonoaudiólogo. Textos curtos e observáveis.",
  [
    sec("identificacao", "Identificação do plano", [
      t("diagnostico", "Diagnóstico (texto do profissional)"),
      data("data_ultima_avaliacao", "Data da última avaliação"),
      tl("hipotese_fono", "Hipótese diagnóstica fonoaudiológica"),
      data("data_prevista_reavaliacao", "Data prevista de reavaliação"),
      t("sessoes_previstas", "Número previsto de sessões"),
    ]),
    sec("plano", "Plano", [
      tl("principais_achados", "1. Principais achados"),
      tl("objetivo_geral", "2. Objetivo geral"),
      tl("objetivo_a", "3. Objetivos específicos — a)"),
      opc(tl("objetivo_b", "3. Objetivos específicos — b)")),
      opc(tl("objetivo_c", "3. Objetivos específicos — c)")),
      opc(tl("objetivo_d", "3. Objetivos específicos — d)")),
      tl("criterios_alta", "4. Critérios de alta"),
      opc(tl("comentarios", "5. Comentários")),
    ]),
  ],
  ["Diagnóstico e hipótese são texto do profissional. A decisão de alta continua exclusivamente com o médico responsável: aqui ficam só os critérios propostos."]
);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// PSICOPEDAGOGIA CLÍNICA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const PPC_ANAMNESE = def(
  "ppc_anamnese",
  "1",
  "Anamnese psicopedagógica",
  "Anamnese",
  "Preencha com o responsável. Use a observação para o complemento (ex.: desde quando, motivos).",
  [
    sec("trajetoria", "Trajetória escolar", [
      t("idade_entrada_escola", "Com que idade entrou na escola?"),
      ns("trajetoria", "Trajetória escolar", [
        ["educacao_infantil", "Frequentou educação infantil, creche ou pré-escola (desde quando?)"],
        ["mudanca_escola", "Houve mudança de escola (motivos)"],
        ["reprovacoes", "Houve reprovações (quantas e em quais séries?)"],
        ["adaptou", "Adaptou-se bem à escola (se não, o que houve?)"],
        ["gosta_escola", "Gosta de ir à escola (se não, motivos)"],
        ["vinculo_professor", "Tem bom vínculo com o professor (se não, motivos)"],
        ["vinculo_colegas", "Tem bom vínculo com os colegas (se não, o que acontece?)"],
        ["reforco", "Já passou por reforço escolar ou acompanhamento pedagógico (quando e por quanto tempo?)"],
      ]),
    ]),
    sec("habitos", "Hábitos de estudo e rotina", [
      ns("habitos", "Hábitos de estudo e rotina", [
        ["horario_estudo", "Tem horário certo para estudar em casa"],
        ["acompanhamento", "Alguém acompanha as tarefas escolares (quem?)"],
        ["autonomia", "Realiza as tarefas com autonomia"],
      ]),
      t("telas_horas_dia", "Uso de telas (TV, celular, videogame): horas por dia"),
    ]),
    sec("aprendizagem", "Dificuldades de aprendizagem", [
      ns("aprendizagem", "Dificuldades de aprendizagem", [
        ["alfabetizacao", "Dificuldades na alfabetização"],
        ["erros_leitura", "Erros na leitura"],
        ["leitura_lenta", "Leitura lenta"],
        ["erros_escrita", "Erros na escrita"],
        ["caligrafia", "Caligrafia ininteligível"],
        ["producao_texto", "Produção de texto inadequada"],
        ["pede_ajuda_leitura", "Pede ajuda para leitura"],
        ["compreende_ouvir", "Compreende melhor ao ouvir do que ao ler"],
        ["copia", "Dificuldade com a cópia"],
        ["matematica", "Dificuldade em matemática"],
        ["concentracao", "Dificuldade para concentração"],
        ["memorizacao", "Dificuldade para memorização"],
        ["esquece", "Esquece o que aprende"],
        ["desorganizacao", "Desorganização (material, tarefas, rotina)"],
        ["velocidade_reduzida", "Velocidade reduzida para realizar tarefas"],
        ["ritmo_turma", "Dificuldade para acompanhar o ritmo da turma"],
      ]),
    ]),
    sec("matematica", "Matemática", [
      ns("matematica", "Matemática", [
        ["contar_nomear", "Dificuldade para contar ou nomear números"],
        ["calculos", "Dificuldade com cálculos"],
        ["tabuada", "Dificuldade com a tabuada"],
        ["problemas", "Dificuldade para resolver problemas"],
        ["dinheiro", "Dificuldade com dinheiro/troco"],
        ["ansiedade_matematica", "Demonstra ansiedade ou evita atividades de matemática"],
      ]),
    ]),
    sec("emocional", "Aspectos emocionais e comportamentais", [
      ns("emocional", "Aspectos emocionais e comportamentais", [
        ["baixa_autoestima", "Apresenta baixa autoestima em relação à aprendizagem"],
        ["ansiedade_escola", "Demonstra ansiedade relacionada à escola ou a provas"],
        ["motivado", "Mostra-se motivado para aprender"],
        ["frustracao", "Demonstra frustração diante das dificuldades"],
        ["frases_negativas", "Expressa frases negativas sobre si ou sobre sua capacidade"],
        ["socializacao", "Dificuldade de socialização"],
        ["conflitos", "Conflitos"],
        ["isolamento", "Isolamento"],
      ]),
    ]),
    sec("tratamentos", "Tratamentos", [TRATAMENTOS]),
    sec("familia", "Família", [
      ns("familia", "Família", [
        ["habito_leitura", "Hábitos de leitura (frequência)"],
        ["habito_escrita", "Hábitos de escrita (frequência)"],
        ["dificuldade_familia", "Alguém na família tem ou teve dificuldade escolar ou de fala (que? qual?)"],
        ["participa_vida_escolar", "Participa da vida escolar do filho"],
        ["reage_dificuldades", "Reage de forma acolhedora diante das dificuldades do filho"],
      ]),
    ]),
    sec("conclusao", "Conclusão", [tl("conclusao", "Conclusão da anamnese")]),
  ],
  ["O item 'Como reage diante das dificuldades do filho' vem como Não/Sim no PDF; foi mantido como Não/Sim com observação. Confirmar a redação com a Dra."]
);

const EOCA_TEMATICA: [string, string][] = [
  ["fala_muito", "Fala muito durante todo o tempo da sessão"],
  ["fala_pouco", "Fala pouco durante todo o tempo da sessão"],
  ["verbaliza_bem", "Verbaliza bem as palavras"],
  ["expressa_facilidade", "Expressa com facilidade"],
  ["dificuldade_expressar", "Apresenta dificuldades para se expressar verbalmente"],
  ["fala_ideias", "Fala de suas ideias, vontades e desejos"],
  ["retraido", "Mostra-se retraído para se expor"],
  ["fala_logica", "Sua fala tem lógica e sequência de fatos"],
  ["mundo_fantasias", "Parece viver num mundo de fantasias"],
  ["sem_constrangimento", "Conversa com o terapeuta sem constrangimento"],
];
const EOCA_DINAMICA: [string, string][] = [
  ["tom_baixo", "O tom de voz é baixo"],
  ["tom_alto", "O tom de voz é alto"],
  ["tom_adequado", "Sabe usar o tom de voz adequadamente"],
  ["gesticula", "Gesticula muito para falar"],
  ["nao_senta", "Não consegue ficar sentado"],
  ["atencao", "Tem atenção e concentração"],
  ["anda", "Anda o tempo todo"],
  ["muda_lugar", "Muda de lugar e troca de materiais constantemente"],
  ["pensa_antes", "Pensa antes de criar ou montar algo"],
  ["capricho", "Realiza as atividades com capricho"],
  ["desorganizado", "Mostra-se desorganizado e descuidado"],
  ["higiene_zelo", "Possui hábitos de higiene e zelo com os materiais"],
  ["sabe_usar_materiais", "Sabe usar os materiais disponíveis, conhece a utilidade de cada um"],
  ["devolve_materiais", "Ao pegar os materiais, devolve no lugar depois de usá-los"],
  ["nao_guarda", "Não guarda o material que usou"],
  ["iniciativa", "Apresenta iniciativa"],
  ["ocupa_espaco", "Ocupa todo o espaço disponível"],
  ["boa_postura", "Possui boa postura corporal"],
  ["deixa_cair", "Deixa cair objetos que pega"],
  ["simbolica", "Faz brincadeiras simbólicas"],
  ["expressa_sentimentos", "Expressa sentimentos nas brincadeiras"],
  ["sentado", "Sentado"],
  ["deitado", "Deitado"],
  ["em_pe", "Em pé"],
  ["se_mexendo", "Se mexendo muito"],
  ["timido", "Muito tímido"],
  ["apreensivo", "Comportamento muito apreensivo"],
  ["suando", "Suando"],
];
const EOCA_PRODUTO: [string, string][] = [
  ["desenho_pobre", "Desenho pobre em detalhes"],
  ["desenho_sem_riqueza", "Desenho sem riqueza de detalhes para sua faixa etária"],
  ["nao_explorou", "Não explorou todo material apresentado"],
  ["explorou", "Explorou todo material apresentado"],
  ["material_conhecido", "Prefere usar material já conhecido"],
  ["nao_guardou", "Desorganizado com os materiais, não colocou de volta na caixa"],
  ["guardou", "Organizado com os materiais, colocou-os de volta na caixa"],
  ["desenha_escreve", "Desenha e depois escreve"],
  ["escreve_desenha", "Escreve primeiro e depois desenha"],
  ["desenhos_forma", "Apresenta os seus desenhos com forma e compreensão"],
];
const BAC_COMPETENCIAS: { id: string; titulo: string; itens: [string, string][] }[] = [
  {
    id: "verbal",
    titulo: "Competência verbal",
    itens: [
      ["nomear_numeros", "Apresenta dificuldade para nomear números apresentados oralmente"],
      ["termos_matematicos", "Demonstra dificuldade em compreender termos matemáticos falados (ex.: dobro, metade, diferença)"],
      ["simbolos_ditados", "Falha em identificar símbolos matemáticos ditados oralmente"],
      ["sequencias_orais", "Apresenta dificuldade em nomear sequências numéricas orais"],
      ["lentidao_quantidade", "Demonstra lentidão para responder a comandos verbais que envolvem conceitos de quantidade"],
    ],
  },
  {
    id: "pratognostica",
    titulo: "Competência pratognóstica",
    itens: [
      ["contar_objetos", "Apresenta dificuldade para contar objetos concretos um a um"],
      ["agrupar", "Demonstra dificuldade em agrupar objetos por tamanho, cor, forma ou quantidade"],
      ["seriacao", "Falha em ordenar objetos em ordem crescente ou decrescente (seriação)"],
      ["comparar_colecoes", "Apresenta dificuldade em comparar visualmente coleções de objetos"],
      ["estimar", "Demonstra dificuldade em realizar estimativas visuais de quantidade sem contar um a um"],
      ["desorganizacao_espacial", "Apresenta desorganização espacial ao manipular blocos lógicos ou material dourado"],
    ],
  },
  {
    id: "lexica",
    titulo: "Competência léxica",
    itens: [
      ["numeros_isolados", "Apresenta dificuldade na leitura de números isolados"],
      ["multiplos_digitos", "Demonstra dificuldade na leitura de números com múltiplos dígitos"],
      ["sinais_operacao", "Falha em reconhecer e ler sinais de operações matemáticas"],
      ["fracoes_decimais", "Apresenta dificuldade na leitura de frações ou números decimais"],
      ["simbolos_grandeza", "Confunde símbolos de relação de grandeza na leitura"],
    ],
  },
  {
    id: "grafica",
    titulo: "Competência gráfica",
    itens: [
      ["escrever_ditado", "Apresenta dificuldade em escrever números sob ditado"],
      ["copiar", "Demonstra dificuldade em copiar números ou símbolos matemáticos corretamente"],
      ["alinhamento", "Apresenta desorganização espacial na escrita de números (alinhamento de colunas)"],
      ["sinais_legiveis", "Demonstra dificuldade em grafar sinais de operações aritméticas de forma legível"],
      ["tracado", "Apresenta traçado trêmulo, excessivamente forte ou fraco ao registrar dados numéricos"],
    ],
  },
  {
    id: "ideognostica",
    titulo: "Competência ideognóstica",
    itens: [
      ["calculo_mental", "Apresenta dificuldade extrema em realizar cálculo mental rápido"],
      ["valor_posicional", "Demonstra dificuldade em compreender o conceito de valor posicional do algarismo"],
      ["problemas_texto", "Falha na resolução de problemas que exigem interpretação de texto e lógica"],
      ["fatos_basicos", "Apresenta dificuldade em memorizar fatos numéricos básicos (tabuada)"],
      ["estimar_resultados", "Demonstra dificuldade em estimar resultados de operações de forma lógica"],
    ],
  },
  {
    id: "operacional",
    titulo: "Competência operacional",
    itens: [
      ["adicao", "Apresenta dificuldade em executar o algoritmo da adição"],
      ["subtracao", "Demonstra dificuldade em executar o algoritmo da subtração"],
      ["multiplicacao_divisao", "Falha na execução de algoritmos de multiplicação ou divisão com múltiplos dígitos"],
      ["mistura_etapas", "Mistura as etapas de diferentes operações durante a resolução de uma conta"],
      ["precedencia", "Apresenta dificuldade em seguir a ordem de precedência em expressões matemáticas simples"],
    ],
  },
];
const PIAGET_BLOCOS: { id: string; titulo: string; itens: [string, string][] }[] = [
  {
    id: "conservacao",
    titulo: "Bloco 1 — Conservação",
    itens: [
      ["liquido", "Reconhece a conservação do líquido"],
      ["massa", "Reconhece a conservação da massa"],
      ["numero", "Reconhece a conservação do número"],
      ["comprimento", "Reconhece a conservação do comprimento"],
      ["superficie", "Reconhece a conservação de superfície"],
      ["continua", "Reconhece a conservação da quantidade contínua subtraída/particionada"],
      ["descontinua", "Reconhece a conservação da quantidade descontínua (unidades discretas)"],
      ["justif_identidade", "Justifica por identidade (nada foi acrescentado nem retirado)"],
      ["justif_reversibilidade", "Justifica por reversibilidade (pode voltar ao estado inicial)"],
      ["justif_compensacao", "Justifica por compensação (o que perde em altura ganha em largura)"],
      ["apenas_intuicao", "Apresenta apenas intuição empírica sem argumento lógico"],
      ["mantem_contra_sugestao", "Mantém a resposta após contra-sugestão"],
    ],
  },
  {
    id: "classificacao",
    titulo: "Bloco 2 — Classificação",
    itens: [
      ["agrupa", "Agrupa objetos por semelhanças e diferenças"],
      ["separa", "Separa corretamente todos os elementos segundo um critério dado"],
      ["reclassifica", "Muda de critério de classificação a pedido do examinador"],
      ["alinhamento", "Estabelece coleções por alinhamento simples (nível pré-operatório)"],
      ["hierarquica", "Realiza classificação hierárquica com mudança de critério sem perder o conjunto"],
      ["inclusao_classes", "Compreende a inclusão de classes e justifica"],
      ["dicotomias", "Realiza dicotomias sucessivas"],
    ],
  },
  {
    id: "seriacao",
    titulo: "Bloco 3 — Seriação",
    itens: [
      ["crescente", "Ordena os bastonetes do menor para o maior (seriação crescente)"],
      ["decrescente", "Ordena os bastonetes do maior para o menor (seriação decrescente)"],
      ["interpolacao", "Insere novos elementos em uma série já construída (interpolação)"],
      ["termo_a_termo", "Coordena seriação com correspondência termo a termo"],
      ["transitividade", "Compreende a transitividade"],
      ["explica_criterio", "Explica o critério utilizado na construção da série"],
    ],
  },
  {
    id: "complementares",
    titulo: "Bloco 4 — Noções complementares",
    itens: [
      ["inclusao_verbal", "Compreende a inclusão de classes em situações verbais"],
      ["relacoes_logicas", "Resolve problemas de relações lógicas (transitividade e equivalência)"],
      ["hipotetico_dedutivo", "Demonstra raciocínio hipotético-dedutivo"],
      ["tempo_velocidade", "Compreende noções de tempo e velocidade em situações concretas"],
      ["combinacoes", "Realiza combinações e permutações de elementos de forma sistemática"],
    ],
  },
];

const PPC_EOCA = def(
  "ppc_eoca",
  "2.1",
  "EOCA — Entrevista operativa centrada na aprendizagem",
  "EOCA e provas projetivas",
  "Marque o que foi observado na sessão. Em branco quer dizer que não foi observado ou não foi registrado.",
  [
    sec("tematica", "Em relação à temática (o que o estudante faz)", [ns("tematica", "Temática", EOCA_TEMATICA, false)]),
    sec("dinamica", "Em relação à dinâmica (como o estudante faz)", [ns("dinamica", "Dinâmica", EOCA_DINAMICA, false)]),
    sec("produto", "Em relação ao produto (o que fica registrado e como foi realizado)", [ns("produto", "Produto", EOCA_PRODUTO, false)]),
    sec("modalidade", "Modalidade de aprendizagem", [
      ue("modalidade", "Assinale a modalidade", [
        o("hipoassimilativa", "Hipoassimilativa"),
        o("hiperassimilativa", "Hiperassimilativa"),
        o("hipoacomodativa", "Hipoacomodativa"),
        o("hiperacomodativa", "Hiperacomodativa"),
      ]),
    ]),
    sec("projetivas", "Provas projetivas psicopedagógicas", [
      tl("provas_projetivas", "Registro do psicopedagogo", "Descreva o que foi observado, em linguagem observável."),
      mx(
        "vinculos",
        "Vínculos",
        [
          ["escolar", "Vínculo escolar"],
          ["familia", "Vínculo com a família"],
          ["consigo", "Vínculo consigo"],
        ],
        VINCULO
      ),
    ]),
  ],
  [
    "As definições das modalidades (hipo/hiperassimilativa, hipo/hiperacomodativa) estão no capítulo; não foram exibidas como classificação do aluno. O profissional escolhe.",
    "As provas projetivas psicopedagógicas não têm roteiro no PDF: ficam como registro livre até a Dra. indicar quais provas e campos.",
  ]
);

const PPC_AVALIACAO = def(
  "ppc_avaliacao",
  "2.2",
  "TDE II e BAC-MAT",
  "TDE II e matemática",
  AVISO_RESULTADO,
  [
    ...secoesTde("ppc_"),
    sec("tde_conduta", "Conduta a partir do TDE II", [
      mx(
        "tde_encaminhamentos",
        "Encaminhamentos marcados pelo profissional",
        [
          ["avaliacao_fono", "Encaminhar para avaliação fonoaudiológica (habilidades cognitivo-linguísticas)"],
          ["avaliacao_psicomotora", "Encaminhar para avaliação de psicomotricidade (caligrafia com alterações)"],
        ],
        NS
      ),
    ]),
    ...BAC_COMPETENCIAS.map((c) => sec(`bac_${c.id}`, `BAC-MAT — ${c.titulo}`, [ns(`bac_${c.id}`, c.titulo, c.itens, false)])),
    sec("bac_nivel", "BAC-MAT — Nível de aquisição por competência", [
      mx(
        "bac_nivel",
        "Nível de aquisição demonstrado pelo avaliando",
        BAC_COMPETENCIAS.map((c) => [c.id, c.titulo] as [string, string]),
        ADQUIRIU
      ),
    ]),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO: os itens do BAC-MAT estão no PDF; confirmar autoria, licença e versão antes de usar como instrumento. O sistema registra só o que o profissional marcou e não soma itens.",
    "Os nomes 'discalculia verbal, pratognóstica...' do PDF foram trocados por 'competência', para não sugerir diagnóstico. Confirmar com a Dra.",
  ]
);

const PPC_PIAGET = def(
  "ppc_piaget",
  "2.3",
  "Provas piagetianas (método clínico)",
  "Provas piagetianas",
  "Marque o que ocorreu na aplicação. Em branco quer dizer que a prova não foi aplicada ou o item não foi observado.",
  [
    ...PIAGET_BLOCOS.map((b) => sec(`piaget_${b.id}`, b.titulo, [ns(`piaget_${b.id}`, b.titulo, b.itens, false)])),
    sec("niveis", "Nível de aquisição das noções operatórias", [
      mx(
        "piaget_aquisicao",
        "Nível de aquisição",
        [
          ["conservacao", "Conservação"],
          ["classificacao", "Classificação"],
          ["seriacao", "Seriação"],
          ["inclusao_classes", "Inclusão de classes"],
          ["transitividade", "Transitividade/lógica"],
        ],
        ADQUIRIU3
      ),
    ]),
    sec("resultado", "Resultado", [
      ue("piaget_nivel", "Nível de desenvolvimento cognitivo identificado", [
        o("sensorio_motor", "Sensório-motor (0 a 2 anos)"),
        o("pre_operatorio", "Pré-operatório (2 a 7 anos)"),
        o("operatorio_concreto", "Operatório concreto (7 a 11/12 anos)"),
        o("operatorio_formal", "Operatório formal (a partir de 12 anos)"),
        o("transicao", "Transição entre estágios", "Especifique entre quais estágios."),
      ]),
      ue("piaget_estagio", "Identificação do estágio conforme critérios de Piaget", [
        o("compativel", "Estágio compatível com a faixa etária cronológica"),
        o("defasagem", "Defasagem de desenvolvimento cognitivo em relação à idade", "Em qual noção?"),
        o("acima", "Desempenho acima do esperado para a faixa etária"),
      ]),
    ]),
  ],
  ["NAO IMPLEMENTAR ATE VALIDACAO: o sistema não relaciona o nível de aquisição ao estágio. Quem identifica o estágio é o psicopedagogo."]
);

const PPC_CONCLUSAO = def(
  "ppc_conclusao",
  "3",
  "Conclusão da avaliação psicopedagógica",
  "Conclusão",
  "Síntese marcada pelo psicopedagogo. O sistema não resume nem classifica.",
  [
    sec("sintese", "Síntese da avaliação psicopedagógica completa", [
      ue("modalidade_eoca", "Aspecto cognitivo-afetivo (EOCA): modalidade", [
        o("hipoassimilativa", "Predomínio de hipoassimilação — pouca iniciativa"),
        o("hiperassimilativa", "Predomínio de hiperassimilação — interpreta tudo a partir do que conhece"),
        o("hipoacomodativa", "Predomínio de hipoacomodação — pouca flexibilidade diante de novas situações"),
        o("hiperacomodativa", "Predomínio de hiperacomodação — pouca autonomia, dependência de modelo"),
      ]),
      mx(
        "vinculos",
        "Provas projetivas psicopedagógicas",
        [
          ["escolar", "Vínculo escolar"],
          ["familia", "Vínculo com a família"],
          ["consigo", "Vínculo consigo"],
        ],
        VINCULO
      ),
      mx(
        "linguagem_escrita",
        "Linguagem escrita",
        [
          ["decodificacao", "Decodificação"],
          ["fluencia_leitora", "Fluência leitora"],
          ["compreensao_leitora", "Compreensão leitora"],
          ["ortografia", "Ortografia"],
          ["fluencia_escrita", "Fluência de escrita"],
          ["producao_textual", "Produção escrita textual"],
        ],
        ADEQ_DEF_NAV
      ),
      mx(
        "competencia_matematica",
        "Competência matemática",
        BAC_COMPETENCIAS.map((c) => [c.id, c.titulo.replace("Competência ", "")] as [string, string]),
        ADEQ_DEF_NAV
      ),
      mx(
        "habilidades_cognitivas",
        "Habilidades cognitivas (resultados obtidos na avaliação neuropsicológica)",
        [
          ["atencao", "Atenção"],
          ["memoria", "Memória"],
          ["perceptuais_visuais", "Habilidades perceptuais visuais"],
          ["funcoes_executivas", "Funções executivas (planejamento, organização, automonitoramento, flexibilidade, controle inibitório)"],
        ],
        ADEQ_DEF_NAV
      ),
      ue("nivel_cognitivo", "Nível de desenvolvimento cognitivo (provas piagetianas)", [
        o("sensorio_motor", "Sensório-motor (0 a 2 anos)"),
        o("pre_operatorio", "Pré-operatório (2 a 7 anos)"),
        o("operatorio_concreto", "Operatório concreto (7 a 11/12 anos)"),
        o("operatorio_formal", "Operatório formal (a partir de 12 anos)"),
        o("transicao", "Transição entre estágios"),
      ]),
      ue("nivel_cognitivo_idade", "Em relação à idade", [
        o("compativel", "Estágio compatível com a faixa etária cronológica"),
        o("defasagem", "Defasagem de desenvolvimento cognitivo em relação à idade"),
        o("acima", "Desempenho acima do esperado para a faixa etária"),
      ]),
    ]),
  ]
);

const PPC_PLANO = def(
  "ppc_conduta_plano",
  "4",
  "Conduta e plano terapêutico psicopedagógico",
  "Conduta e plano",
  "Escolha as áreas de intervenção e descreva o plano. O sistema não indica conduta.",
  [
    sec("conduta", "Conduta: encaminhamentos e/ou terapia psicopedagógica", [
      m(
        "conduta_cognitivo_afetivo",
        "Aspectos cognitivo-afetivos",
        [
          o("vinculo_afetividade", "Vínculo e afetividade"),
          o("flexibilidade", "Flexibilidade cognitiva e abertura ao novo"),
          o("autorregulacao", "Autorregulação e funções executivas"),
          o("linguagem_pensamento", "Linguagem, comunicação e pensamento estruturado"),
          o("autonomia", "Autonomia, criatividade e protagonismo"),
        ]
      ),
      m(
        "conduta_projetivas",
        "Provas projetivas psicopedagógicas",
        [
          o("ressignificar_erro", "Ressignificação da aprendizagem e do erro"),
          o("autoimagem", "Fortalecimento da autoimagem e autoestima acadêmica"),
          o("ansiedade_escolar", "Autorregulação emocional e enfrentamento da ansiedade escolar"),
          o("integracao_social", "Integração social e pertencimento no ambiente escolar"),
          o("corresponsabilizacao", "Corresponsabilização e alinhamento família-escola-terapia"),
        ]
      ),
      m(
        "conduta_leitura",
        "Processos de leitura",
        [
          o("habilidades_auditivas", "Treino de habilidades auditivas"),
          o("processamento_fonologico", "Estimulação do processamento fonológico"),
          o("vocabulario", "Ampliação de vocabulário"),
          o("sintaxe", "Estruturação sintática"),
          o("pragmatica", "Pragmática"),
        ]
      ),
      m(
        "conduta_escrita",
        "Linguagem escrita",
        [
          o("conhecimento_alfabetico", "Conhecimento alfabético"),
          o("rota_fonologica", "Fortalecimento da rota fonológica, nomeação rápida"),
          o("dominio_ortografico", "Domínio ortográfico"),
          o("compreensao_leitora", "Compreensão leitora"),
          o("producao_textual", "Produção textual"),
        ]
      ),
      m(
        "conduta_cognitivo",
        "Estimulação/treino cognitivo",
        [
          o("atencao", "Atenção"),
          o("memoria", "Memória"),
          o("perceptuais_visuais", "Habilidades perceptuais visuais"),
          o("funcoes_executivas", "Funções executivas: planejamento, organização, monitoramento"),
        ]
      ),
      m(
        "conduta_logico",
        "Habilidades de raciocínio lógico-operatório",
        [
          o("classificacao", "Desenvolver classificação por um ou mais critérios"),
          o("relacoes", "Estabelecer relações e comparações"),
          o("seriacao", "Desenvolver seriação e ordenação"),
          o("conservacao", "Favorecer compreensão de conservação"),
          o("hipoteses", "Ampliar capacidade de formular e verificar hipóteses"),
          o("transferencia", "Favorecer transferência dessas habilidades para situações acadêmicas"),
        ]
      ),
      m(
        "conduta_matematica",
        "Habilidades matemáticas",
        [
          o("verbal", "Verbal: compreensão dos conceitos matemáticos, nomeação de quantidades, números, termos e símbolos"),
          o("pratognostica", "Pratognóstica: comparar, enumerar quantidade e tamanho, manipular objetos"),
          o("lexica", "Léxica: ler números e símbolos matemáticos"),
          o("grafica", "Gráfica: escrita dos símbolos matemáticos e seu uso nas operações"),
          o("ideognostica", "Ideognóstica: conceitos matemáticos, relações, cálculos e operações mentais"),
          o("operacional", "Operacional: realizar operações matemáticas e cálculos numéricos"),
        ]
      ),
      tl("conduta", "Conduta"),
    ]),
    sec("plano", "Plano terapêutico psicopedagógico", [
      t("diagnostico", "Diagnóstico (texto do profissional)"),
      data("data_ultima_avaliacao", "Data da última avaliação"),
      tl("hipotese_psicopedagogica", "Hipótese diagnóstica psicopedagógica"),
      data("data_prevista_reavaliacao", "Data prevista de reavaliação"),
      t("sessoes_previstas", "Número previsto de sessões"),
      tl("principais_achados", "1. Principais achados"),
      tl("objetivo_geral", "2. Objetivo geral"),
      tl("objetivo_a", "3. Objetivos específicos — a)"),
      opc(tl("objetivo_b", "3. Objetivos específicos — b)")),
      opc(tl("objetivo_c", "3. Objetivos específicos — c)")),
      opc(tl("objetivo_d", "3. Objetivos específicos — d)")),
      tl("criterios_alta", "4. Critérios de alta"),
      opc(tl("comentarios", "5. Comentários")),
    ]),
  ],
  ["A decisão de alta continua exclusivamente com o médico responsável: aqui ficam só os critérios propostos pelo psicopedagogo."]
);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// PSICOLOGIA e NEUROPSICOLOGIA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const PSI_ENTREVISTA = def(
  "psi_entrevista_inicial",
  "A",
  "Entrevista psicológica inicial",
  "Entrevista inicial",
  "Preencha com o responsável e a criança. Marque só o que foi relatado.",
  [
    sec("estado", "Estado atual da criança", [
      ns("estado_atual", "Estado atual", [
        ["choro_facil", "Apresenta choro fácil"],
        ["recusa_auxilio", "Recusa auxílio"],
        ["resistencia_toque", "Tem resistência ao toque (afago, carinho)"],
        ["roer_unhas", "Apresenta comportamentos como roer unhas, chupar o dedo ou puxar os cabelos"],
      ], false),
      ns("sofrimento", "Reage com sofrimento exagerado diante de", [
        ["irmaos", "Nascimento de irmãos"],
        ["mudancas", "Mudanças"],
        ["mortes_doencas", "Mortes e doenças (de quem?)"],
        ["desempregos", "Desempregos"],
        ["separacoes", "Separações"],
      ]),
    ]),
    sec("emocionais", "Características emocionais", [
      ns(
        "caracteristicas",
        "Características emocionais",
        [
          ["corajoso", "Corajoso"],
          ["medroso", "Medroso"],
          ["obediente", "Obediente"],
          ["desobediente", "Desobediente"],
          ["tranquilo", "Tranquilo"],
          ["irritado", "Irritado"],
          ["alegre", "Alegre"],
          ["triste", "Triste"],
          ["timido", "Tímido"],
          ["comunicativo", "Comunicativo"],
          ["independente", "Independente"],
          ["dependente", "Dependente"],
          ["estavel", "Estável"],
          ["impulsivo", "Impulsivo"],
          ["ansioso", "Ansioso"],
          ["compulsivo", "Compulsivo"],
          ["participativo", "Participativo"],
          ["emotivo", "Emotivo"],
          ["agressivo", "Agressivo"],
          ["queixoso", "Queixoso"],
          ["desconfiado", "Desconfiado"],
        ],
        false
      ),
    ]),
    sec("rotinas", "Rotinas e sono", [
      ns("avd", "É dependente nas atividades da vida diária abaixo?", [
        ["banho", "Tomar banho"],
        ["dentes", "Escovar os dentes"],
        ["vestir", "Vestir-se ou despir-se"],
        ["dormir", "Dormir (com os pais, irmãos ou outros)"],
      ], false),
      ns("sono", "Qualidade do sono", [
        ["iniciar", "Dificuldade para iniciar o sono"],
        ["despertares", "Despertares frequentes durante a noite"],
        ["hipersonia", "Sono excessivo / hipersonia"],
      ], false),
    ]),
    sec("sociabilidade", "Sociabilidade", [
      ns("sociabilidade", "Sociabilidade", [
        ["amigos", "Faz amigos com facilidade"],
        ["mudancas_abruptas", "Adapta-se às mudanças abruptas"],
        ["frustracoes", "Tolera frustrações sem emoções disruptivas"],
        ["adiar", "É capaz de adiar gratificações"],
        ["interage_todas", "Interage com todas as demais crianças sem discriminar"],
        ["curiosidade_sexo", "Já demonstrou curiosidade sobre sexo"],
      ], false),
    ]),
    sec("lazer", "Lazer", [
      ns("lazer", "Lazer", [
        ["televisao", "Televisão"],
        ["musica", "Instrumentos musicais"],
        ["leitura", "Leitura"],
        ["celular", "Celular"],
        ["eletronicos", "Eletrônicos"],
        ["esportes", "Esportes"],
        ["danca", "Dança"],
      ], false),
    ]),
    sec("disciplina", "Medidas disciplinares usadas pelos pais", [
      tl("reacao_contrariado", "Como seu filho reage quando é contrariado?"),
      tl("atitude_pais", "Qual a atitude dos pais nessa ocasião?"),
    ]),
    sec("impressao", "Impressão do psicólogo", [
      ue("vinculo", "Vínculo", [o("bom", "Bom"), o("regular", "Regular"), o("ruim", "Ruim")]),
      ue("credibilidade", "Credibilidade das respostas", [o("bom", "Bom"), o("regular", "Regular"), o("ruim", "Ruim")]),
    ]),
  ],
  ["O item 'Interage com todas as demais sem discriminar (mesma idade, mais nova, mais velha)' foi simplificado para Não/Sim com observação."]
);

const PSI_MASC = def(
  "psi_masc",
  "B",
  "MASC — Escala multidimensional de ansiedade para crianças (resultado)",
  "MASC",
  "Instrumento externo. Registre só a data e o escore que consta no protocolo; o sistema não reproduz os 39 itens nem interpreta.",
  [
    sec("resultado", "Resultado informado pelo profissional", [
      data("data_aplicacao", "Data da aplicação"),
      t("escore", "Escore informado no protocolo"),
      tl("anotacao", "Anotações do profissional"),
    ]),
  ],
  ["NAO IMPLEMENTAR ATE VALIDACAO: itens, versão e licença do MASC. Os 39 itens do PDF não foram digitalizados e o sistema não soma."]
);

const PSI_SCARED = def(
  "psi_scared",
  "F",
  "SCARED — Escala de transtornos relacionados à ansiedade infantil (resultado)",
  "SCARED",
  "Instrumento externo. Registre só a data e o escore do protocolo; o sistema não reproduz os 41 itens nem interpreta.",
  [
    sec("resultado", "Resultado informado pelo profissional", [
      data("data_aplicacao", "Data da aplicação"),
      t("escore", "Escore informado no protocolo"),
      tl("anotacao", "Anotações do profissional"),
    ]),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO: o PDF traz a nota 'maior que 25 = chance de ter transtorno de ansiedade'. O sistema NÃO exibe nem aplica esse ponto de corte: a interpretação fica com o psicólogo.",
    "Itens e licença do SCARED não foram digitalizados.",
  ]
);

const PSI_SEGUIMENTO = def(
  "psi_seguimento",
  "E",
  "Sessão psicológica de seguimento",
  "Seguimento",
  "Marque, para cada sintoma ou sinal, o que foi observado nesta sessão.",
  [
    sec("evolucao", "Evolução comportamental e cognitiva", [
      mx(
        "sintomas",
        "Sintomas e sinais",
        [
          ["medo", "Medo"],
          ["choro_facil", "Choro fácil"],
          ["dor_costas", "Dor nas costas"],
          ["dor_bracos", "Dor nos braços"],
          ["enxaqueca", "Enxaqueca"],
          ["formigamento", "Formigamento"],
          ["dificuldade_sono", "Dificuldade para pegar no sono"],
        ],
        NORMAL_ALT_NS
      ),
      ue("aproveitamento", "A criança teve aproveitamento adequado nas técnicas aplicadas", NS),
      tl("conclusao", "Conclusão"),
    ]),
  ]
);

const PSI_TAC_SUMARIO_GRUPOS: { id: string; titulo: string; itens: [string, string][] }[] = [
  {
    id: "depressivas",
    titulo: "Síndromes depressivas",
    itens: [
      ["desapego", "Desapego a objetos, pessoas"],
      ["desmotivacao", "Desmotivação, cansaço, sonolência, baixa autoestima"],
      ["medo_irritabilidade", "Medo, irritabilidade, intolerância, autodestruição"],
      ["comunicacao_isolamento", "Comunicação interpessoal difícil, isolamento"],
      ["choro_tristeza", "Choro fácil, tristeza sem motivo aparente"],
      ["concentracao_rendimento", "Dificuldade em concentrar-se, queda no rendimento"],
      ["apetite_dores", "Apetite instável, dores de cabeça, abdominais, tontura"],
    ],
  },
  {
    id: "ansiosas",
    titulo: "Síndromes ansiosas",
    itens: [
      ["choro_preocupacao", "Choro fácil, preocupação com tudo"],
      ["irritabilidade_impulso", "Irritabilidade, impulso, antecipação"],
      ["desatencao", "Desatenção, desconcentração, perda de pertences"],
      ["tiques", "Tiques, hiperatividade, falta de ar"],
      ["inquietos", "Pés e mãos inquietos, cansaço, dor de cabeça ou abdominal"],
    ],
  },
  {
    id: "desadaptativas",
    titulo: "Síndromes desadaptativas",
    itens: [
      ["raiva", "Raiva, ressentimento, rancor, vingança, luta"],
      ["impaciencia", "Impaciência, destrutividade, intimidação, provocação, crueldade"],
      ["ameaca", "Ameaça verbal e física, desafio de regras"],
      ["objetos_arma", "Uso de objetos como arma, furto, responsabilização de terceiros"],
      ["nao_atende", "Não atendimento a solicitações, discussão, desafio"],
    ],
  },
  {
    id: "respiratorias",
    titulo: "Síndromes respiratórias ou alérgicas",
    itens: [
      ["coriza", "Coriza, espirros, falta de ar no repouso ou esforço, voz nasal"],
      ["lacrimacao", "Lacrimação, vermelhidão, prurido nos olhos"],
      ["rejeicao_esforco", "Rejeição a esforço físico, fadiga, tosse ao esforço"],
      ["obstrucao_nasal", "Obstrução nasal, pigarro, prurido nasal, respiração bucal"],
      ["apatia", "Apatia, sonolência, concentração ruim, irritabilidade"],
    ],
  },
  {
    id: "dolorosas",
    titulo: "Síndromes dolorosas",
    itens: [
      ["dores_recorrentes", "Dores recorrentes (abdominais, de cabeça, dos membros inferiores)"],
      ["dor_obstaculo", "Dor como obstáculo para participação nas atividades cotidianas"],
      ["vomitos", "Vômitos, náuseas, recusa a alimentação, apatia, irritabilidade"],
      ["banheiro", "Recusa a ir ao banheiro, necessidade de medicação"],
    ],
  },
  {
    id: "aprendizagem",
    titulo: "Transtornos de aprendizagem",
    itens: [
      ["desatencao_desorganizacao", "Desatenção, não obediência a instruções, desorganização, perdas"],
      ["nao_cumpre_tarefas", "Não cumprimento de tarefas, erros, desconcentração, esquecimento"],
      ["desassossego", "Desassossego, inquietação, fala excessiva, incontinência"],
      ["interrupcao", "Incontinência, interrupção, perturbação da aula, repetição"],
      ["substituicao", "Substituição, distorção, não compreensão"],
      ["erros_constantes", "Erros constantes, não cumprimento das tarefas"],
      ["fala_vocabulario", "Problemas na fala, vocabulário restrito, pausa"],
      ["recusa_escola", "Recusa à escola, baixa autoestima, isolamento"],
      ["sons_silabas", "Não associação de sons a sílabas, não aquisição de novas estruturas"],
      ["inadequacao", "Inadequação, irritabilidade"],
    ],
  },
  {
    id: "espectro",
    titulo: "Espectro autista",
    itens: [
      ["nao_comunicacao_verbal", "Não comunicação verbal, desinteresse, linguagem pobre"],
      ["emocoes_rituais", "Não reconhecimento de emoções, repetições, rituais, estereotipias"],
      ["atraso_incoordenacao", "Atraso no desenvolvimento, incoordenação motora"],
      ["comunicacao_limitada", "Comunicação limitada, memória ruim"],
    ],
  },
];

const PSI_TAC_SUMARIO = def(
  "psi_tac_sumario",
  "G",
  "Sumário da TAC (Terapia Analítico-Comportamental)",
  "Sumário da TAC",
  "Para cada grupo de sinais, marque se há alteração moderada (M) ou grave (G). Em branco quer dizer sem registro.",
  [
    sec("sessoes", "Sessões", [t("sessoes_realizadas", "Número de sessões realizadas")]),
    ...PSI_TAC_SUMARIO_GRUPOS.map((g) =>
      sec(`tac_${g.id}`, g.titulo, [
        mx(`tac_${g.id}`, g.titulo, g.itens, [o("moderada", "M · Moderada"), o("grave", "G · Grave")]),
      ])
    ),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO (comentários do revisor no PDF): 'Transtornos de aprendizagem' mistura transtornos de aprendizagem com comportamentais e alguns itens se repetem. Perguntar à Dra. se a lista foi criada e validada no Tarumã ou é nova antes de usar em produção.",
    "As colunas M/G do PDF são repetidas em quatro blocos por linha; foram entendidas como uma marcação por linha em cada momento. Confirmar se o quadro é repetido por sessão.",
  ]
);

const PSI_TAC_ALTA = def(
  "psi_tac_alta",
  "H",
  "Alta da TAC",
  "Alta da TAC",
  "Registro do psicólogo sobre o encerramento da terapia. A decisão de alta do caso continua com o médico.",
  [
    sec("encaminhamento", "Encaminhamento", [
      mx(
        "encaminhamentos",
        "Encaminhamento",
        [
          ["psicomotricista", "Psicomotricista"],
          ["fonoaudiologa", "Fonoaudióloga"],
          ["psicopedagogo_clinico", "Psicopedagogo clínico"],
          ["psicopedagogo_institucional", "Psicopedagogo institucional"],
          ["psiquiatra", "Psiquiatra"],
        ],
        NS
      ),
      tl("melhora", "Melhora (descrição do psicólogo, sem percentual)"),
    ]),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO (comentário do revisor no PDF): a 'melhora' aparece como 30%, 50% e 70%; o revisor sugere opções sem porcentagem (ex.: progresso discreto, parcial). Até a decisão, é texto livre, para não criar peso que a Dra. disse não existir.",
  ]
);

const PSI_GRUPO_INICIAL = def(
  "psi_grupo_entrevista_inicial",
  "I",
  "Grupo operativo de pais — entrevista inicial com um responsável",
  "Entrevista inicial (grupo)",
  "Não registre nome do responsável. Marque só as respostas dadas na entrevista.",
  [
    sec("entrevista", "Entrevista inicial", [
      ue("sabe_por_que_vem", "Você sabe por que seu filho vem ao núcleo?", NS),
      ue("tempo_acompanhamento", "Há quanto tempo seu filho está em acompanhamento?", [o("menos_1", "Menos de 1 ano"), o("um_ano", "1 ano"), o("mais_1", "Mais de 1 ano")]),
      m("importancia_grupo", "Você sabe por que a participação nos grupos de pais é importante?", [
        o("aprender_transtorno", "Para aprender sobre o transtorno do meu filho"),
        o("aprender_crise", "Para aprender o que fazer quando ele tem crise"),
        o("mudar_aceitar", "Para aprender o que é importante mudar em mim, aceitar e acolher meu filho"),
        o("dividir", "Para reunir com outros pais e dividir preocupações e avanços no cuidado com meu filho"),
        o("todas", "Todas as anteriores"),
        o("nenhuma", "Nenhuma das anteriores"),
      ]),
      ue("sabe_habilidade", "Você sabe dizer qual a principal habilidade de seu filho?", [o("sim", "Sim", "Qual?"), o("nao", "Não")]),
      ue("gostaria_participar", "Você gostaria de participar do grupo?", [o("sim", "Sim"), o("nao", "Não", "Qual o motivo?"), o("talvez", "Talvez")]),
    ]),
  ],
  ["O termo de consentimento do grupo (TCLE) vai para o módulo de consentimento, não é formulário clínico. Nomes de mãe, pai e escola foram omitidos."]
);

const PSI_GRUPO_SUMARIO = def(
  "psi_grupo_sumario",
  "J",
  "Sumário de avaliação dos grupos operativos",
  "Sumário dos grupos",
  "Marque o que ocorreu no grupo.",
  [
    sec("temas", "Participou da sessão com os temas abaixo?", [
      ns(
        "temas",
        "Temas",
        [
          ["alimentacao", "Alimentação saudável"],
          ["relogio_biologico", "Relógio biológico"],
          ["atividade_fisica", "Atividade física"],
          ["eletronicos", "Uso consciente de eletrônicos"],
          ["organizacao_espaco", "Organização do espaço"],
          ["rotina", "Importância e organização da rotina diária"],
          ["regras_limites", "Orientações sobre regras e limites"],
        ],
        false
      ),
    ]),
    sec("psicossociais", "Aspectos psicossociais do familiar", [
      ns(
        "psicossociais",
        "Aspectos psicossociais do familiar",
        [
          ["envolvimento", "Envolvimento com o grupo"],
          ["empatia", "Empatia"],
          ["autocontrole", "Autocontrole"],
          ["resiliencia", "Resiliência"],
          ["autoritario", "Autoritário"],
          ["permissivo", "Permissivo"],
          ["autoritativo", "Autoritativo"],
        ],
        false
      ),
    ]),
    sec("encaminhamento", "Encaminhamento para pais", [
      ns(
        "encaminhamento",
        "Encaminhamento para pais",
        [
          ["psicoterapia_ubs", "Psicoterapia — UBS"],
          ["caps", "CAPS para avaliação"],
          ["cras", "CRAS"],
          ["creas", "CREAS"],
          ["conselho_tutelar", "Conselho Tutelar"],
          ["outro", "Outro"],
        ],
        true
      ),
    ]),
  ],
  ["Estilos parentais (autoritário, permissivo, autoritativo) são marcação do psicólogo; sem escore, sem peso, sem rótulo automático."]
);

const PSI_GRUPO_FINAL = def(
  "psi_grupo_entrevista_final",
  "K",
  "Entrevista final com membros do grupo operativo",
  "Entrevista final (grupo)",
  "Não registre nome do responsável.",
  [
    sec("entrevista", "Entrevista final", [
      ue("sabe_por_que_vem", "Você sabe por que seu filho vem ao núcleo?", NS),
      ue("tempo_acompanhamento", "Há quanto tempo seu filho está em acompanhamento?", [o("menos_1", "Menos de 1 ano"), o("um_ano", "1 ano"), o("mais_1", "Mais de 1 ano")]),
      m("aprendeu", "O que você aprendeu com esses encontros?", [
        o("sobre_transtorno", "Sobre o transtorno do meu filho"),
        o("sobre_crise", "Sobre o que fazer quando ele tem crise"),
        o("mudar_aceitar", "O que é importante mudar em mim, aceitar e acolher meu filho"),
        o("dividir", "Dividir preocupações e avanços no cuidado com meu filho"),
        o("todas", "Todas as anteriores"),
        o("nenhuma", "Nenhuma das anteriores"),
      ]),
      ue("sabe_habilidade", "Você sabe dizer qual a principal habilidade de seu filho?", [o("sim", "Sim", "Qual?"), o("nao", "Não")]),
      tl("descobriu", "Que mais descobriu sobre ele nos encontros?"),
      ue("gostou", "Você gostou de participar do grupo?", [o("sim", "Sim"), o("nao", "Não"), o("as_vezes", "Às vezes")]),
    ]),
  ]
);

const CLASSE_ANP = CLASSE_WISC;
const ANP_RESULTADO = def(
  "anp_resultado_tecnico",
  "C",
  "Resultado técnico da avaliação neuropsicológica (ANp)",
  "Resultado técnico",
  AVISO_RESULTADO,
  [
    sec("wisc", "WISC-IV — pontos compostos", [
      mx(
        "wisc",
        "WISC-IV",
        [
          ["compreensao_verbal", "Compreensão verbal"],
          ["organizacao_perceptual", "Organização perceptual"],
          ["memoria_operacional", "Memória operacional"],
          ["velocidade_processamento", "Velocidade de processamento"],
          ["qi_total", "QI total"],
        ],
        CLASSE_ANP,
        { comNumero: "Pontos compostos", comObs: true }
      ),
    ], "Percentil: registre na observação de cada linha."),
    sec("rey", "Figuras complexas de Rey", [
      mx(
        "rey",
        "Figuras complexas de Rey",
        [
          ["copia", "Cópia"],
          ["memoria", "Reprodução de memória"],
        ],
        CLASSE_REY,
        { comNumero: "Pontos brutos", comObs: true }
      ),
    ], "Percentil: registre na observação de cada linha."),
    sec("fdt", "Teste dos Cinco Dígitos (FDT)", [
      mx(
        "fdt_automaticos",
        "Processos automáticos",
        [
          ["leitura", "Leitura"],
          ["contagem", "Contagem"],
        ],
        CLASSE_ANP,
        { comNumero: "Pontos", comObs: true }
      ),
      mx(
        "fdt_controlados",
        "Processos controlados",
        [
          ["escolha", "Escolha"],
          ["alternancia", "Alternância"],
          ["inibicao", "Inibição"],
          ["flexibilidade", "Flexibilidade"],
        ],
        CLASSE_ANP,
        { comNumero: "Pontos", comObs: true }
      ),
    ], "Percentil: registre na observação de cada linha."),
    sec("tavis", "TAVIS-4", [
      mx(
        "tavis_tempo",
        "Tempo médio de reação",
        [
          ["tarefa1", "Tarefa 1"],
          ["tarefa2", "Tarefa 2"],
          ["tarefa3", "Tarefa 3"],
        ],
        [],
        { comNumero: "Escore", comObs: true }
      ),
      mx(
        "tavis_omissao",
        "Erros por omissão",
        [
          ["tarefa1", "Tarefa 1"],
          ["tarefa2", "Tarefa 2"],
          ["tarefa3", "Tarefa 3"],
        ],
        [],
        { comNumero: "Escore", comObs: true }
      ),
      mx(
        "tavis_acao",
        "Erros por ação",
        [
          ["tarefa1", "Tarefa 1"],
          ["tarefa2", "Tarefa 2"],
          ["tarefa3", "Tarefa 3"],
        ],
        [],
        { comNumero: "Escore", comObs: true }
      ),
    ], "Faixa percentil e % de crianças com mais erros: registre na observação de cada linha."),
    sec("final", "Resultado final", [tl("resultado_final", "Resultado final (texto do neuropsicólogo)")]),
  ],
  ["NAO IMPLEMENTAR ATE VALIDACAO: licença e versão do WISC-IV, Rey, FDT, TAVIS-4 e Escala de Maturidade Colúmbia. O sistema não converte pontos em percentil nem em classificação."]
);

const ANP_SUMARIO = def(
  "anp_sumario",
  "D",
  "Sumário da avaliação neuropsicológica (ANp)",
  "Sumário da ANp",
  "Resumo marcado pelo neuropsicólogo. O sistema não resume nem classifica.",
  [
    sec("wisc", "WISC-IV — eficiência intelectual", [
      mx(
        "wisc",
        "Índices",
        [
          ["icv", "Índice de compreensão verbal"],
          ["ioc", "Índice de organização perceptual"],
          ["imo", "Índice de memória operacional"],
          ["ivp", "Índice de velocidade de processamento"],
          ["qi_total", "QI total"],
        ],
        CLASSE_WISC,
        { comNumero: "Pontos compostos", comObs: true }
      ),
    ], "Percentil: registre na observação de cada linha."),
    sec("rey", "Figura de Rey", [
      mx(
        "rey",
        "Figura de Rey",
        [
          ["copia", "Cópia"],
          ["recordacao", "Recordação"],
        ],
        CLASSE_REY
      ),
    ]),
    sec("fdt", "Teste dos Cinco Dígitos (FDT)", [
      mx(
        "fdt",
        "FDT",
        [
          ["fdt", "FDT"],
          ["leitura", "Leitura"],
          ["contagem", "Contagem"],
          ["escolha", "Escolha"],
          ["alternancia", "Alternância"],
          ["inibicao", "Inibição"],
          ["flexibilidade", "Flexibilidade"],
        ],
        CLASSE_WISC
      ),
    ]),
    sec("tavis", "TAVIS-4 (atenção)", [mx("tavis", "TAVIS-4", [["atencao", "Atenção"]], CLASSE_WISC)]),
    sec("conclusao", "Conclusão", [
      tl("hipotese", "Hipótese diagnóstica (texto do neuropsicólogo)"),
      tl("conclusao", "Conclusão"),
    ]),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO: 'Hipótese diagnóstica' é texto digitado pelo profissional. Confirmar com a Dra. se este campo deve ficar visível ao médico antes da devolutiva concluída.",
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// PSICOMOTRICIDADE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const HMB_COLUNAS: ReOpcao[] = [o("a", "A · realiza sozinho"), o("b", "B · realiza com ajuda"), o("c", "C · não realiza")];
const HMB_MANIPULATIVA: [string, string][] = [
  ["arremessar", "Arremessar"],
  ["quicar", "Quicar"],
  ["chutar", "Chutar"],
  ["lancar", "Lançar"],
  ["receber", "Receber"],
  ["rebater", "Rebater"],
  ["cabecear", "Cabecear"],
  ["agarrar", "Agarrar"],
  ["rolar", "Rolar"],
];
const HMB_LOCOMOTORA: [string, string][] = [
  ["andar", "Andar"],
  ["correr", "Correr"],
  ["saltar", "Saltar"],
  ["saltitar", "Saltitar"],
  ["rastejar", "Rastejar"],
  ["escorregar", "Escorregar"],
  ["escalar", "Escalar"],
  ["rolar", "Rolar"],
  ["desviar", "Desviar"],
];
const HMB_ESTABILIZACAO: [string, string][] = [
  ["ficar_em_pe", "Ficar em pé"],
  ["sentar", "Sentar"],
  ["equilibrar", "Equilibrar-se"],
  ["estender", "Estender"],
  ["girar", "Girar"],
  ["flexionar", "Flexionar"],
  ["posicoes_invertidas", "Posições invertidas"],
];

const PERFIL_RESP: ReOpcao[] = [o("1", "1 · Apráxico"), o("2", "2 · Dispráxico"), o("3", "3 · Eupráxico"), o("4", "4 · Hiperpráxico")];
const TIPO_APNEIA: ReOpcao[] = [
  o("ate_10", "Mantém bloqueio torácico abaixo de 10 s"),
  o("11_20", "Entre 11 s e 20 s"),
  o("21_30", "Entre 21 s e 30 s"),
  o("acima_30", "Acima de 30 s"),
];

/** Cada prova da bateria psicomotora recebe um nível de 1 a 4 marcado pelo profissional. Nada é somado. */
const nivel = (key: string, label: string, rows: [string, string][], extra: Partial<CampoMatriz> = {}) => mx(key, label, rows, NIVEL_1_4, extra);

const PSM_AVALIACAO_1 = def(
  "psm_habilidades_basicas",
  "1",
  "Habilidades motoras básicas, controle respiratório e tonicidade",
  "Habilidades, respiração e tônus",
  "Marque, para cada habilidade, A, B ou C. Nos blocos 2 e 3, o nível de 1 a 4 conforme a bateria. O sistema não soma.",
  [
    sec("manipulativa", "Habilidades manipulativas", [mx("manipulativa", "Manipulativa", HMB_MANIPULATIVA, HMB_COLUNAS)]),
    sec("locomotora", "Habilidades locomotoras", [mx("locomotora", "Locomotora", HMB_LOCOMOTORA, HMB_COLUNAS)]),
    sec("estabilizacao", "Habilidades de estabilização", [mx("estabilizacao", "Estabilização", HMB_ESTABILIZACAO, HMB_COLUNAS)]),
    sec("habilitacao", "Nível de habilitação", [
      ue("habilitacao", "Nível de habilitação (escolhido pelo profissional)", [
        o("suficiente", "Suficientemente habilitado — independente para a maior parte das atividades"),
        o("moderado", "Moderadamente habilitado — independente para algumas atividades"),
        o("nao_habilitado", "Não habilitado — dependente para todas as atividades"),
      ]),
    ]),
    sec("respiratorio", "Controle respiratório", [
      ue("controle_respiratorio", "Perfil do controle respiratório", PERFIL_RESP),
      ue("apneia", "Apneia (tempo de bloqueio torácico)", TIPO_APNEIA),
      ue("tipo_corpo", "Observação do tipo de corpo", [
        o("mesomorfo", "Mesomorfo — estrutura muscular atlética"),
        o("endomorfo", "Endomorfo — aspecto arredondado e amolecido"),
        o("ectomorfo", "Ectomorfo — linearidade e magreza corporal"),
      ]),
    ]),
    sec("tonicidade", "Tonicidade", [
      nivel("tonicidade_extensibilidade", "Extensibilidade", [
        ["membros_inferiores", "Membros inferiores"],
        ["membros_superiores", "Membros superiores"],
        ["passividade", "Passividade"],
      ]),
      nivel("tonicidade_paratonia", "Paratonia", [
        ["membros_inferiores", "Membros inferiores"],
        ["membros_superiores", "Membros superiores"],
      ]),
      nivel("tonicidade_diadococinesia", "Diadococinesia", [
        ["mao_direita", "Mão direita"],
        ["mao_esquerda", "Mão esquerda"],
      ]),
      nivel("tonicidade_sincinesia", "Sincinesia", [
        ["bucais", "Bucais"],
        ["contralaterais", "Contralaterais"],
      ]),
    ]),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO: o PDF define, para cada nível 1 a 4, um critério em segundos, graus ou acertos. Esses critérios são da bateria psicomotora (confirmar autoria e licença). O sistema registra só o nível marcado pelo profissional.",
    "O 'Escore final' da habilidade motora básica ('3 tentativas com o maior número de letras') não é calculado.",
    "No PDF, o 'Data ... Médico' do bloco 1 está como assinatura de médico; aqui é a assinatura do próprio profissional que preenche. Confirmar.",
  ]
);

const PSM_AVALIACAO_2 = def(
  "psm_equilibrio_lateralidade",
  "2",
  "Equilibração, lateralidade e noção do corpo",
  "Equilíbrio, lateralidade e corpo",
  "Marque o nível de 1 a 4 de cada prova, conforme a bateria. O sistema não soma.",
  [
    sec("equilibracao", "Equilibração", [
      nivel("equilibracao_imobilidade", "Imobilidade", [["imobilidade", "Imobilidade"]]),
      nivel("equilibracao_estatico", "Equilíbrio estático", [
        ["apoio_retilineo", "Apoio retilíneo"],
        ["ponta_dos_pes", "Ponta dos pés"],
        ["apoio_num_pe", "Apoio num pé, direito-esquerdo"],
      ]),
      nivel("equilibracao_dinamico", "Equilíbrio dinâmico", [["marcha_controlada", "Marcha controlada"]]),
      nivel("equilibracao_trave", "Evolução na trave", [
        ["frente", "Para frente"],
        ["tras", "Para trás"],
        ["lado_direito", "Do lado direito"],
        ["lado_esquerdo", "Do lado esquerdo"],
        ["pe_direito_coxo", "Pé direito coxo"],
        ["pe_esquerdo_coxo", "Pé esquerdo coxo"],
        ["pes_juntos_frente", "Pés juntos para frente"],
        ["pes_juntos_tras", "Pés juntos para trás"],
        ["pes_juntos_olhos_fechados", "Pés juntos com os olhos fechados"],
      ]),
    ]),
    sec("lateralidade", "Lateralidade", [
      mx(
        "dominancia",
        "Dominância lateral (marque E ou D)",
        [
          ["ocular", "Ocular"],
          ["auditiva", "Auditiva"],
          ["manual", "Manual"],
          ["pedal", "Pedal"],
        ],
        [o("e", "Esquerda"), o("d", "Direita")],
        { comObs: true }
      ),
      nivel("lateralidade_nivel", "Lateralização (nível 1 a 4)", [
        ["ocular", "Ocular"],
        ["auditivo", "Auditivo"],
        ["manual", "Manual"],
        ["pedal", "Pedal"],
      ]),
      ue("tipo_lateralidade", "Tipo de lateralidade observada", [
        o("contrariada", "Contrariada"),
        o("cruzada", "Cruzada"),
        o("ambidestra", "Ambidestra"),
        o("definida", "Definida"),
      ]),
    ]),
    sec("noco_corpo", "Noção do corpo", [
      nivel("noco_corpo", "Noção do corpo", [
        ["sentido_cinestesico", "Sentido cinestésico"],
        ["reconhecimento_d_e", "Reconhecimento direita-esquerda"],
        ["autoimagem", "Autoimagem"],
        ["imitacao_gestos", "Imitação de gestos"],
        ["desenho_corpo", "Desenho do corpo"],
      ]),
    ]),
  ],
  [
    "O PDF define 'contrariada, cruzada, ambidestra' (podem produzir transtorno de aprendizagem). Aqui a opção 'definida' foi acrescentada só para registrar a lateralidade sem alteração. Confirmar com a Dra.",
  ]
);

const PSM_AVALIACAO_3 = def(
  "psm_espaco_praxias",
  "3",
  "Estruturação espaço-temporal e praxias",
  "Espaço-tempo e praxias",
  "Marque o nível de 1 a 4 de cada prova, conforme a bateria. O sistema não soma nem define o perfil.",
  [
    sec("espaco", "Estruturação espaço-temporal", [
      nivel("espaco_temporal", "Estruturação espaço-temporal", [
        ["organizacao", "Organização (percurso)"],
        ["representacao_topografica", "Representação topográfica"],
        ["estruturacao_ritmica", "Estruturação rítmica"],
        ["estruturacao_dinamica", "Estruturação dinâmica"],
      ]),
    ]),
    sec("praxia_global", "Praxia global", [
      nivel("praxia_global", "Praxia global", [
        ["coordenacao_oculomanual", "Coordenação oculomanual"],
        ["coordenacao_oculopedal", "Coordenação oculopedal"],
        ["dismetria", "Dismetria"],
        ["dissociacao", "Dissociação"],
        ["membros_superiores", "Membros superiores"],
        ["membros_inferiores", "Membros inferiores"],
        ["agilidade", "Agilidade"],
      ]),
    ]),
    sec("praxia_fina", "Praxia fina", [
      nivel("praxia_fina", "Praxia fina", [
        ["coordenacao_dinamica_manual", "Coordenação dinâmica manual"],
        ["tamborilar", "Tamborilar"],
        ["velocidade_precisao", "Velocidade-precisão"],
      ]),
    ]),
    sec("totais", "Totais informados pelo profissional (opcional)", [
      opc(t("total_tonicidade", "Tonicidade: total de pontos")),
      opc(t("total_equilibracao", "Equilibração: total de pontos")),
      opc(t("total_lateralizacao", "Lateralização: total de pontos")),
      opc(t("total_noco_corpo", "Noção do corpo: total de pontos")),
      opc(t("total_espaco_temporal", "Estruturação espaço-temporal: total de pontos")),
      opc(t("total_praxia_global", "Praxia global: total de pontos")),
      opc(t("total_praxia_fina", "Praxia fina: total de pontos")),
      opc(t("total_geral", "Pontuação total")),
      opc(
        ue("perfil_psicomotor", "Perfil psicomotor (escolhido pelo profissional)", [
          o("superior", "Superior"),
          o("bom", "Bom"),
          o("normal", "Normal"),
          o("dispraxico", "Dispráxico"),
          o("deficitario", "Deficitário"),
        ])
      ),
      opc(
        ue("perfil_motor_final", "Perfil motor final", [
          o("apraxico", "Apráxico — realização imperfeita, incompleta e descoordenada"),
          o("dispraxico", "Dispráxico — realização com dificuldade de controle"),
          o("eupraxico", "Eupráxico — realização controlada e adequada"),
          o("hiperpraxico", "Hiperpráxico — realização perfeita, econômica, harmoniosa e bem controlada"),
        ])
      ),
    ]),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO: o PDF traz a tabela 'pontos da bateria → perfil psicomotor → déficit de aprendizagem' e a soma dos sete blocos. O sistema NÃO soma, NÃO converte em perfil e NÃO mostra a coluna 'déficit de aprendizagem'. Totais e perfil são opcionais e digitados pelo profissional, até a Dra. confirmar se a bateria tem peso e como deve aparecer.",
  ]
);

const PSM_PLANO = def(
  "psm_plano_terapeutico",
  "10",
  "Plano terapêutico psicomotor e motor",
  "Plano terapêutico",
  "Preenchido pelo psicomotricista.",
  [
    sec("identificacao", "Identificação do plano", [
      data("data_ultima_avaliacao", "Data da última avaliação"),
      data("data_prevista_avaliacao", "Data prevista da avaliação"),
      tl("hipotese_educador_fisico", "Hipótese diagnóstica do educador físico (HDEF)"),
      tl("hipotese_psicomotricista", "Hipótese diagnóstica do psicomotricista (HDP)"),
      t("sessoes_previstas", "Número previsto de sessões"),
    ]),
    sec("plano", "Plano", [
      tl("principais_achados", "Principais achados"),
      tl("objetivo_geral", "Objetivo geral"),
      tl("objetivos_secundarios", "Objetivos secundários"),
      m("intervencoes", "Intervenções propostas", [
        o("habilidades_motoras_basicas", "Habilidades motoras básicas"),
        o("tonicidade", "Tonicidade"),
        o("equilibracao", "Equilibração"),
        o("lateralizacao", "Lateralização"),
        o("noco_corpo", "Noção do corpo"),
        o("espaco_temporal", "Estruturação espaço-temporal"),
        o("praxia_global", "Praxia global"),
        o("praxia_fina", "Praxia fina"),
      ]),
      tl("conduta_terapeutica", "Conduta terapêutica"),
      tl("criterios_alta", "Critérios de alta"),
    ]),
  ],
  ["A decisão de alta continua exclusivamente com o médico responsável: aqui ficam só os critérios propostos."]
);

/** Seguimento e manutenção têm o mesmo quadro (0 normal, 1 alterada, 9 não se aplica). */
function formSeguimento(id: string, letra: string, titulo: string, curto: string): FormDef {
  return def(id, letra, titulo, curto, "Marque, para cada habilidade, o que foi observado nesta entrevista.", [
    sec("entrevista", "Entrevista", [
      t("entrevista_numero", "Entrevista número"),
      data("data_entrevista", "Data da entrevista"),
      tl("queixas_atuais", "Queixas atuais"),
      tl("evolucao", "Evolução"),
      mx(
        "habilidades",
        "Habilidades",
        [
          ["motoras_basicas", "Motoras básicas"],
          ["tonicidade", "Tonicidade"],
          ["equilibracao", "Equilibração"],
          ["lateralizacao", "Lateralização"],
          ["noco_corpo", "Noção do corpo"],
          ["orientacao_espaco_temporal", "Orientação espaço-temporal"],
          ["praxia_global", "Praxia global"],
          ["praxia_fina", "Praxia fina"],
        ],
        NORMAL_ALT_NA
      ),
      tl("conduta", "Conduta"),
    ]),
  ]);
}

const PSM_SEGUIMENTO = formSeguimento("psm_seguimento", "11", "Formulário de seguimento do psicomotricista", "Seguimento");
const PSM_MANUTENCAO = formSeguimento("psm_manutencao", "12", "Entrevista de manutenção do psicomotricista", "Manutenção");

const PSM_ALTA = def(
  "psm_relatorio_alta",
  "13",
  "Relatório de alta do psicomotricista",
  "Relatório de alta",
  "Registro do profissional sobre o encerramento da terapia. A decisão de alta do caso continua com o médico.",
  [
    sec("alta", "Relatório", [
      data("data_entrevista", "Data da entrevista"),
      data("data_inicio", "Data de início"),
      t("sessoes_realizadas", "Número de sessões realizadas"),
      data("data_alta_terapia", "Data de alta da terapia"),
      tl("condicao_atual", "Condição atual (descrição do profissional, sem percentual)"),
      ue("tipo_alta", "Tipo de alta", [
        o("psicomotricista", "Alta pela psicomotricista"),
        o("transferencia", "Alta por transferência"),
        o("educador_fisico", "Alta pelo educador físico"),
        o("pedido", "Alta a pedido (interrupção discutida)"),
        o("abandono", "Abandono (mais de duas faltas sem justificativa)"),
      ]),
      tl("recomendacoes", "Recomendações"),
    ]),
  ],
  ["NAO IMPLEMENTAR ATE VALIDACAO: a 'melhora' do PDF aparece em 0%, 25%, 50%, 75% e 100%. Até a Dra. definir opções sem peso numérico, é texto livre."]
);

const PSM_SUMARIO = def(
  "psm_sumario",
  "14",
  "Sumário da avaliação e intervenção do psicomotricista",
  "Sumário",
  "Sumário que o médico poderá ler quando você concluir.",
  [
    sec("sumario", "Sumário", [
      data("data_inicio_nucleo", "Data de início no núcleo"),
      tl("hipotese", "Hipótese diagnóstica (texto do psicomotricista)"),
      m("conduta", "Conduta", [
        o("tonicidade", "Tonicidade"),
        o("equilibracao", "Equilibração"),
        o("lateralizacao", "Lateralização"),
        o("noco_corpo", "Noção do corpo"),
        o("espaco_temporal", "Estruturação espaço-temporal"),
        o("praxia_global", "Praxia global"),
        o("praxia_fina", "Praxia fina"),
      ]),
      tl("recomendacao_1", "Recomendações à escola — 1"),
      opc(tl("recomendacao_2", "Recomendações à escola — 2")),
      opc(tl("recomendacao_3", "Recomendações à escola — 3")),
      opc(tl("recomendacao_outra", "Recomendações à escola — outra")),
    ]),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SERVIÇO SOCIAL
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const ESCOLARIDADE_RESP: ReOpcao[] = [o("analfabeto", "Analfabeto(a)"), o("grau_1", "1º grau"), o("grau_2", "2º grau")];
const QUANT_0_4: ReOpcao[] = [o("0", "Não tem"), o("1", "1"), o("2", "2"), o("3", "3"), o("4_mais", "4 ou mais")];

const AS_CADASTRO_QUEIXA = def(
  "as_cadastro_queixa",
  "A–B",
  "Cadastro e queixa",
  "Cadastro e queixa",
  "Não registre nome da mãe nem endereço. Esses dados ficam fora do prontuário (LGPD).",
  [
    sec("cadastro", "A. Cadastro", [
      m("passa_dia", "Quem passa a maior parte do dia com a criança?", [
        o("mae", "Mãe"),
        o("pai", "Pai"),
        o("avo_materna", "Avó materna"),
        o("avo_paterna", "Avó paterna"),
        o("outro", "Outro familiar"),
      ]),
      t("quem_comparece", "Quem comparece à entrevista? (só o parentesco, sem nome)"),
      ue("documentos_basicos", "Tem os documentos básicos (RG, CPF, título de eleitor)?", [o("sim", "Sim"), o("nao", "Não", "Qual o motivo?")]),
    ]),
    sec("queixa", "B. Queixa", [
      ns("queixa", "Queixa", [
        ["sabe_nucleo", "Sabe o que é o Núcleo"],
        ["sabe_o_que_crianca_faz", "Sabe o que sua criança faz aqui"],
        ["sabe_por_que_convidado", "Sabe por que foi convidado(a) a comparecer para esta entrevista (se sim, por quê?)"],
        ["outra_necessidade_crianca", "Além do tratamento aqui, vê algo mais que precisa ser feito para a criança (qual?)"],
        ["necessidade_familiar", "Gostaria que uma necessidade familiar fosse suprida (qual?)"],
      ]),
    ]),
  ]
);

const AS_GENOGRAMA = def(
  "as_genograma_social",
  "C",
  "Genograma social",
  "Genograma social",
  "Desenhe a família por parentesco. Anotações curtas, sem nomes.",
  [
    sec("genograma", "C. Genograma social", [
      { key: "genograma_estrutura", label: "Genograma", tipo: "genograma", opcional: true },
      opc(tl("genograma_texto", "Descrição do genograma (parentes que o desenho não cobre)")),
    ]),
  ],
  ["O genograma social usa o mesmo editor por parentesco do genograma médico (sem nomes). Padrasto, madrasta e meio-irmãos ficam na descrição."]
);

const AS_ESCOLARIDADE_SAUDE = def(
  "as_escolaridade_saude",
  "D–E",
  "Escolaridade, comportamento, saúde e tratamento",
  "Escolaridade e saúde",
  "Preencha com o responsável. Use a observação para o complemento.",
  [
    sec("escolaridade", "D. Escolaridade", [
      ue("escolaridade_mae", "Escolaridade da mãe", ESCOLARIDADE_RESP),
      ue("escolaridade_pai", "Escolaridade do pai", ESCOLARIDADE_RESP),
      t("idade_responsavel_escola", "Com que idade o responsável entrou na escola?"),
      t("idade_crianca_escola", "E a criança, entrou com qual idade?"),
      ns("escolaridade", "Escolaridade da criança", [
        ["mudanca_escola", "Houve mudança de escola (por quê?)"],
        ["adaptou", "Adaptou-se bem"],
        ["gosta_escola", "Gosta de ir à escola"],
        ["vinculo_professor", "Tem bom vínculo com o professor"],
        ["vinculo_colegas", "Tem bom vínculo com os colegas"],
        ["horario_estudo", "Tem horário certo para estudar em casa"],
      ]),
    ]),
    sec("saude", "E. Comportamento, saúde e tratamento", [
      ns("saude", "Saúde e comportamento", [
        ["boa_saude", "Tem boa saúde"],
        ["avaliacoes_psf", "Frequenta as avaliações necessárias com o médico do PSF"],
        ["doenca_cronica", "Tem alguma doença crônica (todo mês)"],
        ["trata", "Se sim, trata"],
        ["dorme_bem", "Dorme bem"],
        ["alimenta_bem", "Alimenta-se bem"],
        ["brinca", "Brinca com suas crianças"],
        ["dieta_saudavel", "A dieta é saudável (se não, qual o motivo?)"],
        ["refrigerante", "Toma refrigerante com frequência (se sim, quem mais?)"],
        ["internado", "Já foi internado (se sim, quantas vezes?)"],
      ]),
      mx("relacao_comunidade", "Relações e legalidade", [["boa_relacao", "Tem boa relação com familiares e vizinhos"], ["cumpre_leis", "Cumpre as leis"]], NS_NA),
      t("horas_celular", "Quantas horas por dia fica no celular?"),
      m("periodo_celular", "Período do dia de uso do celular", [o("manha", "Manhã"), o("tarde", "Tarde"), o("noite", "Noite")]),
    ]),
  ]
);

const AS_ECONOMICA_MORADIA = def(
  "as_economica_moradia",
  "F–G",
  "Avaliação econômica e moradia",
  "Economia e moradia",
  "Registre só as quantidades e respostas. O sistema não soma pontos nem define classe econômica.",
  [
    sec("itens", "F. Itens do domicílio (Critério Brasil)", [
      mx(
        "itens_domicilio",
        "No seu domicílio tem? (quantidade de cada item)",
        [
          ["automoveis", "Automóveis de passeio, exclusivamente para uso particular"],
          ["maquinas_lavar_roupa", "Máquinas de lavar roupa, excluindo tanquinho"],
          ["banheiros", "Banheiros"],
          ["dvd", "DVD, incluindo qualquer dispositivo que leia DVD (exceto DVD de automóvel)"],
          ["geladeiras", "Geladeiras"],
          ["freezers", "Freezers independentes ou parte da geladeira duplex"],
          ["microcomputadores", "Microcomputadores (mesa, laptops, notebooks e netbooks; sem tablets, palms ou smartphones)"],
          ["lava_loucas", "Lavadora de louças"],
          ["micro_ondas", "Fornos de micro-ondas"],
          ["motocicletas", "Motocicletas (exceto as de uso exclusivamente profissional)"],
          ["secadoras", "Máquinas secadoras de roupas (inclui lava e seca)"],
          ["mensalistas", "Trabalhadores mensalistas (pelo menos cinco dias por semana)"],
        ],
        QUANT_0_4
      ),
    ]),
    sec("moradia", "G. Moradia", [
      ue("agua", "A água utilizada neste domicílio é proveniente de", [o("rede_geral", "Rede geral de distribuição"), o("poco_nascente", "Poço ou nascente"), o("outro", "Outro meio")]),
      ue("rua", "O trecho da rua do domicílio é", [o("asfaltada", "Asfaltada/pavimentada"), o("terra", "Terra/cascalho")]),
      t("membros_familia", "Quantos membros da família moram no mesmo local?"),
      ns("moradia", "Moradia e trabalho", [
        ["refeicao_juntos", "Fazem pelo menos uma refeição todos juntos"],
        ["moradia_propria", "A moradia é própria (se não, relação: alugada, doada, invadida, outra)"],
        ["vinculo_registro", "O vínculo empregatício é com registro"],
        ["programa_social", "Participam de programa social da prefeitura (qual?)"],
        ["beneficio_prefeitura", "Recebem benefício da prefeitura (qual?)"],
        ["outro_beneficio", "Outro benefício (qual?)"],
      ]),
      ue("trabalham", "Quantos trabalham no domicílio?", [o("1", "1"), o("2_mais", "2 ou mais"), o("todos", "Todos")]),
      t("renda_familiar", "Renda familiar total (valor informado)"),
    ]),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO: o PDF traz a pontuação por quantidade, a tabela 'cortes do Critério Brasil' (classes A a DE) e a estimativa de renda média por estrato. O sistema NÃO guarda esses pontos, NÃO soma e NÃO mostra classe: só a quantidade de cada item. Confirmar com a Dra. se a classe será calculada e por quem (ABEP, atualização anual).",
    "Renda familiar total é dado sensível: visível só ao assistente social e ao médico (ver matriz de acesso).",
  ]
);

const AS_CONDUTA = def(
  "as_conduta",
  "I",
  "Conduta do serviço social",
  "Conduta",
  "Descreva as áreas e as condutas. O sistema não indica conduta.",
  [
    sec("conduta", "I. Conduta", [
      tl("area_1", "Área 1 e conduta"),
      opc(tl("area_2", "Área 2 e conduta")),
      opc(tl("area_3", "Área 3 e conduta")),
      opc(tl("area_4", "Área 4 e conduta")),
      opc(tl("area_5", "Área 5 e conduta")),
    ]),
  ]
);

/** J (2ª entrevista) e L (domicílio) têm o mesmo quadro de diagnóstico social e evolução. */
function formEntrevistaSocial(id: string, letra: string, titulo: string, curto: string): FormDef {
  return def(id, letra, titulo, curto, "Marque o diagnóstico social (normal ou alterado) e a evolução. Em 'alterado', escreva qual na observação.", [
    sec("diagnostico", "Diagnóstico social", [
      mx(
        "diagnostico_social",
        "0 = normal · 1 = alterado (qual?)",
        [
          ["sistema_estavel", "A criança e seu sistema estão estáveis"],
          ["percepcao_problema", "Familiar tem percepção do problema"],
          ["escolaridade", "Acesso à escolaridade"],
          ["saude", "Acesso à saúde (tratamento, medicamento etc.)"],
          ["renda", "Renda"],
          ["moradia", "Moradia"],
          ["programas", "Acesso aos programas públicos"],
          ["beneficios", "Acesso aos benefícios garantidos por lei"],
        ],
        NORMAL_ALT,
        { comObs: true }
      ),
    ]),
    sec("evolucao", "Evolução", [tl("evolucao", "Observação"), tl("conduta", "Conduta")]),
  ]);
}
const AS_SEGUNDA = formEntrevistaSocial("as_segunda_entrevista", "J", "Segunda entrevista social", "2ª entrevista");
const AS_DOMICILIO = formEntrevistaSocial("as_entrevista_domicilio", "L", "Entrevista social no domicílio", "Entrevista no domicílio");

const AS_CBCL_ASQ = def(
  "as_cbcl_asq",
  "CBCL/ASQ",
  "CBCL e ASQ — resultados",
  "CBCL e ASQ",
  "Instrumentos externos. Registre só a data e o resultado do protocolo; o sistema não reproduz os itens nem interpreta.",
  [
    sec("cbcl", "CBCL (dados sociodemográficos e inventário)", [
      data("data_aplicacao", "Data da aplicação"),
      t("resultado_informado", "Resultado informado no protocolo (total)"),
      tl("anotacao", "Anotações do profissional"),
    ]),
    sec("asq", "ASQ — Questionário de comunicação social (40 itens)", [
      data("asq_data_aplicacao", "Data da aplicação"),
      t("asq_total", "Total informado no protocolo"),
      tl("asq_anotacao", "Anotações do profissional"),
    ]),
  ],
  [
    "NAO IMPLEMENTAR ATE VALIDACAO: itens e licença do CBCL (ASEBA) e do ASQ. Os dados sociodemográficos do CBCL pedem nome, endereço, telefone e e-mail do responsável: omitidos de propósito (LGPD). Os 113 itens do CBCL e os 40 do ASQ não foram digitalizados e o sistema não soma pontos.",
  ]
);

const AS_SUMARIO = def(
  "as_sumario",
  "P",
  "Sumário da avaliação do assistente social",
  "Sumário",
  "Sumário que o médico poderá ler quando você concluir.",
  [
    sec("sumario", "Sumário", [
      tl("queixa_professor", "Queixa do professor"),
      tl("hipotese_espectro", "Hipótese diagnóstica do espectro (texto do profissional)"),
      m("dificuldades", "Dificuldades persistentes", [
        o("motora_basica", "Motora básica"),
        o("fala", "Fala"),
        o("compreensao", "Compreensão"),
        o("aprendizagem", "Aprendizagem"),
        o("linguagem", "Linguagem"),
        o("cognitiva", "Cognitiva"),
        o("comunicacao_social", "Comunicação social"),
        o("genetica", "Genética"),
        o("familiar", "Familiar"),
        o("outra", "Outra"),
      ], "Qual?"),
      ue("conduta_tem", "Conduta", NS),
      tl("conduta_qual", "Qual?"),
      t("conduta_tempo", "Por quanto tempo?"),
      tl("resultado", "Resultado"),
      data("data_encaminhado_nemt", "Encaminhado ao núcleo em"),
    ]),
  ],
  ["'Hipótese diagnóstica do espectro' é texto do assistente social. Confirmar com a Dra. se este campo deve existir no serviço social ou ficar só com o médico."]
);

const AS_ENCAMINHAMENTO = def(
  "as_encaminhamento",
  "Q",
  "Encaminhamento do serviço social",
  "Encaminhamento",
  "Marque os encaminhamentos feitos pelo assistente social. A decisão clínica continua com o médico.",
  [
    sec("encaminhamento", "Encaminhamento", [
      tl("queixa_professor", "Queixa do professor"),
      tl("diagnostico", "Diagnóstico (texto do profissional)"),
      m("dificuldades", "Dificuldades persistentes", [
        o("motora_basica", "Motora básica"),
        o("fala", "Fala"),
        o("compreensao", "Compreensão"),
        o("aprendizagem", "Aprendizagem"),
        o("linguagem", "Linguagem"),
        o("cognitiva", "Cognitiva"),
        o("comunicacao_social", "Comunicação social"),
        o("genetica", "Genética"),
        o("familiar", "Familiar"),
        o("outra", "Outra"),
      ], "Qual?"),
      ns(
        "encaminhamentos",
        "Encaminhamentos",
        [
          ["re_mantera", "RE manterá o acompanhamento na escola"],
          ["avaliacao_neuropsicologica", "Avaliação neuropsicológica"],
          ["avaliacao_psicomotora", "Avaliação e intervenção psicomotora"],
          ["avaliacao_fono", "Avaliação e intervenção fonoaudiológica"],
          ["avaliacao_psicopedagogica", "Avaliação e intervenção psicopedagógica"],
          ["psicoterapia", "Psicoterapia"],
          ["avaliacao_social_cras", "Avaliação social no CRAS"],
          ["familiares_caps", "Familiares no CAPS"],
          ["outro_externo", "Outro profissional externo (qual?)"],
          ["conselho_tutelar", "Conselho Tutelar foi comunicado"],
          ["pronto_atendimento", "Foi ao Pronto Atendimento"],
        ],
        true
      ),
      data("data_retorno", "Retorno para avaliação em"),
    ]),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Índice
// ═══════════════════════════════════════════════════════════════════════════════════════════════

export const ESPECIALIDADE_FORMS: Record<EspecialidadeId, FormDef[]> = {
  fonoaudiologia: [FONO_ANAMNESE, FONO_AUDICAO, FONO_LINGUAGEM_ORAL, FONO_LINGUAGEM_ESCRITA, FONO_FALA, FONO_SINTESE, FONO_SRS2, FONO_PLANO],
  psicopedagogia: [PPC_ANAMNESE, PPC_EOCA, PPC_AVALIACAO, PPC_PIAGET, PPC_CONCLUSAO, PPC_PLANO],
  psicologia: [PSI_ENTREVISTA, PSI_MASC, PSI_SEGUIMENTO, PSI_SCARED, PSI_TAC_SUMARIO, PSI_TAC_ALTA, PSI_GRUPO_INICIAL, PSI_GRUPO_SUMARIO, PSI_GRUPO_FINAL],
  neuropsicologia: [PSI_ENTREVISTA, PSI_MASC, ANP_RESULTADO, ANP_SUMARIO],
  psicomotricidade: [PSM_AVALIACAO_1, PSM_AVALIACAO_2, PSM_AVALIACAO_3, PSM_PLANO, PSM_SEGUIMENTO, PSM_MANUTENCAO, PSM_ALTA, PSM_SUMARIO],
  servico_social: [AS_CADASTRO_QUEIXA, AS_GENOGRAMA, AS_ESCOLARIDADE_SAUDE, AS_ECONOMICA_MORADIA, AS_CONDUTA, AS_SEGUNDA, AS_DOMICILIO, AS_CBCL_ASQ, AS_SUMARIO, AS_ENCAMINHAMENTO],
};

/** Formulário de cada especialidade que o médico lê como "sumário executivo" quando concluído. */
export const ESPECIALIDADE_SUMARIO_FORM: Partial<Record<EspecialidadeId, string>> = {
  psicomotricidade: "psm_sumario",
  servico_social: "as_sumario",
  neuropsicologia: "anp_sumario",
};

export function formsDaEspecialidade(especialidade: EspecialidadeId): FormDef[] {
  return ESPECIALIDADE_FORMS[especialidade];
}

export function formDaEspecialidade(especialidade: string, formId: string): FormDef | null {
  if (!isEspecialidadeId(especialidade)) return null;
  return ESPECIALIDADE_FORMS[especialidade].find((f) => f.id === formId) ?? null;
}

export const ESP_FORM_ID_MAX = 40;
