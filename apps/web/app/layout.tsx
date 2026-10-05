import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Periscópio Saúde",
  description: "Triagem, acompanhamento e encaminhamento de saúde mental escolar.",
  manifest: "/manifest.json",
};

import { AuthProvider } from "@/components/AuthProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          {children}
          <ServiceWorkerRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
