"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { islamicDays, islamicSpan } from "@/lib/body-data";
import { localInputToInstant } from "@/lib/dates";
import { prisma } from "@/lib/db";
import {
  fastMinutes,
  islamicDayFor,
  islamicEnd,
  islamicMinutes,
  normalizeWindow,
  validateFastTimes,
  type FastSpan,
} from "@/lib/fasting";
import {
  type ActionState,
  fastEndSchema,
  fastPlanSchema,
  fastStartSchema,
  fastUpdateSchema,
  fieldErrorsFrom,
  formValues,
} from "@/lib/validation";

const invalid = (error: Parameters<typeof fieldErrorsFrom>[0]): ActionState => ({
  status: "error",
  message: "Some of that didn't look right.",
  fieldErrors: fieldErrorsFrom(error),
});

const fail = (message: string): ActionState => ({ status: "error", message });

/** A short pooled round trip each; the default 5s budget is tight on Neon. */
const TX = { timeout: 15_000 } as const;

const noTimings = (city: string) =>
  fail(`Couldn't get prayer times for ${city}. Try again in a moment, or check the city in Settings.`);

/**
 * The fasts that could clash with one running from `from` onwards: anything
 * still open, or anything that ended after it began.
 */
function neighbours(
  tx: Pick<typeof prisma, "fast">,
  userId: string,
  from: Date,
  exceptId?: string,
): Promise<FastSpan[]> {
  return tx.fast.findMany({
    where: {
      userId,
      ...(exceptId ? { id: { not: exceptId } } : {}),
      OR: [{ endedAt: null }, { endedAt: { gt: from } }],
    },
    select: { id: true, startedAt: true, endedAt: true },
  });
}

/**
 * Start a fast.
 *
 * Intermittent: now, or a time you forgot to log; the goal is the window's
 * fast. Islamic: the fast starts at Fajr by definition, so with no time given
 * it is logged from today's Fajr (or tomorrow's, once today's Maghrib has
 * passed, as the intention for the next fast), and its goal is Fajr to
 * Maghrib that day. Logged before Fajr, it simply hasn't begun yet.
 */
export async function startFast(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = fastStartSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const now = new Date();
  const kind = parsed.data.kind ?? user.fastKind;
  const chosen = parsed.data.startedAt ? localInputToInstant(parsed.data.startedAt, user.timezone) : null;
  if (parsed.data.startedAt && !chosen) return fail("That time doesn't exist here.");

  let startedAt: Date;
  let target: number;
  if (kind === "ISLAMIC") {
    const { city, days } = await islamicDays(user, islamicSpan(user.timezone, now));
    const day = islamicDayFor(chosen ?? now, days);
    if (!day) return noTimings(city);
    startedAt = chosen ?? day.fajr;
    target = chosen
      ? Math.max(1, Math.round((day.maghrib.getTime() - chosen.getTime()) / 60_000))
      : islamicMinutes(day);
  } else {
    startedAt = chosen ?? now;
    target = fastMinutes(normalizeWindow(user.fastEatStart, user.fastEatEnd));
  }

  // An Islamic fast logged at suhoor starts at a Fajr still to come; that's
  // the one start allowed in the future.
  const asOf = kind === "ISLAMIC" && !chosen && startedAt > now ? startedAt : now;

  const error = await prisma.$transaction(async (tx) => {
    const others = await neighbours(tx, user.id, startedAt);
    if (others.some((other) => other.endedAt === null)) return "A fast is already running.";
    const problem = validateFastTimes(startedAt, null, asOf, others);
    if (problem) return problem;
    await tx.fast.create({ data: { userId: user.id, kind, startedAt, targetMinutes: target } });
    return null;
  }, TX);
  if (error) return fail(error);

  revalidatePath("/body");
  return { status: "success" };
}

/**
 * Break the running fast, now or earlier. An Islamic fast broken with no
 * time given ends at Maghrib if Maghrib has passed: iftar tapped late is
 * still a full fast.
 */
export async function endFast(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = fastEndSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const now = new Date();
  const chosen = parsed.data.endedAt ? localInputToInstant(parsed.data.endedAt, user.timezone) : null;
  if (parsed.data.endedAt && !chosen) return fail("That time doesn't exist here.");

  const fast = await prisma.fast.findFirst({ where: { id: parsed.data.id, userId: user.id } });
  if (!fast) return fail("That fast no longer exists.");
  if (fast.endedAt) return fail("That fast has already ended.");
  if (fast.startedAt > now) return fail("This fast hasn't begun yet. It starts at Fajr.");

  let endedAt = chosen ?? now;
  if (!chosen && fast.kind === "ISLAMIC") {
    const { days } = await islamicDays(user, islamicSpan(user.timezone, fast.startedAt));
    const day = islamicDayFor(fast.startedAt, days);
    if (day) endedAt = islamicEnd(now, day.maghrib);
  }

  const error = await prisma.$transaction(async (tx) => {
    const others = await neighbours(tx, user.id, fast.startedAt, fast.id);
    const problem = validateFastTimes(fast.startedAt, endedAt, now, others);
    if (problem) return problem;
    const { count } = await tx.fast.updateMany({
      where: { id: fast.id, endedAt: null },
      data: { endedAt },
    });
    return count === 0 ? "That fast has already ended." : null;
  }, TX);
  if (error) return fail(error);

  revalidatePath("/body");
  return { status: "success" };
}

/** Correct a fast's times. The running one only has a start to correct. */
export async function updateFast(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = fastUpdateSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const now = new Date();
  const startedAt = localInputToInstant(parsed.data.startedAt, user.timezone);
  const endedAt = parsed.data.endedAt ? localInputToInstant(parsed.data.endedAt, user.timezone) : null;
  if (!startedAt || (parsed.data.endedAt && !endedAt)) return fail("That time doesn't exist here.");

  const error = await prisma.$transaction(async (tx) => {
    const fast = await tx.fast.findFirst({ where: { id: parsed.data.id, userId: user.id } });
    if (!fast) return "That fast no longer exists.";
    // A finished fast keeps an end; reopening one isn't an edit.
    if (fast.endedAt && !endedAt) return "Give it an end time.";
    const others = await neighbours(tx, user.id, startedAt, fast.id);
    const problem = validateFastTimes(startedAt, fast.endedAt ? endedAt : null, now, others);
    if (problem) return problem;
    await tx.fast.update({
      where: { id: fast.id },
      data: { startedAt, endedAt: fast.endedAt ? endedAt : null },
    });
    return null;
  }, TX);
  if (error) return fail(error);

  revalidatePath("/body");
  return { status: "success" };
}

export async function deleteFast(id: string): Promise<void> {
  const user = await requireUser();
  await prisma.fast.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/body");
}

/**
 * The plan: intermittent or Islamic, and the eating window (kept while
 * Islamic is chosen, so switching back finds it). Applies to fasts started
 * from now on.
 */
export async function setFastingPlan(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = fastPlanSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      fastKind: parsed.data.kind,
      fastEatStart: parsed.data.eatStart,
      fastEatEnd: parsed.data.eatEnd,
    },
  });

  revalidatePath("/body");
  return { status: "success" };
}
