import { NextResponse } from "next/server";

import { getStatsOverview } from "@/app/(app)/stats/_lib/queries";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";

/**
 * 2-week rolling Statistics overview, powered by the exact same `getStatsOverview`
 * query as `/stats` (habits, Mind/Heart practice times, check-off timestamps,
 * focus sessions, and Ending Summary reports).
 */
export async function GET(request: Request) {
  const ctx = await authenticateDesktopRequest(request);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const endParam = url.searchParams.get("end");
  const overview = await getStatsOverview(ctx.user, endParam);

  return NextResponse.json(overview);
}
