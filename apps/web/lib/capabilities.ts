"use client";

import { useEffect, useState } from "react";
import { api, type Me } from "./api";
import { useSession } from "./auth-client";

/**
 * Privilégios efetivos da pessoa logada (padrão + caixinhas do Administrador Master).
 * O servidor decide de verdade a cada requisição; aqui só escondemos o que a pessoa não pode usar.
 */
interface MeResponse {
  user: Me;
  capabilities?: string[];
}

let cached: Promise<MeResponse> | null = null;
let cachedFor: string | null = null;

/** Esquece as permissões guardadas. Chamar ao entrar e ao sair: o próximo perfil não pode herdar as do anterior. */
export function resetMe(): void {
  cached = null;
  cachedFor = null;
}

export function loadMe(force = false, email?: string | null): Promise<MeResponse> {
  // A guarda é por pessoa: se a sessão mudou (troca de perfil sem recarregar a página), busca de novo.
  if (email && cachedFor && cachedFor !== email) force = true;
  if (!cached || force) {
    cachedFor = email ?? null;
    cached = api.get<MeResponse>("/api/me").catch((e) => {
      cached = null;
      cachedFor = null;
      throw e;
    });
  } else if (email && !cachedFor) {
    cachedFor = email;
  }
  return cached;
}

export function useCapabilities() {
  const [state, setState] = useState<{ ready: boolean; me: Me | null; caps: Set<string> }>({
    ready: false,
    me: null,
    caps: new Set(),
  });

  const { data: session } = useSession();
  const sessionEmail = session?.user?.email?.toLowerCase() ?? null;

  useEffect(() => {
    let alive = true;
    loadMe(false, sessionEmail)
      .then((r) => alive && setState({ ready: true, me: r.user, caps: new Set(r.capabilities ?? []) }))
      .catch(() => alive && setState({ ready: true, me: null, caps: new Set() }));
    return () => {
      alive = false;
    };
  }, [sessionEmail]);

  return {
    ...state,
    has: (key: string) => state.caps.has(key),
    hasAny: (keys: string[]) => keys.some((k) => state.caps.has(k)),
  };
}
