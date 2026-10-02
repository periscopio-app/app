"use client";

import { NeonAuthUIProvider } from "@neondatabase/neon-js/auth/react";
import "@neondatabase/neon-js/ui/css";
import { neon } from "@/lib/neon";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider authClient={neon.auth}>
      {children}
    </NeonAuthUIProvider>
  );
}
