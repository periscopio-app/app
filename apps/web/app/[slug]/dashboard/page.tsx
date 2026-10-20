"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api, type Me } from "@/lib/api";

const ROLE_DESTINATIONS: Record<string, string> = {
  ppi: "re",
  md1: "medico",
  specialist: "especialista",
  school_manager: "gestao",
  municipal_manager: "gestao",
  researcher: "bi",
  board: "agenda",
  teacher: "meu-painel", // o professor não tem tela de trabalho nesta versão: começa pelo próprio painel
  admin_platform: "/admin/users",
};

// Primeira tela que a pessoa realmente pode abrir, na ordem de prioridade (segue as caixinhas do Admin Master).
const DESTINATIONS_BY_CAPABILITY: [string, string][] = [
  ["fogap.fill", "re"],
  ["case.delegate", "medico"],
  ["section.read", "especialista"],
  ["management.view", "gestao"],
  ["board.manage", "agenda"],
  ["bi.view", "bi"],
  ["population.view", "mapa"],
  ["privileges.manage", "/admin/privileges"],
];

export default function DashboardIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  useEffect(() => {
    api
      .get<{ user: Me; capabilities?: string[] }>("/api/me")
      .then(({ user, capabilities }) => {
        const caps = new Set(capabilities ?? []);
        const byRole = ROLE_DESTINATIONS[user.role];
        const roleDestOk = byRole && (caps.size === 0 || DESTINATIONS_BY_CAPABILITY.some(([c, d]) => d === byRole && caps.has(c)) || byRole === "/admin/users" || byRole === "meu-painel");
        const dest = roleDestOk ? byRole : DESTINATIONS_BY_CAPABILITY.find(([c]) => caps.has(c))?.[1];
        if (dest) {
          router.replace(dest.startsWith("/") ? dest : `/${slug}/dashboard/${dest}`);
        } else {
          // Quem está logado mas não tem tela de trabalho (ex.: professor) cai no próprio painel, não no login.
          router.replace(`/${slug}/dashboard/meu-painel`);
        }
      })
      .catch(() => {
        router.replace(`/${slug}/login`);
      });
  }, [slug, router]);

  return (
    <div className="flex items-center justify-center py-24 text-neutral-800 text-sm">
      Redirecionando...
    </div>
  );
}
