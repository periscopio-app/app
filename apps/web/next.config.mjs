/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@periscopio/shared"],
  async rewrites() {
    const apiUrl =
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3001";

    const neonAuthUrl =
      process.env.NEON_AUTH_URL ||
      process.env.BETTER_AUTH_URL ||
      "https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth";

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

