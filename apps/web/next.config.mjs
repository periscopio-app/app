/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@periscopio/shared"],
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${
          process.env.NEON_AUTH_URL ||
          "https://ep-green-sun-b6elixxo.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth"
        }/:path*`,
      },
    ];
  },
};

export default nextConfig;

