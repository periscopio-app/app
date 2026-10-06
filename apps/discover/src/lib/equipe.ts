import lucieneSm from "@/assets/luciene-stivanin-sm.webp";
import iveteSm from "@/assets/ivete-foto-sm.webp";
import priscilaAtualSm from "@/assets/ivete-gattas-sm.webp";
import priscilaAtual from "@/assets/ivete-gattas.webp";
import anaSm from "@/assets/ana-cecilia-sm.webp";
import lucieneFoto from "@/assets/luciene-stivanin.webp";
import iveteFoto from "@/assets/ivete-foto.webp";
import anaFoto from "@/assets/ana-cecilia.webp";
import priscilaFoto from "@/assets/priscila-previato.webp";
import patriciaFoto from "@/assets/patricia-salles.webp";
import brunoFoto from "@/assets/bruno-bisogni.webp";
import andreFoto from "@/assets/andre-almeida.webp";
import karinneFoto from "@/assets/karinne-lisboa.webp";
import karinneSm from "@/assets/karinne-lisboa-sm.webp";

export type Membro = { n: string; r: string; itens: string[]; lattes?: string; foto?: string; fotoSm?: string };
export const equipe: Membro[] = [
  {
    n: "Dra. Ana Cecilia Petta Roselli Marques",
    r: "Psiquiatra · Coordenadora e autora do Periscópio",
    itens: [
      "Médica (Faculdade de Medicina de Marília, 1982), CRM 50432",
      "Especialista em Saúde Pública e Saúde Mental (UNESP) e em Psiquiatria (ABP/AMB)",
      "Doutora em Neurociências pela UNIFESP (1997)",
      "Presidente da ABEAD em duas gestões (2003-2005 e 2013-2015)",
      "Supervisora do Periscópio em Tarumã de 2007 a 2025",
    ],
    lattes: "http://lattes.cnpq.br/9434727494935774",
    foto: anaFoto,
    fotoSm: anaSm,
  },
  {
    n: "Dra. Ivete Gianfaldoni Gattás",
    r: "Psiquiatra da Infância e Adolescência",
    itens: [
      "Médica pela Escola Paulista de Medicina (UNIFESP, 1983), CRM 48588",
      "Títulos de Psiquiatra e Psiquiatra da Infância e Adolescência (ABP)",
      "Pós-graduada em Psiquiatria Forense (NUFOR, IPQ-FMUSP)",
      "Ex-coordenadora da Unidade de Psiquiatria da Infância e Adolescência da UNIFESP",
      "Supervisora de residentes em Psiquiatria Infantil no CAISM Franco da Rocha",
    ],
    lattes: "http://lattes.cnpq.br/304218406032985",
    foto: iveteFoto,
    fotoSm: iveteSm,
  },
  {
    n: "Dra. Luciene Stivanin",
    r: "Fonoaudióloga",
    itens: [
      "Doutora em Ciências da Reabilitação (USP, 2007) e pós-doutora em Fonoaudiologia (USP, 2016)",
      "Especializações em Gestão Escolar (UNICID/UNESCO) e Gestão Pública (UNIFESP)",
      "Ex-professora da FMUSP, no Laboratório de Leitura e Escrita",
      "Idealizadora e diretora da ReEscreva, clínica especializada em aprendizagem",
      "Pesquisadora do Programa Equilíbrio (IPQ-HC-FMUSP) de 2007 a 2020",
    ],
    lattes: "https://lattes.cnpq.br/1495396312294574",
    foto: lucieneFoto,
    fotoSm: lucieneSm,
  },
  {
    n: "Dra. Priscila Previato",
    r: "Neuropsicóloga",
    itens: [
      "Graduada em Psicologia pela Universidade Estadual Paulista (2003).",
      "Especialização em Neuropsicologia pelo Departamento de Psicobiologia da UNIFESP-EPM.",
      "Mestrado e Doutorado no Departamento de Psiquiatria da UNIFESP-EPM, com pesquisa em neurociência e dependência química.",
      "Atua como psicóloga clínica, pesquisadora e neuropsicóloga.",
    ],
    lattes: "http://lattes.cnpq.br/3019630360911310",
    foto: priscilaAtual,
    fotoSm: priscilaAtualSm,
  },
  {
    n: "Karinne Lisboa",
    r: "Pedagoga · Psicopedagoga e Psicomotricista",
    itens: [
      "Graduada em Pedagogia pela Faculdade Polis das Artes.",
      "Pós-graduada em Psicopedagogia pelo UNASP, e em Educação Especial, Psicomotricidade e Análise do Comportamento Aplicada (ABA) pela Facuminas.",
      "Cursando o 6º semestre de Psicologia pelo UNASP e o 3º semestre de Terapia Ocupacional pela UniFECAF.",
      "Professora de Educação Infantil por 4 anos.",
      "Psicomotricista clínica no Instituto Jô Clemente por 2 anos, estimulando bebês, crianças e adolescentes com Síndrome de Down, deficiência intelectual, TEA, síndromes e doenças raras.",
    ],
    foto: karinneFoto,
    fotoSm: karinneSm,
  },
];

