import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os testes ponta a ponta constroem em pasta própria, para não disputar a
  // `.next` com um `next dev` em andamento (e2e/preparar-ambiente.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
