import { specialtyOf } from "../security/capabilities";

/**
 * Regra de designação: cada vaga do médico (especialidade) só aceita profissional DAQUELA especialidade.
 * Evita a seção de psicologia cair na conta da psicopedagogia e some da tela de quem deveria atendê-la.
 * A especialidade vem do cadastro do profissional (`users.specialty`) ou, na falta dela, do perfil (ex.: "psicologa").
 * Não é critério clínico: é só o encaminhamento do médico chegar à pessoa certa.
 */
export function especialidadeDoProfissional(p: { role: string; specialty?: string | null }): string | null {
  return specialtyOf(p.role, p.specialty);
}

export function profissionalServeVaga(p: { role: string; specialty?: string | null }, vaga: string): boolean {
  return especialidadeDoProfissional(p) === vaga;
}

const NOME_VAGA: Record<string, string> = {
  fonoaudiologia: "fonoaudiologia",
  medicina: "medicina",
  neuropsicologia: "neuropsicologia",
  psicologia: "psicologia",
  psicopedagogia: "psicopedagogia",
  psicomotricidade: "psicomotricidade",
  servico_social: "serviço social",
};

/** Mensagem para o médico, sem dado pessoal. */
export function mensagemVagaErrada(vaga: string, p: { role: string; specialty?: string | null }): string {
  const nome = NOME_VAGA[vaga] ?? vaga;
  return especialidadeDoProfissional(p)
    ? `Esta vaga é de ${nome}. Escolha um profissional de ${nome}.`
    : `Este profissional está sem especialidade no cadastro. Escolha um profissional de ${nome}.`;
}

/** Fila do especialista: ordem de chegada (quem foi designado primeiro vem primeiro). Concluídas ficam no fim. Sem prioridade clínica. */
export function ordenarFila<T extends { status: string; delegatedAt: Date | string }>(secoes: T[]): (T & { posicao: number | null })[] {
  const aberta = (s: T) => s.status !== "concluido";
  const tempo = (s: T) => new Date(s.delegatedAt).getTime();
  const ordenadas = [...secoes].sort((a, b) => Number(!aberta(a)) - Number(!aberta(b)) || tempo(a) - tempo(b));
  let n = 0;
  return ordenadas.map((s) => ({ ...s, posicao: aberta(s) ? ++n : null }));
}
