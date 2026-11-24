import { NextResponse } from "next/server";

import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { getDesktopDayPayload } from "@/lib/desktop-day";

/**
 * Today's open `/day` list (overdue, due today, habits due today, side quests,
 * and today's completed items) for the Ubuntu desktop companion.
 */
export async function GET(request: Request) {
  const ctx = await authenticateDesktopRequest(request);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const day = await getDesktopDayPayload(ctx.user);
  return NextResponse.json(day);
}
