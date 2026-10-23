const BASE = "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (!res.ok) {
    // 400/409/422 trazem mensagem específica do servidor (ex.: validação, horário já reservado)
    let serverMsg: string | null = null;
    let serverBody: unknown;
    if (res.status === 400 || res.status === 409 || res.status === 422 || res.status === 429 || res.status === 503) {
      try {
        const data = (await res.clone().json()) as { error?: unknown };
        serverBody = data;
        if (typeof data.error === "string") serverMsg = data.error;
      } catch { /* sem corpo JSON */ }
    }
    const msg = serverMsg ?? (() => {
      switch (res.status) {
        case 401: return "Sessão expirada. Faça login novamente.";
        case 403: return "Seu perfil não possui permissão para esta ação.";
        case 404: return "Recurso não encontrado.";
        case 409: return "Conflito: a operação não pode ser concluída no estado atual.";
        case 413: return "O arquivo ou o texto enviado é grande demais.";
        case 429: return "Muitas tentativas seguidas. Aguarde um instante e tente de novo.";
        default:
          return res.status >= 500
            ? "Não foi possível concluir agora. Seus dados continuam salvos; tente de novo em instantes. Se repetir, avise o suporte."
            : "Não foi possível concluir esta ação. Confira os dados e tente de novo.";
      }
    })();
    throw new ApiError(res.status, msg, serverBody);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE", body: "{}" }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
};

// ─── tipos compartilhados ────────────────────────────────────────────────────

export type JourneyState =
  | "rascunho"
  | "enviado_re"
  | "revisao_medica"
  | "delegado"
  | "retornado"
  | "encerrado";

export interface Me {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  schoolId: string | null;
  /** Link público da foto de perfil (null = sem foto). */
  avatarUrl?: string | null;
  /** Conselho de classe (CRM, CRP…), para o hero do painel. */
  classCode?: string | null;
  /** Especialidade do núcleo, quando houver. */
  specialty?: string | null;
  /** Minibiografia curta exibida no hero (editável em "Meu painel"). */
  bio?: string | null;
  /** Escola vinculada, quando houver. */
  schoolName?: string | null;
}

export interface CaseItem {
  id: string;
  journeyState: JourneyState;
  status: string;
  createdAt: string;
  updatedAt: string;
  studentId?: string;
  studentCode: string;
  birthYear: number | null;
  birthMonth: number | null; // 1–12
  grade?: string | null;
  schoolName?: string | null;
  assignedToName?: string | null;
  assignedToRole?: string | null;
  /** Nome curto ("João S.") só quando o servidor libera para a equipe do caso; senão não vem. */
  studentLabel?: string | null;
}


export interface ReAssessment {
  id: string;
  caseId: string;
  formCode: string;
  formVersion: string;
  status: "rascunho" | "enviado" | "devolvido";
  payload: Record<string, unknown>;
  createdAt: string;
  submittedAt: string | null;
}

export interface CaseSection {
  id: string;
  specialty: string;
  status: string;
  summary: Record<string, unknown> | null;
  notes: string | null;
  completedAt: string | null;
  professionalName: string | null;
  professionalRole: string | null;
  professionalClassCode: string | null;
}

export interface TimelineEvent {
  id: string;
  event: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
  actorRole: string | null;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  role: string;
  classCode: string | null;
}

export interface Student {
  id: string;
  studentCode: string;
  birthYear: number | null;
  birthMonth: number | null; // 1–12
  grade?: string | null;
}
