/**
 * Input schemas shared by every Server Action.
 *
 * Server Functions are reachable by a direct POST, not only through our own UI,
 * so nothing that arrives in one is trusted: every action parses its input here
 * and re-scopes every id by `userId` before touching a row.
 */

import { z } from "zod";

import { MINUTES_PER_DAY, MIN_BLOCK_MINUTES } from "@/lib/block-math";
import { MAX_QUOTA } from "@/lib/quota";
import { MAX_INTERVALS, MAX_TARGET_SECONDS } from "@/lib/timer-math";

export const cuid = z.string().min(1).max(64);

const title = z
  .string()
  .trim()
  .min(1, "Give it a name.")
  .max(200, "That's a long name — try to keep it under 200 characters.");

const notes = z.string().trim().max(5000).optional().or(z.literal(""));

const priority = z.enum(["P1", "P2", "P3", "P4"]);
const timerMode = z.enum(["POMODORO", "BASIC", "FLOW"]);

/** The form collects minutes because that's how people think about time. */
const estimateMinutes = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_TARGET_SECONDS / 60);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional(),
  );

/** The most steps a task can have. Past this it isn't a task, it's a project. */
export const MAX_STEPS = 20;

const stepInput = z.object({
  /**
   * Present for steps that already exist. Carrying it is what makes editing a
   * task's title non-destructive: without an id the save path can't tell a
   * renamed step from a new one, and the only correct implementation left is
   * delete-all-and-recreate, which silently unticks everything you'd done.
   */
  id: cuid.optional(),
  title: z.string().trim().min(1).max(200),
  estimateMinutes: z
    .number()
    .int()
    .min(1)
    .max(MAX_TARGET_SECONDS / 60)
    .nullable()
    .optional(),
});

export type StepInput = z.infer<typeof stepInput>;

/**
 * Steps travel as one JSON field rather than parallel `steps[]` /
 * `stepMinutes[]` arrays.
 *
 * Parallel arrays silently misalign the moment one row omits its optional
 * value — the browser just doesn't send an empty file/number in some cases —
 * and a misalignment here attaches step 3's estimate to step 2 with no error
 * anywhere. One field, one shape.
 *
 * Malformed JSON degrades to "no steps" instead of throwing: a task saved
 * without its steps is recoverable, a 500 on save is not.
 */
export const stepsField = z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.trim() === "") return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  z.array(stepInput).max(MAX_STEPS).default([]),
);

export const createTodoSchema = z.object({
  title,
  notes: emptyToUndefined(notes),
  projectId: emptyToUndefined(cuid),
  priority: priority.default("P4"),
  dueDate: emptyToUndefined(isoDate),
  estimateMinutes: emptyToUndefined(estimateMinutes),
  defaultMode: timerMode.default("POMODORO"),
  plannedIntervals: emptyToUndefined(
    z.coerce.number().int().min(1).max(MAX_INTERVALS),
  ),
  steps: stepsField,
});

const quotaValue = z.coerce.number().int().min(1).max(MAX_QUOTA);

export const createHabitSchema = createTodoSchema
  .omit({ dueDate: true })
  .extend({
    /** 0 = Sunday .. 6 = Saturday. */
    daysOfWeek: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Pick at least one day.")
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    startDate: emptyToUndefined(isoDate),
    endDate: emptyToUndefined(isoDate),
    unit: z.enum(["MINUTES", "COUNT"]).default("MINUTES"),
    minimumQuota: quotaValue.default(1),
    optimalQuota: emptyToUndefined(quotaValue),
  })
  .refine(
    (value) =>
      value.optimalQuota === undefined ||
      value.optimalQuota > value.minimumQuota,
    {
      // Not a clamp. An optimal at or below the minimum means the two bars have
      // collapsed into one, and silently "fixing" it would leave someone
      // believing they had a stretch goal they don't.
      message: "A good day has to be more than the minimum.",
      path: ["optimalQuota"],
    },
  );

export const updateTodoSchema = createTodoSchema.extend({ id: cuid });
export const updateHabitSchema = createHabitSchema.extend({ id: cuid });

/** The dump box. One field, and the only rule is that it isn't empty. */
export const captureSchema = z.object({
  body: z.string().trim().min(1, "Nothing to save.").max(2000),
});

/**
 * Journal bodies have a max but deliberately no min: "nothing is worrying me
 * tonight" is a real answer, and the ritual must accept it without complaint.
 */
export const journalSchema = z.object({
  body: z.string().trim().max(5000),
});

export const promoteCaptureSchema = z.object({
  captureId: cuid,
});

export const selectOneThingSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    taskId: cuid.optional(),
    captureId: cuid.optional(),
    title: z.string().trim().max(200).optional(),
  })
  .refine(
    (value) => Boolean(value.taskId || value.captureId || value.title),
    { message: "Pick something or type it." },
  );

