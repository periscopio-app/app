-- Bucket clínico do Periscópio (laudos trazidos pela família). Idempotente; rode no SQL Editor do Supabase.
-- Modelo de segurança: bucket PRIVADO + RLS ligado em storage.objects SEM nenhuma política.
-- Resultado: anon e authenticated não leem nem gravam nada; só o servidor da API (service role) acessa,
-- depois de conferir sessão, município e escola. Não crie políticas para anon/authenticated neste bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('periscopio-uploads', 'periscopio-uploads', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

alter table storage.objects enable row level security;
