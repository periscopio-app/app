import { cn } from "@/lib/cn";
import { iniciais } from "@/lib/perfil";

const tamanhos = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-24 w-24 text-2xl",
} as const;

/** Foto de perfil ou, sem foto, as iniciais. A imagem é decorativa quando o nome já aparece ao lado. */
export function Avatar({
  nome,
  url,
  tamanho = "sm",
  className,
  decorativo = true,
}: {
  nome: string | null | undefined;
  url?: string | null;
  tamanho?: keyof typeof tamanhos;
  className?: string;
  decorativo?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-roxo bg-roxo-100 font-bold text-black shadow-sm",
        tamanhos[tamanho],
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={decorativo ? "" : `Foto de perfil de ${nome ?? "profissional"}`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : (
        <span aria-hidden={decorativo ? true : undefined}>{iniciais(nome)}</span>
      )}
    </span>
  );
}
