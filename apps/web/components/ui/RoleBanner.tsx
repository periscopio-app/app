import type { Me } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  ppi: "Psicopedagogo(a) / RE",
  md1: "Médico(a)",
  specialist: "Especialista Clínico",
  school_manager: "Gestor(a) Escolar",
  teacher: "Professor(a)",
  admin_platform: "Admin Plataforma",
  municipal_manager: "Gestor(a) Municipal",
  board: "Board Científico",
};

export function RoleBanner({ me, schoolName }: { me: Me; schoolName?: string }) {
  return (
    <div
      role="banner"
      aria-label="Perfil ativo"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-linha bg-white px-4 py-2.5 text-sm"
    >
      <span className="font-semibold text-black">{me.name}</span>
      <span className="text-tinta-400">·</span>
      <span className="rounded-full bg-roxo-100 px-2.5 py-0.5 text-xs font-semibold text-black">
        {ROLE_LABELS[me.role] ?? me.role}
      </span>
      {schoolName && (
        <>
          <span className="text-tinta-400">·</span>
          <span className="text-tinta-600">{schoolName}</span>
        </>
      )}
    </div>
  );
}
