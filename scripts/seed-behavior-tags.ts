/**
 * Seed the built-in behavior tags.
 *
 * System tags have `userId = null` — they belong to everyone and are never
 * deletable from the UI. Idempotent: safe to re-run, upserts by (null, name).
 *
 * Run: pnpm tsx scripts/seed-behavior-tags.ts
 */
import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const PRESETS = [
  { name: "Bored", description: "Nothing engaging, mind idle" },
  { name: "Avoiding", description: "A specific task in front of you that you don't want to start" },
  { name: "Tired / depleted", description: "End of day, no capacity left" },
  { name: "Restless", description: "Agitated, can't settle" },
  { name: "Lonely / socially flat", description: "After or instead of contact with people" },
  { name: "Reflexive", description: "No felt state at all, headphones just went on" },
  { name: "Low mood", description: "Flat or down before it started" },
] as const;

async function main() {
  let created = 0;
  for (const preset of PRESETS) {
    const existing = await prisma.tag.findFirst({
      where: { userId: null, name: preset.name },
    });
    if (!existing) {
      await prisma.tag.create({
        data: { userId: null, name: preset.name, description: preset.description, system: true },
      });
      created += 1;
    }
  }
  console.log(`Seeded ${created} built-in behavior tags.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
