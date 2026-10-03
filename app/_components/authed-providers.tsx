import { DumpBox } from "@/components/dump-box";
import { MiniTimerBadge } from "@/components/mini-timer-badge";
import { TimezoneSync } from "@/components/timezone-sync";
import { WaterReminder } from "@/components/water-reminder";
import { TimerProvider } from "@/app/(app)/timer/_hooks/timer-provider";
import { getActiveSession } from "@/app/(app)/timer/_lib/session-hydrate";
import { todayLocal } from "@/lib/dates";
import type { User } from "@/lib/generated/prisma/client";
import { getWaterToday } from "@/lib/water-data";

/**
 * Everything a signed-in person carries with them, regardless of which layout
 * they happen to be standing in.
 *
 * Kept in one place so the two route groups cannot drift: a divergence here
 * would mean a running timer behaves differently on `/` than it does on
 * `/day`, which is exactly the bug class the server-side hydration exists to
 * make impossible.
 *
 * Crossing between the groups does remount `TimerProvider`, and that is fine —
 * every piece of truth (accumulated seconds, runningSince, session id,
 * interval index) lives in the `FocusSession` row and is re-read here by
 * `getActiveSession`. The only thing lost is an un-started config, which
 * `/timer` re-derives from its searchParams on arrival anyway.
 *
 * Its two reads are independent, so they share one round trip, and both are
 * request-cached for the pages (/day, /timer) that ask for the same thing.
 */
export async function AuthedProviders({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [active, water] = await Promise.all([
    getActiveSession(user),
    getWaterToday(user, todayLocal(user.timezone)),
  ]);

  return (
    <TimerProvider
      initialSession={active}
      settings={{
        focusSeconds: user.pomodoroSeconds,
        shortBreakSeconds: user.shortBreakSeconds,
        longBreakSeconds: user.longBreakSeconds,
        longBreakEvery: user.longBreakEvery,
        returnAlertsEnabled: user.returnAlertsEnabled,
        autoStartBreaks: user.autoStartBreaks,
        autoStartNextFocus: user.autoStartNextFocus,
        soundEnabled: user.soundEnabled,
        hapticsEnabled: user.hapticsEnabled,
      }}
    >
      {children}
      <MiniTimerBadge />
      <DumpBox />
      <TimezoneSync currentTimezone={user.timezone} />
      <WaterReminder today={water} timezone={user.timezone} />
    </TimerProvider>
  );
}
