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

  const res = await fetch(targetUrl.toString(), {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: "manual",
  });

  const responseHeaders = new Headers(res.headers);
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
