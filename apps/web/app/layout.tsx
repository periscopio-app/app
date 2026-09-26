import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Periscópio Saúde",
  description: "Triagem, acompanhamento e encaminhamento de saúde mental escolar.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
