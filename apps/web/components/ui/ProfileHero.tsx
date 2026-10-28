import Link from "next/link";
import { Pencil } from "lucide-react";
import type { Me } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_LABELS } from "@/components/ui/RoleBanner";
import { ESPECIALIDADE_NOMES, isEspecialidadeId } from "@periscopio/shared";

/**
 * Hero do painel do profissional: foto, nome, cargo, conselho/especialidade, escola e minibiografia.
 * Puxa tudo de `me` (/api/me). A foto e a bio são editadas em "Meu painel".
 */
export function ProfileHero({ me, slug, schoolName }: { me: Me; slug: string; schoolName?: string | null }) {
  const cargo = ROLE_LABELS[me.role] ?? me.role;
  const especialidade =
    me.specialty && isEspecialidadeId(me.specialty) ? ESPECIALIDADE_NOMES[me.specialty] : null;
  const escola = schoolName ?? me.schoolName ?? null;
  const meuPainel = `/${slug}/dashboard/meu-painel`;

  return (
    <section
      role="banner"
      aria-label="Perfil ativo"
      className="flex flex-col gap-3 rounded-2xl border border-linha bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:gap-4"
    >
      <Avatar nome={me.name} url={me.avatarUrl} tamanho="lg" decorativo={false} className="h-16 w-16 text-xl sm:h-20 sm:w-20" />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-lg font-bold leading-tight text-black">{me.name}</h1>
          <span className="inline-flex items-center rounded-full border border-roxo-200/70 bg-roxo-50 px-2.5 py-0.5 text-xs font-semibold text-roxo-900">
            {cargo}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-700">
          {especialidade && <span className="font-semibold text-black">{especialidade}</span>}
          {me.classCode && (
            <>
              {especialidade && <span className="text-neutral-300">·</span>}
              <span>{me.classCode}</span>
            </>
          )}
          {escola && (
            <>
              {(especialidade || me.classCode) && <span className="text-neutral-300">·</span>}
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-neutral-800">{escola}</span>
            </>
          )}
          {me.email && <span className="hidden text-neutral-700 sm:inline">· {me.email}</span>}
        </div>

        {me.bio?.trim() ? (
          <p className="max-w-prose whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm text-neutral-800">{me.bio.trim()}</p>
        ) : (
          <p className="text-xs italic text-neutral-700">
            Sem apresentação ainda.{" "}
            <Link href={meuPainel} className="font-semibold text-roxo underline-offset-2 hover:underline">
              Adicione uma minibiografia
            </Link>
            .
          </p>
        )}
      </div>

      <Link
        href={meuPainel}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-xl border border-linha bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-roxo-50"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar perfil
      </Link>
    </section>
  );
}
