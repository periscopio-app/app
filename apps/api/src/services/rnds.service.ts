/**
 * Serviço de Integração com o Protocolo RNDS (Rede Nacional de Dados em Saúde)
 * Padrão: HL7 FHIR R4 — Registro de Atendimento Clínico e Encaminhamento (REL)
 * Guia Oficial: https://rnds-guia.saude.gov.br/docs/rel/objetivo-rel
 */

export interface RelInput {
  caseId: string;
  patient: {
    nome?: string;
    cpf?: string;
    cns?: string; // Cartão Nacional de Saúde (15 dígitos)
    dataNascimento?: string; // YYYY-MM-DD
    sexo?: "M" | "F" | "O";
    municipioIbge?: string; // Código IBGE ex: "3553957"
  };
  practitioner: {
    nome: string;
    cns?: string;
    cpf?: string;
    cbo: string; // ex: "225125" (Médico clínico), "251510" (Psicólogo clínico), "223810" (Fonoaudiólogo)
    conselho?: {
      tipo: "CRM" | "CRP" | "CRFa" | "CREFITO" | "CRESS";
      numero: string;
      uf: string;
    };
  };
  organization: {
    nome: string;
    cnes?: string; // Código CNES do estabelecimento (7 dígitos)
    cnpj?: string;
    municipioIbge?: string;
  };
  encounter: {
    dataInicio: string; // ISO 8601
    dataFim?: string;
    modalidade: "presencial" | "teleatendimento" | "domiciliar" | "escolar";
    motivoConsulta: string;
  };
  clinicalFindings: {
    cid10?: string; // ex: "F90.0" (TDAH), "F84.0" (Autismo infantil)
    descricaoQueixa: string;
    hipoteseDiagnostica?: string;
    evolucaoClinica?: string;
  };
  referral?: {
    destinoTipo: "UBS" | "CAPS_IJ" | "CAPS_AJ" | "CRAS" | "CREAS" | "ESPECIALIDADE_HOSPITALAR";
    cnesDestino?: string;
    nomeDestino?: string;
    prioridade: "rotina" | "urgente" | "prioritario";
    justificativaClinica: string;
    prazoAcolhimentoDias?: number; // Padrão legal: até 90 dias
  };
}

export interface FhirResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

export interface FhirBundle {
  resourceType: "Bundle";
  id: string;
  meta: {
    lastUpdated: string;
    profile: string[];
  };
  identifier?: {
    system: string;
    value: string;
  };
  type: "document";
  timestamp: string;
  entry: Array<{
    fullUrl: string;
    resource: FhirResource;
  }>;
}

/**
 * Mapeamento de CBOs de referência para a equipe multiprofissional Periscópio
 */
export const CBO_REFERENCE: Record<string, { titulo: string; area: string }> = {
  "225125": { titulo: "Médico clínico", area: "Medicina" },
  "225133": { titulo: "Médico psiquiatra", area: "Medicina" },
  "225124": { titulo: "Médico pediatra", area: "Medicina" },
  "251510": { titulo: "Psicólogo clínico", area: "Psicologia" },
  "251545": { titulo: "Neuropsicólogo", area: "Neuropsicologia" },
  "223810": { titulo: "Fonoaudiólogo", area: "Fonoaudiologia" },
  "239425": { titulo: "Psicopedagogo", area: "Psicopedagogia" },
  "223905": { titulo: "Terapeuta ocupacional", area: "Terapia Ocupacional" },
  "251605": { titulo: "Assistente social", area: "Serviço Social" },
};

/**
 * Gera um Bundle FHIR R4 em total conformidade com o modelo REL (Registro Eletrônico em Saúde) da RNDS
 */
