import { NextResponse } from "next/server";

import { resetStaleHabitSteps } from "@/lib/habit-steps-reset";

/**
 * Vercel Cron → /api/cron/reset-steps, scheduled daily at 00:00 Asia/Karachi
 * (see vercel.json). Unchecks yesterday's habit steps for the reset zones.
 *
 * Guarded by CRON_SECRET: when that env var exists in the Vercel project,
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}` on every cron request,
 * and we refuse anything else. No Clerk — this is a machine, not a user.
 *
 * The cron's own schedule and the runtime's timezone are irrelevant: every
 * cutoff is computed from each user's stored IANA zone via
 * `tickIsStale`, so the job is correct however or wherever it runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await resetStaleHabitSteps();

  return NextResponse.json({ ok: true, ...result });
}
