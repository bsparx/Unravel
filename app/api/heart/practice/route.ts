import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ensureUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { itemsToBody } from "@/lib/practices";
import { practiceEntrySchema } from "@/lib/validation";

const JOURNAL_KIND = { gratitude: "GRATITUDE", dua: "DUA" } as const;

/**
 * Save today's gratitude or du'a page via a stable Route Handler URL so open
 * browser tabs never fail with Next.js Server Action deployment-skew 404s.
 */
export async function POST(request: Request) {
  const user = await ensureUser();
  if (!user) {
    return NextResponse.json(
      { status: "error", message: "Your session expired. Refresh the page and sign in again." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = practiceEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Some of that didn't look right.",
      },
      { status: 400 },
    );
  }

  const { kind, template, items } = parsed.data;
  const date = todayLocal(user.timezone);
  const data = { template, items, body: itemsToBody(items) };

  try {
    await prisma.journalEntry.upsert({
      where: { userId_date_kind: { userId: user.id, date, kind: JOURNAL_KIND[kind] } },
      create: { userId: user.id, date, kind: JOURNAL_KIND[kind], ...data },
      update: data,
    });
  } catch (err) {
    console.error("POST /api/heart/practice failed:", err);
    return NextResponse.json(
      { status: "error", message: "Could not save right now. Try again in a moment." },
      { status: 500 },
    );
  }

  revalidatePath("/heart");
  revalidatePath("/stats");
  revalidatePath("/day");
  return NextResponse.json({ status: "success" });
}