export function generateRelBundle(input: RelInput): FhirBundle {
  const timestamp = new Date().toISOString();
  const bundleId = `rnds-bundle-${input.caseId}-${Date.now()}`;
  const compositionId = `comp-${input.caseId}`;
  const patientId = `patient-${input.caseId}`;
  const practitionerId = `practitioner-${input.practitioner.cns || input.practitioner.cpf || "01"}`;
  const organizationId = `org-${input.organization.cnes || "escola-taruma"}`;
  const encounterId = `enc-${input.caseId}`;
  const conditionId = `cond-${input.caseId}`;
  const serviceRequestId = input.referral ? `req-${input.caseId}` : undefined;

  const entries: Array<{ fullUrl: string; resource: FhirResource }> = [];

  // 1. Composition (Documento Clínico REL)
  const composition: FhirResource = {
    resourceType: "Composition",
    id: compositionId,
    meta: {
      profile: [
        "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRRegistroAtendimentoClinico-1.0",
      ],
    },
    status: "final",
    type: {
      coding: [
        {
          system: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRTipoDocumento",
          code: "REL",
          display: "Registro Eletrônico de Atendimento Clínico e Encaminhamento",
        },
      ],
    },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    date: timestamp,
    author: [{ reference: `Practitioner/${practitionerId}` }],
    title: "Registro de Atendimento e Encaminhamento Intersetorial",
    custodian: { reference: `Organization/${organizationId}` },
    section: [
      {
        title: "Motivo e Evolução Clínica",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "34117-2",
              display: "History and Physical note",
            },
          ],
        },
        text: {
          status: "generated",
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${input.clinicalFindings.descricaoQueixa}</p></div>`,
        },
        entry: [{ reference: `Condition/${conditionId}` }],
      },
    ],
  };

  if (serviceRequestId) {
    composition.section.push({
      title: "Encaminhamento Intersetorial (Rede de Cuidados)",
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "57134-9",
            display: "Referral note",
          },
        ],
      },
      text: {
        status: "generated",
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>Encaminhado para ${input.referral?.destinoTipo}. Prazo máximo legal de acolhimento: ${input.referral?.prazoAcolhimentoDias || 90} dias.</p></div>`,
      },
      entry: [{ reference: `ServiceRequest/${serviceRequestId}` }],
    });
  }

  entries.push({ fullUrl: `urn:uuid:${compositionId}`, resource: composition });

  // 2. Patient
  const patient: FhirResource = {
    resourceType: "Patient",
    id: patientId,
    meta: {
      profile: ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRIndividuo-1.0"],
    },
    identifier: [],
  };

  if (input.patient.cns) {
    patient.identifier.push({
      system: "http://saude.gov.br/fhir/sid/cns",
      value: input.patient.cns,
    });
  }
  if (input.patient.cpf) {
    patient.identifier.push({
      system: "http://saude.gov.br/fhir/sid/cpf",
      value: input.patient.cpf,
    });
  }
  if (input.patient.nome) {
    patient.name = [{ text: input.patient.nome }];
  }
  if (input.patient.dataNascimento) {
    patient.birthDate = input.patient.dataNascimento;
  }
  if (input.patient.sexo) {
    patient.gender = input.patient.sexo === "M" ? "male" : input.patient.sexo === "F" ? "female" : "other";
  }
  entries.push({ fullUrl: `urn:uuid:${patientId}`, resource: patient });

  // 3. Practitioner
  const practitioner: FhirResource = {
    resourceType: "Practitioner",
    id: practitionerId,
    meta: {
      profile: ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRProfissional-1.0"],
    },
    name: [{ text: input.practitioner.nome }],
    identifier: [],
    qualification: [
      {
        code: {
          coding: [
            {
              system: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRCBO",
              code: input.practitioner.cbo,
              display: CBO_REFERENCE[input.practitioner.cbo]?.titulo || "Profissional de Saúde",
            },
          ],
        },
      },
    ],
  };

  if (input.practitioner.cns) {
    practitioner.identifier.push({
      system: "http://saude.gov.br/fhir/sid/cns",
      value: input.practitioner.cns,
    });
  }
  if (input.practitioner.conselho) {
    practitioner.identifier.push({
      system: `http://saude.gov.br/fhir/sid/${input.practitioner.conselho.tipo.toLowerCase()}`,
      value: `${input.practitioner.conselho.numero}/${input.practitioner.conselho.uf}`,
    });
  }
  entries.push({ fullUrl: `urn:uuid:${practitionerId}`, resource: practitioner });

  // 4. Organization
  const organization: FhirResource = {
    resourceType: "Organization",
    id: organizationId,
    meta: {
      profile: ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BREstabelecimentoSaude-1.0"],
    },
    name: input.organization.nome,
    identifier: [],
  };
  if (input.organization.cnes) {
    organization.identifier.push({
      system: "http://saude.gov.br/fhir/sid/cnes",
      value: input.organization.cnes,
    });
  }
  entries.push({ fullUrl: `urn:uuid:${organizationId}`, resource: organization });

  // 5. Encounter
  const encounter: FhirResource = {
    resourceType: "Encounter",
    id: encounterId,
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "Ambulatorial",
    },
    subject: { reference: `Patient/${patientId}` },
    period: {
      start: input.encounter.dataInicio,
      end: input.encounter.dataFim || input.encounter.dataInicio,
    },
    reasonCode: [
      {
        text: input.encounter.motivoConsulta,
      },
    ],
  };
  entries.push({ fullUrl: `urn:uuid:${encounterId}`, resource: encounter });

  // 6. Condition (Diagnóstico / Hipótese / Queixa)
  const condition: FhirResource = {
    resourceType: "Condition",
    id: conditionId,
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: input.clinicalFindings.cid10 ? "confirmed" : "provisional",
        },
      ],
    },
    code: {
      text: input.clinicalFindings.hipoteseDiagnostica || input.clinicalFindings.descricaoQueixa,
      coding: input.clinicalFindings.cid10
        ? [
            {
              system: "http://hl7.org/fhir/sid/icd-10",
              code: input.clinicalFindings.cid10,
              display: input.clinicalFindings.hipoteseDiagnostica || "Diagnóstico Clínico",
            },
          ]
        : [],
    },
    subject: { reference: `Patient/${patientId}` },
  };
  entries.push({ fullUrl: `urn:uuid:${conditionId}`, resource: condition });

  // 7. ServiceRequest (Encaminhamento para CRAS / CAPS / UBS se houver)
  if (input.referral && serviceRequestId) {
    const serviceRequest: FhirResource = {
      resourceType: "ServiceRequest",
      id: serviceRequestId,
      status: "active",
      intent: "order",
      priority:
        input.referral.prioridade === "urgente"
          ? "urgent"
          : input.referral.prioridade === "prioritario"
          ? "asap"
          : "routine",
      code: {
        text: `Encaminhamento intersetorial para ${input.referral.destinoTipo}`,
        coding: [
          {
            system: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRTipoEncaminhamento",
            code: input.referral.destinoTipo,
            display: `Rede de Atenção: ${input.referral.destinoTipo}`,
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      requester: { reference: `Practitioner/${practitionerId}` },
      reasonCode: [{ text: input.referral.justificativaClinica }],
      note: [
        {
          text: `Marco Legal de Acolhimento e Proteção à Criança: prazo máximo de resposta/reavaliação em ${
            input.referral.prazoAcolhimentoDias || 90
          } dias (Lei nº 13.509 / ECA art. 19 § 2º).`,
        },
      ],
    };
    entries.push({ fullUrl: `urn:uuid:${serviceRequestId}`, resource: serviceRequest });
  }

  return {
    resourceType: "Bundle",
    id: bundleId,
    meta: {
      lastUpdated: timestamp,
      profile: ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRDocumentoREL-1.0"],
    },
    type: "document",
    timestamp,
    entry: entries,
  };
}

/**
 * Validação prévia de conformidade com os requisitos da RNDS
 */
export function validateRndsPayload(input: Partial<RelInput>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.caseId) errors.push("Identificador do caso (caseId) é obrigatório.");
  if (!input.practitioner?.nome) errors.push("Nome do profissional responsável é obrigatório.");
  if (!input.practitioner?.cbo) {
    errors.push("CBO (Classificação Brasileira de Ocupações) do profissional é obrigatório para integração RNDS.");
  } else if (!CBO_REFERENCE[input.practitioner.cbo]) {
    warnings.push(`CBO ${input.practitioner.cbo} não consta na lista prioritária da equipe multiprofissional.`);
  }

  if (!input.practitioner?.cns && !input.practitioner?.cpf) {
    warnings.push("RNDS exige CNS ou CPF do profissional autor para envio oficial em produção.");
  }

  if (!input.patient?.cns && !input.patient?.cpf) {
    warnings.push("Identificação nacional do paciente (CNS ou CPF) recomendada para vinculação no Cartão SUS.");
  }

  if (!input.organization?.nome) errors.push("Nome do estabelecimento solicitante é obrigatório.");
  if (!input.organization?.cnes) {
    warnings.push("CNES não informado. O estabelecimento deverá cadastrar CNES para envio oficial ao Ministério da Saúde.");
  }

  if (!input.encounter?.motivoConsulta) errors.push("Motivo da consulta/atendimento é obrigatório.");

  if (input.referral) {
    if (!input.referral.justificativaClinica) {
      errors.push("Justificativa clínica do encaminhamento é obrigatória.");
    }
    const prazo = input.referral.prazoAcolhimentoDias ?? 90;
    if (prazo > 90) {
      warnings.push("Prazo de acolhimento excede os 90 dias previstos no ECA art. 19 § 2º / Lei 13.509.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
