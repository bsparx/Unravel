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
