"use client";

/** Último recurso: erro no próprio layout raiz. Sem dependência de estilos globais. */
export default function ErroGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F6F9FB", color: "#000" }}>
        <main role="alert" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, background: "#fff", border: "1px solid #E1E9ED", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <h1 style={{ fontSize: 18, margin: "0 0 12px" }}>Algo não saiu como esperado</h1>
            <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
              Não foi possível carregar o Periscópio agora. Tente novamente em instantes.
            </p>
            <button onClick={() => reset()} style={{ background: "#682880", color: "#fff", border: 0, borderRadius: 12, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>
              Tentar de novo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
