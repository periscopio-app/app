-- Reabre seções concluídas por versões antigas do catálogo médico, preservando o conteúdo anterior.
-- Idempotente: após a primeira execução, as linhas não atendem mais a status = 'concluido'.
UPDATE public.case_medical_forms
SET history = COALESCE(history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'payload', payload,
        'completedAt', completed_at,
        'completedBy', completed_by,
        'reopenedAt', now(),
        'reopenedBy', NULL,
        'reason', 'Catálogo atualizado'
      )
    ),
    status = 'rascunho',
    completed_at = NULL,
    completed_by = NULL
WHERE status = 'concluido'
  AND form_version <> 'md-1.1-hipotese-cid';
