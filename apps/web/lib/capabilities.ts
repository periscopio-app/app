"use client";

import { useEffect, useState } from "react";
import { api, type Me } from "./api";

/**
 * Privilégios efetivos da pessoa logada (padrão + caixinhas do Administrador Master).
 * O servidor decide de verdade a cada requisição; aqui só escondemos o que a pessoa não pode usar.
 */
interface MeResponse {
  user: Me;
  capabilities?: string[];
}

let cached: Promise<MeResponse> | null = null;

export function loadMe(force = false): Promise<MeResponse> {
  if (!cached || force) {
    cached = api.get<MeResponse>("/api/me").catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

export function useCapabilities() {
  const [state, setState] = useState<{ ready: boolean; me: Me | null; caps: Set<string> }>({
    ready: false,
    me: null,
    caps: new Set(),
  });

  useEffect(() => {
    let alive = true;
    loadMe()
      .then((r) => alive && setState({ ready: true, me: r.user, caps: new Set(r.capabilities ?? []) }))
      .catch(() => alive && setState({ ready: true, me: null, caps: new Set() }));
    return () => {
      alive = false;
    };
  }, []);

  return {
    ...state,
    has: (key: string) => state.caps.has(key),
    hasAny: (keys: string[]) => keys.some((k) => state.caps.has(k)),
  };
}
