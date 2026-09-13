import "dotenv/config";
import { defineConfig } from "prisma/config";

// Ao existir prisma.config.ts, o Prisma para de carregar .env sozinho — ver
// https://pris.ly/prisma-config. O import acima repõe esse carregamento.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
