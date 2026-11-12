/**
 * Remetente único de todos os e-mails da plataforma.
 * O domínio projetoperiscopio.com.br é o verificado no Resend; qualquer outro remetente é recusado por lá
 * (era o caso do padrão antigo de email/index.ts, periscopiosaude.com.br). Em produção, defina RESEND_FROM_EMAIL
 * só se mudar de domínio.
 */
export const DEFAULT_FROM = "Periscópio <equipe@projetoperiscopio.com.br>";

export function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
}
