"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, RotateCw } from "lucide-react";

export default function PsicopedagogoDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();

  useEffect(() => {
    // Redireciona imediatamente para o fluxo canônico da RE (FOGAP)
    router.replace(`/${slug}/dashboard/re`);
  }, [router, slug]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <RotateCw className="mx-auto mb-4 h-8 w-8 animate-spin text-[#682880]" />
        <h2 className="text-lg font-bold text-black font-display">
          Redirecionando para o Portal da RE (FOGAP)...
        </h2>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">
          O fluxo de avaliação psicopedagógica foi consolidado na área oficial do Responsável Escolar (FOGAP/NEMT).
        </p>
        <div className="mt-6">
          <Link
            href={`/${slug}/dashboard/re`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#682880] px-4 py-2 text-xs font-bold text-white hover:bg-[#531e66] transition"
          >
            <span>Acessar Avaliação RE</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
