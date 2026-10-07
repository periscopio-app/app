import type { Metadata } from "next";
import { Home } from "@/components/landing-v2/Home";

export const metadata: Metadata = {
  title: "Periscópio — Saúde Mental na Escola",
  description:
    "Programa premiado pela OPAS e recomendado pela OMS para detecção precoce de sofrimento na infância, integrando escola, saúde e assistência social.",
  openGraph: {
    title: "Periscópio — Saúde Mental na Escola",
    description: "Detecção precoce, na escola, para uma infância com mais cuidado. Conheça o programa e o piloto 2026-27.",
    type: "website",
  },
};

export default function HomePage() {
  return <Home />;
}
