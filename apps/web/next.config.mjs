import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@periscopio/shared"],
  async rewrites() {
    const isDev = process.env.NODE_ENV !== "production";
    const apiUrl =
      process.env.API_URL ||
      (isDev ? "http://localhost:3001" : process.env.NEXT_PUBLIC_API_URL) ||
      "http://localhost:3001";

    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${apiUrl.replace(/\/$/, "")}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;

