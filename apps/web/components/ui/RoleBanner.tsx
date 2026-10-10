import type { Me } from "@/lib/api";

export const ROLE_LABELS: Record<string, string> = {
  // Gestores
  admin_platform: "Administrador Master (ADM)",
  adm_master: "Administrador Master (ADM)",
  board: "Board de Especialistas",
  board_especialistas: "Board de Especialistas",
  municipal_manager: "Gestor(a) Municipal",
  gestor_municipal: "Gestor(a) Municipal",

  // Escola
  school_manager: "Gestor(a) Escolar / Diretor(a)",
  diretor: "Gestor(a) Escolar / Diretor(a)",
  ppi: "Responsável Escolar (RE)",
  re: "Responsável Escolar (RE)",
  responsavel_escolar: "Responsável Escolar (RE)",
  teacher: "Professor(a)",

  // Núcleo Assistencial
  md1: "Médico(a) (MD)",
  medico: "Médico(a) (MD)",
  md: "Médico(a) (MD)",
  assistente_social: "Assistente Social (AS)",
  as: "Assistente Social (AS)",
  servico_social: "Assistente Social (AS)",
  neuropsicologia: "Neuropsicólogo(a)",
  neuropsicologo: "Neuropsicólogo(a)",
  psicomotricidade: "Psicomotricista",
  psicomotricista: "Psicomotricista",
  psicoterapia: "Psicoterapeuta / Psicólogo(a)",
  psicoterapeuta: "Psicoterapeuta / Psicólogo(a)",
  psicologia: "Psicólogo(a)",
  psicologa: "Psicóloga",
  fonoaudiologia: "Fonoaudiólogo(a)",
  fonoaudiologa: "Fonoaudiólogo(a)",
  psicologia_familiar: "Psicólogo(a) Familiar",
  psicologo_familiar: "Psicólogo(a) Familiar",
  psicopedagogia_clinica: "Psicopedagogo(a) Clínico(a)",
  psicopedagogo_clinico: "Psicopedagogo(a) Clínico(a)",
  specialist: "Especialista do Núcleo Assistencial",
  researcher: "Pesquisador(a)",
};

export function RoleBanner({ me, schoolName }: { me: Me; schoolName?: string }) {
  const roleName = ROLE_LABELS[me.role] ?? me.role;

  return (
    <div
      role="banner"
      aria-label="Perfil ativo"
      className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-linha bg-white px-4 py-3 text-sm shadow-xs"
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-black">{me.name}</span>
        {me.email && (
          <span className="text-xs text-neutral-500 hidden sm:inline">({me.email})</span>
        )}
      </div>
      <span className="text-neutral-300">·</span>
      <span className="inline-flex items-center rounded-full bg-roxo-50 border border-roxo-200/70 px-3 py-0.5 text-xs font-semibold text-roxo-900">
        {roleName}
      </span>
      {schoolName && (
        <>
          <span className="text-neutral-300">·</span>
          <span className="text-neutral-700 text-xs font-medium bg-neutral-100 rounded-md px-2 py-0.5">
            {schoolName}
          </span>
        </>
      )}
    </div>
  );
}
