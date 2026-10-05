"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Registro do Service Worker de Ativos Públicos
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Falha ao registrar Service Worker PWA:", err);
      });
    }

    // 2. Event Listeners para Conectividade da Rede
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-medium text-white shadow-xl animate-fade-in">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-2.828-2.828a5 5 0 010-7.071m-2.828 2.828a1 1 0 010 1.414m-10.607-1.414a9 9 0 0112.728 0m-2.828 2.828a5 5 0 01-7.071 0m2.828 2.828a1 1 0 01-1.414 0" />
      </svg>
      <span>Você está offline. Exibindo versão de navegação pública armazenada em cache.</span>
    </div>
  );
}
