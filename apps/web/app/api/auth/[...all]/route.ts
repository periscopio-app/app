const NEON_AUTH_URL =
  process.env.NEON_AUTH_URL ||
  process.env.BETTER_AUTH_URL ||
  "https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth";

async function handler(req: Request) {
  const url = new URL(req.url);
  const targetUrl = new URL(
    `${NEON_AUTH_URL.replace(/\/$/, "")}${url.pathname.replace(/^\/api\/auth/, "")}${url.search}`
  );

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.set("Host", targetUrl.host);

  // Normalização de Origin para aceitar deploys de preview e subdomínios da Vercel
  const incomingOrigin = headers.get("origin");
  if (incomingOrigin && (incomingOrigin.includes("vercel.app") || incomingOrigin.includes("localhost"))) {
    // Se o domínio for da Vercel, garante o origin configurado no Neon Auth
    if (incomingOrigin.includes("vercel.app") && !incomingOrigin.includes("periscopio.vercel.app")) {
      headers.set("Origin", "https://periscopio.vercel.app");
    }
  }

  const res = await fetch(targetUrl.toString(), {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      responseHeaders.set(key, value);
    }
  });

  // Preserva múltiplos cookies Set-Cookie sem quebrar formatação
  const setCookies = (res.headers as any).getSetCookie?.() || [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      responseHeaders.append("set-cookie", cookie);
    }
  } else {
    const rawCookie = res.headers.get("set-cookie");
    if (rawCookie) {
      responseHeaders.set("set-cookie", rawCookie);
    }
  }

  // Não armazenar auth em cache
  responseHeaders.set("cache-control", "no-store, max-age=0");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
