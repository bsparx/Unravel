"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidTimeZone } from "@/lib/dates";
import {
  type ActionState,
  fieldErrorsFrom,
  formValues,
  settingsSchema,
} from "@/lib/validation";

export async function updateSettings(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const values = formValues(formData);

  // Checkboxes are simply absent when unchecked.
  for (const key of [
    "autoStartBreaks",
    "autoStartNextFocus",
    "soundEnabled",
    "hapticsEnabled",
    "returnAlertsEnabled",
    "prayerRemindersEnabled",
    "mindWoopEnabled",
    "mindDisputationEnabled",
    "mindGratitudeEnabled",
    "mindDuaEnabled",
    "mindMeditationEnabled",
    "mindReadingEnabled",
    "mindBrainDumpEnabled",
    "heartRecitationEnabled",
    "bodyExercisesEnabled",
    "bodyFastingEnabled",
    "bodyExercisesSceneEnabled",
    "bodyFastingSceneEnabled",
  ]) {
    values[key] = values[key] === "on" || values[key] === "true";
  }

  const parsed = settingsSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;

  if (!isValidTimeZone(input.timezone)) {
    return {
      status: "error",
      message: "That timezone isn't one this browser knows about.",
      fieldErrors: { timezone: "Pick one from the list." },
    };
  }

  if (input.fastEatStart === input.fastEatEnd) {
    return {
      status: "error",
      message: "The eating window needs to open and close at different times.",
      fieldErrors: { fastEatEnd: "Pick a different closing time." },
    };
  }

  if (input.longBreakMinutes < input.shortBreakMinutes) {
    return {
      status: "error",
      message: "A long break should be at least as long as a short one.",
      fieldErrors: { longBreakMinutes: "Make this the longer of the two." },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      timezone: input.timezone,
      weekStart: input.weekStart,
      pomodoroSeconds: input.pomodoroMinutes * 60,
      shortBreakSeconds: input.shortBreakMinutes * 60,
      longBreakSeconds: input.longBreakMinutes * 60,
      longBreakEvery: input.longBreakEvery,
      autoStartBreaks: input.autoStartBreaks,
      autoStartNextFocus: input.autoStartNextFocus,
      soundEnabled: input.soundEnabled,
      hapticsEnabled: input.hapticsEnabled,
      returnAlertsEnabled: input.returnAlertsEnabled,
      prayerRemindersEnabled: input.prayerRemindersEnabled,
      prayerCity: input.prayerCity ?? null,
      mindWoopEnabled: input.mindWoopEnabled,
      mindDisputationEnabled: input.mindDisputationEnabled,
      mindGratitudeEnabled: input.mindGratitudeEnabled,
      mindDuaEnabled: input.mindDuaEnabled,
      mindMeditationEnabled: input.mindMeditationEnabled,
      mindReadingEnabled: input.mindReadingEnabled,
      mindBrainDumpEnabled: input.mindBrainDumpEnabled,
      heartRecitationEnabled: input.heartRecitationEnabled,
      gratitudeTemplate: input.gratitudeTemplate,
      gratitudeCount: input.gratitudeCount,
      duaTemplate: input.duaTemplate,
      duaCount: input.duaCount,
      bodyExercisesEnabled: input.bodyExercisesEnabled,
      bodyFastingEnabled: input.bodyFastingEnabled,
      bodyExercisesSceneEnabled: input.bodyExercisesSceneEnabled,
      bodyFastingSceneEnabled: input.bodyFastingSceneEnabled,
      fastKind: input.fastKind,
      fastEatStart: input.fastEatStart,
      fastEatEnd: input.fastEatEnd,
      fastDaysOfWeek: input.fastDaysOfWeek,
    },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: "Settings saved." };
}

/**
 * Called once from the client on first load, while the timezone is still the
 * UTC default. Never overwrites a zone the user chose themselves.
 */
export async function adoptBrowserTimezone(timezone: string): Promise<void> {
  const user = await requireUser();

  if (user.timezone !== "UTC") return;
  if (!isValidTimeZone(timezone)) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { timezone },
  });

  revalidatePath("/", "layout");
}

type ResetResult = { ok: true } | { ok: false; message: string };

/**
 * Reset all progress: every logged day and every minute on the clock, and
 * nothing else. Habits, identities, schedules, quotas, projects, tags, money
 * and the rest of the structure stand exactly as they are.
 *
 * The blast radius is exactly two tables. Every tally, streak, identity vote
 * and "missed day" is derived from these rows at read time — there are no
 * counters anywhere to rewrite — so deleting the history zeroes the numbers.
 *
 * FocusSession goes first on purpose: its `occurrenceId` is SetNull, so
 * deleting occurrences alone would orphan sessions that still bill time on
 * /stats (the trap `deleteHabit` documents). SessionInterval cascades from
 * the sessions, so two deletes are the whole job.
 *
 * The typed confirmation in the UI is friction, not security. The guard here
 * is the user's own session and the userId on every delete.
 */
export async function resetAllProgress(): Promise<ResetResult> {
  const user = await requireUser();

  try {
    await prisma.$transaction(
      [
        prisma.focusSession.deleteMany({ where: { userId: user.id } }),
        prisma.taskOccurrence.deleteMany({ where: { userId: user.id } }),
      ],
      // Two bulk deletes over the HTTP pooler can spend ~400ms each; the
      // default 5s budget is tight enough to trip P2028.
      { timeout: 20_000 },
    );
  } catch {
    return { ok: false, message: "Nothing was reset. Try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
