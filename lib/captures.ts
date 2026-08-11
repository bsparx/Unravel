import { prisma } from "@/lib/db";
import type { Capture, User } from "@/lib/generated/prisma/client";

export type RawCapture = Pick<
  Capture,
  "id" | "body" | "createdAt"
> & {
  tag: { id: string; name: string; description: string | null } | null;
};

/** The behavior log: every capture, most recent first. */
export async function getRawCaptures(
  user: User,
  take = 200,
): Promise<RawCapture[]> {
  return prisma.capture.findMany({
    where: { userId: user.id, status: "RAW" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      body: true,
      createdAt: true,
      tag: { select: { id: true, name: true, description: true } },
    },
  });
}

export async function countRawCaptures(user: User): Promise<number> {
  return prisma.capture.count({
    where: { userId: user.id, status: "RAW" },
  });
}
