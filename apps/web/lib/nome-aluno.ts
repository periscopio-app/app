"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface NomeDoAluno {
  /** true quando o servidor liberou o nome para esta pessoa neste caso. */
  enabled: boolean;
  fullName: string | null;
  label: string | null;
}

const VAZIO: NomeDoAluno = { enabled: false, fullName: null, label: null };

/**
 * Nome do aluno para a equipe do caso. Quando o servidor não libera (caixinha desligada, perfil fora da equipe ou
 * aluno sem nome no cofre), devolve `enabled: false` e a tela segue com o código e o botão do cofre.
 * Cada abertura de caso fica registrada na auditoria, por isso busca uma vez por caso e nunca guarda em disco.
 */
export function useNomeDoAluno(caseId?: string | null): NomeDoAluno {
  const [nome, setNome] = useState<NomeDoAluno>(VAZIO);

  useEffect(() => {
    setNome(VAZIO);
    if (!caseId) return;
    let ativo = true;
    api
      .get<NomeDoAluno>(`/api/cases/${caseId}/student-identity`)
      .then((r) => {
        if (ativo) setNome(r?.enabled ? r : VAZIO);
      })
      .catch(() => {
        if (ativo) setNome(VAZIO);
      });
    return () => {
      ativo = false;
    };
  }, [caseId]);

  return nome;
}
