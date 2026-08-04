import { requireUser } from "@/lib/auth";
import { supportedTimeZones } from "@/lib/dates";

import { SettingsForm } from "./_components/settings-form";
import { ThemeToggle } from "./_components/theme-toggle";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();

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
        }}
      />
    </div>
  );
}
