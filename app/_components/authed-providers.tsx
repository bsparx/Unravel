import { DumpBox } from "@/components/dump-box";
import { MiniTimerBadge } from "@/components/mini-timer-badge";
import { TimezoneSync } from "@/components/timezone-sync";
import { WaterReminder } from "@/components/water-reminder";
import { TimerProvider } from "@/app/(app)/timer/_hooks/timer-provider";
import { getActiveSession } from "@/app/(app)/timer/_lib/session-hydrate";
import type { User } from "@/lib/generated/prisma/client";
import type { WaterToday } from "@/lib/water-data";

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
 */
export async function AuthedProviders({
  user,
  water,
  children,
}: {
  user: User;
  water: WaterToday;
  children: React.ReactNode;
}) {
  const active = await getActiveSession(user);

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
