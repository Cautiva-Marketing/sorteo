import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Volver a una sección del panel visitada hace poco es instantáneo; las mutaciones llaman
    // `router.refresh()`, que invalida esta caché del cliente.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
