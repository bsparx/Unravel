import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ensureUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { practiceTemplateSchema } from "@/lib/validation";

/**
 * Update gratitude or du'a template choice via a stable Route Handler URL so
 * open browser tabs never fail with Next.js Server Action deployment-skew 404s.
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

  const parsed = practiceTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Some of that didn't look right.",
      },
      { status: 400 },
    );
  }

  const { kind, template, count } = parsed.data;

  try {
    await prisma.user.update({
      where: { id: user.id },
      data:
        kind === "gratitude"
          ? { gratitudeTemplate: template, gratitudeCount: count }
          : { duaTemplate: template, duaCount: count },
    });
  } catch (err) {
    console.error("POST /api/heart/template failed:", err);
    return NextResponse.json(
      { status: "error", message: "Could not save template right now. Try again in a moment." },
      { status: 500 },
    );
  }

  revalidatePath("/heart");
  revalidatePath("/settings");
  return NextResponse.json({ status: "success", template, count });
}
