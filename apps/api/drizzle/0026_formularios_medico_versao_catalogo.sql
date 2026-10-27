-- 0026_formularios_medico_versao_catalogo.sql
-- Ajuste do médico (27/out/2026): seção concluída com catálogo antigo aparecia em branco e travada.
-- O catálogo passou a md-1.1-hipotese-cid (seção I com só CID 10 e CID 11). Toda seção concluída com versão
-- anterior volta a rascunho para o médico rever; o conteúdo antigo fica em `history` (nada é apagado).
-- Idempotente: só atua em linhas concluídas com versão diferente; também é aplicada no boot pelo schema-guard.

UPDATE "case_medical_forms"
SET "history" = COALESCE("history", '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'payload', "payload",
        'completedAt', "completed_at",
        'completedBy', "completed_by",
        'reopenedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'reopenedBy', NULL,
        'reason', 'Catálogo atualizado: reveja e conclua de novo'
      )
    ),
    "status" = 'rascunho',
    "completed_at" = NULL,
    "completed_by" = NULL,
    "updated_at" = now()
WHERE "status" = 'concluido'
  AND "form_version" <> 'md-1.1-hipotese-cid';
