"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api, type Me } from "@/lib/api";

const ROLE_DESTINATIONS: Record<string, string> = {
  ppi: "re",
  md1: "medico",
  specialist: "especialista",
  school_manager: "re",
  board: "agenda",
  admin_platform: "/admin/users",
};

export default function DashboardIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  useEffect(() => {
    api
      .get<{ user: Me }>("/api/me")
      .then(({ user }) => {
        const dest = ROLE_DESTINATIONS[user.role];
        if (dest) {
          router.replace(dest.startsWith("/") ? dest : `/${slug}/dashboard/${dest}`);
        } else {
          router.replace(`/${slug}/login`);
        }
      })
      .catch(() => {
        router.replace(`/${slug}/login`);
      });
  }, [slug, router]);

  return (
    <div className="flex items-center justify-center py-24 text-tinta-500 text-sm">
      Redirecionando...
    </div>
  );
}
