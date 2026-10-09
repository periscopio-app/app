/**
 * Visibilidade do especialista (Dra. Ana Cecília, 07/out/2026):
 * o especialista vê o FOGAP e o resumo final do médico e dos demais especialistas.
 *
 * Regras de minimização (LGPD):
 * - seções de outras especialidades só aparecem quando CONCLUÍDAS (rascunho de colega não vaza);
 * - serviço social é informação sensível: nunca aparece para outro especialista;
 * - aparece a especialidade, nunca o nome do profissional;
 * - a decisão final do médico só aparece depois do encerramento.
 */
export const SPECIALTIES_HIDDEN_FROM_PEERS = ["servico_social"] as const;

export interface PeerSectionInput {
  id: string;
  specialty: string;
  status: string;
  summary: unknown;
  completedAt: Date | null;
  assignedProfessionalId: string | null;
}

export interface PeerSectionView {
  specialty: string;
  summary: unknown;
  completedAt: Date | null;
}

export function filterPeerSections(sections: PeerSectionInput[], actorId: string): PeerSectionView[] {
  return sections
    .filter((s) => s.assignedProfessionalId !== actorId)
    .filter((s) => s.status === "concluido")
    .filter((s) => !(SPECIALTIES_HIDDEN_FROM_PEERS as readonly string[]).includes(s.specialty))
    .map((s) => ({ specialty: s.specialty, summary: s.summary, completedAt: s.completedAt }));
}

export function medicalFinalSummary(payload: unknown): { decision: string; followUp?: string; reason?: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.decision !== "string") return null;
  return {
    decision: p.decision,
    followUp: typeof p.followUp === "string" ? p.followUp : undefined,
    reason: typeof p.reason === "string" ? p.reason : undefined,
  };
}