export const assistentes: { n: string; d: string[]; foto?: string; lattes?: string }[] = [
  {
    n: "Dra. Gabriela Sanches Falco",
    foto: priscilaFoto,
    d: [
      "Médica, CRM-SP nº 275415. Graduada em Medicina pela Faculdade Santa Marcelina (2019-2025).",
      "Em preparação para ingresso em programa de residência médica, com o objetivo de especialização em Psiquiatria.",
      "Assistente de pesquisa da Dra. Ana Cecília Petta Roselli Marques, médica psiquiatra, colabora em projetos relacionados à saúde mental, à prevenção e ao uso de álcool e outras drogas.",
    ],
  },
  {
    n: "Patrícia Azevedo Silva de Paula Salles",
    foto: patriciaFoto,
    d: [
      "Psicóloga, CRP 06/230829, graduada pela Universidade Paulista – UNIP (2025).",
      "Pós-graduanda em Dependência Química pelo Hospital Israelita Albert Einstein (2026–2027).",
      "Atua na clínica psicológica e direciona sua formação para a saúde mental, com especial interesse em dependência química, prevenção, avaliação e cuidado relacionado ao uso de substâncias.",
      "Assistente de pesquisa da Dra. Ana Cecília Petta Roselli Marques, colaborando em projetos de saúde mental, prevenção e uso de álcool e outras drogas.",
    ],
  },
];

export const tecnologia: { n: string; r: string; d: string[]; foto?: string; lattes?: string }[] = [
  {
    n: "Bruno de A. Bisogni",
    r: "Desenvolvedor Sênior · Tech Lead · Programador principal da Plataforma Periscópio",
    foto: brunoFoto,
    d: [
      "Engenheiro de software full stack, empreendedor e head de produtos digitais, com atuação na intersecção entre tecnologia, saúde e impacto social.",
      "No Periscópio, lidera a construção técnica da plataforma que integra escola, saúde, assistência social e família em tempo real. É responsável pela arquitetura, pela segurança dos dados e pelo motor de priorização que lê os resultados dos instrumentos de triagem (FOGAP, SNAP-IV, ABC) e organiza os encaminhamentos por gravidade.",
    ],
  },
  {
    n: "André Almeida",
    r: "Tecnologia da Informação · Ponte entre os experts e o Tech Lead",
    foto: andreFoto,
    d: [
      "Mestrando em Psiquiatria e Saúde Mental pela FCM/UNICAMP.",
      "Aluno PED — Programa de Estágio Docente da FCM/UNICAMP (Raciocínio Clínico III, Neurociência e Saúde Mental, Saúde Digital).",
      "Pesquisador em saúde digital aplicada ao tratamento de dependências.",
      "Associado à ABEAD — Associação Brasileira de Estudos do Álcool e Outras Drogas — e membro da ISUUP — Sociedade Internacional de Profissionais da Prevenção e Tratamento de Uso de Substâncias.",
      "Atualmente faz parte do time de Tecnologia da Informação, atuando como ponte entre as necessidades dos experts e o Tech Lead do sistema.",
    ],
    lattes: "http://lattes.cnpq.br/3782809465968232",
  },
];
