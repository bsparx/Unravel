import { NextResponse } from "next/server";

import { resetPrayers } from "@/lib/prayers-reset";

/**
 * Vercel Cron → /api/cron/reset-prayers, scheduled daily at 04:00 Asia/Karachi
 * (23:00 UTC — see vercel.json). Wipes yesterday's prayer checks and prunes
 * the timings cache.
 *
 * Guarded by CRON_SECRET, exactly like /api/cron/reset-steps: Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` on cron requests when the env var
 * exists, and we refuse anything else. No Clerk — this is a machine, not a
 * user.
 *
 * The job's own schedule is the reset's meaning (04:00 Pakistan, before
 * Fajr), but every cutoff is still recomputed from the zone list at runtime,
 * so the route is correct however late it actually fires.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await resetPrayers();

  return NextResponse.json({ ok: true, result });
}
