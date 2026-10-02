import type { Metadata } from "next";
import LegalPage from "@/components/landing/LegalPage";
import { HTML, TITULO } from "@/components/landing/legal-termos";

export const metadata: Metadata = {
  title: `${TITULO} | Periscópio`,
  description: "Versão provisória, sujeita a revisão jurídica e clínica.",
};

export default function Page() {
  return <LegalPage titulo={TITULO} html={HTML} />;
}
