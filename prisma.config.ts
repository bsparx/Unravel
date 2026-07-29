// Prisma 7 no longer auto-loads .env — we do it ourselves.
import "dotenv/config";

import { defineConfig } from "prisma/config";

// Prisma 7 reads the connection string here, not from schema.prisma's
// datasource block. `process.env` rather than prisma's `env()` helper so that
// `prisma generate` still works before a real DATABASE_URL exists.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
