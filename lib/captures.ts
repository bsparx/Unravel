import { prisma } from "@/lib/db";
import type { Capture, User } from "@/lib/generated/prisma/client";

export type RawCapture = Pick<Capture, "id" | "body" | "createdAt">;

/** The inbox: everything untriaged, oldest thought at the bottom. */
export async function getRawCaptures(
  user: User,
  take = 200,
): Promise<RawCapture[]> {
  return prisma.capture.findMany({
    where: { userId: user.id, status: "RAW" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, body: true, createdAt: true },
  });
}

export async function countRawCaptures(user: User): Promise<number> {
  return prisma.capture.count({
    where: { userId: user.id, status: "RAW" },
  });
}