/**
 * The one thing, set up in full.
 *
 * Everything a todo can carry except the deadline: the day it's the one thing
 * for *is* the deadline, so asking would be a question with one answer.
 */
export const createOneThingSchema = createTodoSchema
  .omit({ dueDate: true })
  .extend({ date: isoDate });

export const quickAddSchema = z.object({
  /** The raw single-line input, parsed for "20m", "#project" and "p1". */
  input: z.string().trim().min(1).max(300),
});

export const toggleTaskSchema = z.object({
  taskId: cuid,
  done: z.coerce.boolean(),
});

export const toggleOccurrenceSchema = z.object({
  taskId: cuid,
  date: isoDate,
  status: z.enum(["PENDING", "DONE", "SKIPPED"]),
});

/** The +1 button and the "I did 12" field, in one shape. */
export const habitProgressSchema = z
  .object({
    taskId: cuid,
    date: isoDate,
    set: emptyToUndefined(z.coerce.number().int().min(0).max(MAX_QUOTA)),
    increment: emptyToUndefined(z.coerce.number().int().min(-MAX_QUOTA).max(MAX_QUOTA)),
  })
  .refine((value) => value.set !== undefined || value.increment !== undefined, {
    message: "Nothing to change.",
  });

export const toggleStepSchema = z.object({
  stepId: cuid,
  done: z.coerce.boolean(),
});

// ---------------------------------------------------------------- calendar

const minuteOfDay = z.coerce.number().int().min(0).max(MINUTES_PER_DAY);

const blockShape = {
  title: z.string().trim().min(1, "Give the block a name.").max(200),
  notes: emptyToUndefined(notes),
  taskId: emptyToUndefined(cuid),
  date: isoDate,
  startMinute: minuteOfDay,
  endMinute: minuteOfDay,
  kind: z.enum(["WORK", "RECOVERY", "BUFFER"]).default("WORK"),
};

/**
 * `end > start` is checked here rather than left to `clampSpan` on the way in,
 * because a form that silently lengthens a block you meant to shorten is worse
 * than one that says no. The clamp still runs afterwards — it's the guard for
 * drag input, where coercion IS the right answer.
 */
const longEnough = {
  message: `A block needs to be at least ${MIN_BLOCK_MINUTES} minutes long.`,
  path: ["endMinute"],
};

const isLongEnough = (value: { startMinute: number; endMinute: number }) =>
  value.endMinute - value.startMinute >= MIN_BLOCK_MINUTES;

export const createBlockSchema = z
  .object(blockShape)
  .refine(isLongEnough, longEnough);

export const updateBlockSchema = z
  .object({ ...blockShape, id: cuid })
  .refine(isLongEnough, longEnough);

/** Drag-to-move and drag-to-resize. Coerced, never rejected — see clampSpan. */
export const moveBlockSchema = z.object({
  id: cuid,
  date: isoDate,
  startMinute: minuteOfDay,
  endMinute: minuteOfDay,
});

/** "Put this task somewhere sensible today" — the one-click scheduling path. */
export const scheduleTaskSchema = z.object({
  taskId: cuid,
  date: isoDate,
  /** Omitted means "find the first free slot big enough". */
  startMinute: emptyToUndefined(minuteOfDay),
  minutes: emptyToUndefined(z.coerce.number().int().min(MIN_BLOCK_MINUTES).max(MINUTES_PER_DAY)),
});

export const deleteBlockSchema = z.object({ id: cuid });

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(["teal", "clay", "sage", "sand", "ink"]).default("teal"),
});

export const settingsSchema = z.object({
  timezone: z.string().min(1).max(64),
  weekStart: z.coerce.number().int().min(0).max(6),
  pomodoroMinutes: z.coerce.number().int().min(1).max(180),
  shortBreakMinutes: z.coerce.number().int().min(1).max(60),
  longBreakMinutes: z.coerce.number().int().min(1).max(120),
  longBreakEvery: z.coerce.number().int().min(2).max(12),
  autoStartBreaks: z.coerce.boolean().default(false),
  autoStartNextFocus: z.coerce.boolean().default(false),
  soundEnabled: z.coerce.boolean().default(true),
});

// ---------------------------------------------------------------- action result

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export const idleState: ActionState = { status: "idle" };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Turn a FormData into the plain object shape the schemas expect. */
export function formValues(formData: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (key.endsWith("[]")) {
      const name = key.slice(0, -2);
      const existing = values[name];
      values[name] = Array.isArray(existing) ? [...existing, value] : [value];
      continue;
    }
    values[key] = value;
  }

  return values;
}
