import { requireUser } from "@/lib/auth";
import { supportedTimeZones } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { normalizeFastDays, normalizeWindow } from "@/lib/fasting";
import { clampCount, templateOrDefault } from "@/lib/practices";

import { DesktopTokensSection } from "./_components/desktop-tokens-section";
import { SettingsForm } from "./_components/settings-form";
import { ThemeToggle } from "./_components/theme-toggle";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();

  const [desktopTokens] = await Promise.all([
    prisma.desktopApiToken.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
    }),
  ]);

  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: user.timezone,
  });
  const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: user.timezone,
  });

  const window = normalizeWindow(user.fastEatStart, user.fastEatEnd);
  const zones = supportedTimeZones();
  // Make sure the user's current zone is selectable even on a runtime whose
  // Intl data doesn't list it.
  const timezones = zones.includes(user.timezone)
    ? zones
    : [user.timezone, ...zones];

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">Settings</h1>
      </header>

      <div className="mb-10">
        <ThemeToggle />
      </div>

      <SettingsForm
        timezones={timezones}
        values={{
          timezone: user.timezone,
          weekStart: user.weekStart,
          pomodoroMinutes: Math.round(user.pomodoroSeconds / 60),
          shortBreakMinutes: Math.round(user.shortBreakSeconds / 60),
          longBreakMinutes: Math.round(user.longBreakSeconds / 60),
          longBreakEvery: user.longBreakEvery,
          returnAlertsEnabled: user.returnAlertsEnabled,
          autoStartBreaks: user.autoStartBreaks,
          autoStartNextFocus: user.autoStartNextFocus,
          soundEnabled: user.soundEnabled,
          hapticsEnabled: user.hapticsEnabled,
          prayerRemindersEnabled: user.prayerRemindersEnabled,
          prayerCity: user.prayerCity ?? "Karachi",
          mindWoopEnabled: user.mindWoopEnabled,
          mindDisputationEnabled: user.mindDisputationEnabled,
          mindGratitudeEnabled: user.mindGratitudeEnabled,
          mindDuaEnabled: user.mindDuaEnabled,
          mindMeditationEnabled: user.mindMeditationEnabled,
          mindReadingEnabled: user.mindReadingEnabled,
          mindBrainDumpEnabled: user.mindBrainDumpEnabled,
          heartRecitationEnabled: user.heartRecitationEnabled,
          gratitudeTemplate: templateOrDefault("gratitude", user.gratitudeTemplate).id,
          gratitudeCount: clampCount(user.gratitudeCount),
          duaTemplate: templateOrDefault("dua", user.duaTemplate).id,
          duaCount: clampCount(user.duaCount),
          bodyExercisesEnabled: user.bodyExercisesEnabled,
          bodyFastingEnabled: user.bodyFastingEnabled,
          bodyExercisesSceneEnabled: user.bodyExercisesSceneEnabled,
          bodyFastingSceneEnabled: user.bodyFastingSceneEnabled,
          endingSummaryEnabled: user.endingSummaryEnabled,
          fastKind: user.fastKind,
          fastEatStart: window.eatStart,
          fastEatEnd: window.eatEnd,
          fastDaysOfWeek: normalizeFastDays(user.fastDaysOfWeek),
        }}
      />

      <div className="border-border/70 mt-12 border-t pt-10">
        <DesktopTokensSection
          tokens={desktopTokens.map((t) => ({
            id: t.id,
            label: t.label,
            prefix: t.prefix,
            createdLabel: dateFmt.format(t.createdAt),
            lastUsedLabel: t.lastUsedAt ? dateTimeFmt.format(t.lastUsedAt) : null,
          }))}
        />
      </div>
    </div>
  );
}
