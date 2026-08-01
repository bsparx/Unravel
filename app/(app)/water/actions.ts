"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { minuteOfDayLocal, parseLocalDate } from "@/lib/dates";
import {
  type ActionState,
  fieldErrorsFrom,
  formValues,
  logGlassSchema,
  removeGlassSchema,
  waterSettingsSchema,
} from "@/lib/validation";

function revalidateWaterViews() {
  revalidatePath("/water");
  revalidatePath("/day");
  revalidatePath("/");
  // The reminder lives in the shared layout, fed from the User row — a
  // settings save has to reach it or the new schedule applies to nobody.
  revalidatePath("/(app)", "layout");
}

/**
 * Log a glass, stamped with the minute it was drunk.
 *
 * The claimed time is clamped to "now" on the way in: a backdated glass can
 * be logged at any earlier minute today, but never in the future — that would
 * silently push the pace line forward and turn "last glass was 3h ago" into
 * a lie the app told about the day.
 */
export async function logGlass(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = logGlassSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  const date = parseLocalDate(parsed.data.date);
  if (!date) return;

  const nowMinute = minuteOfDayLocal(user.timezone);
  const timeMinute = Math.min(parsed.data.timeMinute ?? nowMinute, nowMinute);

  await prisma.waterGlass.create({
    data: { userId: user.id, date, timeMinute },
  });

  revalidateWaterViews();
}

/** Remove a glass from the day — the "I logged two extra" path. */
export async function removeGlass(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = removeGlassSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  // Scoped by userId, so an id off the wire finds nothing rather than
  // someone else's glass.
  await prisma.waterGlass.deleteMany({
    where: { id: parsed.data.glassId, userId: user.id },
  });

  revalidateWaterViews();
}

/**
 * The goal, glass size and reminder schedule. Changing the goal does not
 * rewrite past days — the streak and the pace line are functions of the goal
 * in force, and a day that met 8 is still a day that met 8 if the goal later
 * becomes 10.
 */
export async function updateWaterSettings(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = waterSettingsSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const {
    goal,
    remindersEnabled,
    startMin,
    endMin,
    intervalMin,
  } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      waterGoal: goal,
      waterRemindersEnabled: remindersEnabled,
      waterReminderStartMin: startMin,
      waterReminderEndMin: endMin,
      waterReminderIntervalMin: intervalMin,
    },
  });

  revalidateWaterViews();
  return { status: "success", message: "Saved." };
}
