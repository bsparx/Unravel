/**
 * Input schemas shared by every Server Action.
 *
 * Server Functions are reachable by a direct POST, not only through our own UI,
 * so nothing that arrives in one is trusted: every action parses its input here
 * and re-scopes every id by `userId` before touching a row.
 */

import { z } from "zod";

import { MINUTES_PER_DAY, MIN_BLOCK_MINUTES } from "@/lib/block-math";
import { CALENDAR_COLOR_NAMES } from "@/lib/calendar-colors";
import { MAX_FEEDBACK_LENGTH } from "@/lib/feedback";
import { MONEY_COLOR_NAMES } from "@/lib/money-palette";
import { parseMoneyToCents } from "@/lib/money";
import { MAX_QUOTA } from "@/lib/quota";
import {
  MAX_INTERVALS,
  MAX_LOGGED_SECONDS,
  MAX_MANUAL_LOG_MINUTES,
  MAX_TARGET_SECONDS,
} from "@/lib/timer-math";
import {
  MAX_GOAL,
  MAX_INTERVAL_MIN,
  MIN_GOAL,
  MIN_INTERVAL_MIN,
} from "@/lib/water";

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
  /** The calendar hue the task wears. Default teal = the calendar's work colour. */
  color: z.enum(CALENDAR_COLOR_NAMES).default("teal"),
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

    // When on, the day isn't DONE until a written note lands on the
    // occurrence. Not `z.coerce.boolean()` — `Boolean("false")` is true — see
    // `includeCue` below for the same trap.
    requiresFeedback: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /** The question asked when closing the day. Empty -> the default prompt. */
    feedbackPrompt: emptyToUndefined(z.string().trim().max(200)),

    /**
     * Habit stacking. `cueMode` discriminates rather than "whichever field came
     * back non-empty": the form can leave a stale label behind when you switch
     * to a habit anchor, and guessing from the payload would resurrect it.
     */
    cueMode: z.enum(["none", "habit", "label"]).default("none"),
    cueTaskId: emptyToUndefined(cuid),
    cueLabel: emptyToUndefined(z.string().trim().min(1).max(120)),
    cueMinutes: z.coerce.number().int().min(1).max(240).default(5),
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
  )
  .refine((value) => value.cueMode !== "habit" || Boolean(value.cueTaskId), {
    message: "Pick the habit this one comes after.",
    path: ["cueTaskId"],
  })
  .refine((value) => value.cueMode !== "label" || Boolean(value.cueLabel), {
    // An empty cue is the one failure mode that makes stacking useless: "after
    // something" is exactly the vagueness the technique exists to remove.
    message: "Name the thing that comes right before it.",
    path: ["cueLabel"],
  });

export const updateTodoSchema = createTodoSchema.extend({ id: cuid });
export const updateHabitSchema = createHabitSchema.extend({ id: cuid });

/** The dump box. Text plus the tag that names the moment — both required. */
export const captureSchema = z.object({
  body: z.string().trim().min(1, "Nothing to save.").max(2000),
  tagId: cuid,
});

/** A custom behavior tag. Short enough to fit a chip. */
export const behaviorTagSchema = z.object({
  name: z.string().trim().min(1, "Name the tag.").max(24),
});

/**
 * Journal bodies have a max but deliberately no min: "nothing is worrying me
 * tonight" is a real answer, and the ritual must accept it without complaint.
 */
export const journalSchema = z.object({
  body: z.string().trim().max(5000),
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

/** Re-colour a task from the calendar, where its colour is actually worn. */
export const updateTaskColorSchema = z.object({
  taskId: cuid,
  color: z.enum(CALENDAR_COLOR_NAMES),
});

/**
 * The "how long did that take" dialog: ticking done on a day with no logged
 * time, and booking the time back so the stats stay honest.
 *
 * Minutes, floored at one (the app never guesses below a minute) and capped at
 * ten hours. The per-task floor is a UI concern — the server only needs the
 * absolute bounds.
 */
export const logAndCompleteSchema = z.object({
  taskId: cuid,
  date: isoDate,
  minutes: z.coerce
    .number()
    .int("Whole minutes, please.")
    .min(1, "Log at least a minute.")
    .max(MAX_MANUAL_LOG_MINUTES, "That's more than 10 hours."),
});

/**
 * Closing a habit from the day list: the written note (required for feedback
 * habits), plus the time to book when the clock never ran. Both optional on
 * the wire — the action decides what a habit actually needs.
 */
export const completeWithNoteSchema = z.object({
  taskId: cuid,
  date: isoDate,
  minutes: emptyToUndefined(
    z.coerce.number().int().min(1).max(MAX_MANUAL_LOG_MINUTES),
  ),
  note: emptyToUndefined(z.string().trim().min(1).max(MAX_FEEDBACK_LENGTH)),
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

/**
 * "Bring the habit's cue along" — defaults to yes, and absence means yes.
 *
 * Not `z.coerce.boolean()`: `Boolean("false")` is `true`, so a checkbox that
 * posts its state as a string would be permanently on. An explicit two-value
 * enum is the only shape where "the user unticked it" survives the wire, and
 * defaulting to true means a caller that predates cues still gets one.
 */
const includeCue = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const blockShape = {
  title: z.string().trim().min(1, "Give the block a name.").max(200),
  notes: emptyToUndefined(notes),
  taskId: emptyToUndefined(cuid),
  date: isoDate,
  startMinute: minuteOfDay,
  endMinute: minuteOfDay,
  kind: z.enum(["WORK", "RECOVERY", "BUFFER"]).default("WORK"),
  includeCue,
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
  includeCue,
});

export const deleteBlockSchema = z.object({ id: cuid });

/**
 * Correcting the time logged against a finished session.
 *
 * Minutes, because that is the unit the number was wrong in — nobody left a
 * timer running by 61,200 seconds, they left it running overnight. Zero is
 * valid and means "this didn't happen"; the row stays, the time goes.
 */
export const adjustSessionSchema = z.object({
  sessionId: cuid,
  minutes: z.coerce
    .number()
    .int("Whole minutes, please.")
    .min(0, "That can't be negative.")
    .max(MAX_LOGGED_SECONDS / 60, "That's more than a day."),
});

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
  hapticsEnabled: z.coerce.boolean().default(true),
  returnAlertsEnabled: z.coerce.boolean().default(true),
  prayerRemindersEnabled: z.coerce.boolean().default(false),
  /** Empty means "leave the app default" — the action stores null. */
  prayerCity: emptyToUndefined(z.string().trim().min(1).max(80)),
});

// ---------------------------------------------------------------- water

/**
 * Logging a glass. `timeMinute` is optional — omitted means "right now", and
 * the action clamps it to now on the way in so a backdated glass can never be
 * logged "later today than it is".
 */
export const logGlassSchema = z.object({
  date: isoDate,
  timeMinute: emptyToUndefined(
    z.coerce.number().int().min(0).max(MINUTES_PER_DAY),
  ),
});

export const removeGlassSchema = z.object({
  glassId: cuid,
});

/**
 * The water settings form. `endMin > startMin` is refused rather than
 * clamped: a window that runs backwards means "no reminders at all", and that
 * decision should be made with the checkbox, not by accident.
 */
export const waterSettingsSchema = z
  .object({
    goal: z.coerce.number().int().min(MIN_GOAL).max(MAX_GOAL),
    remindersEnabled: z.coerce.boolean().default(false),
    startMin: minuteOfDay,
    endMin: minuteOfDay,
    intervalMin: z.coerce
      .number()
      .int()
      .min(MIN_INTERVAL_MIN)
      .max(MAX_INTERVAL_MIN),
  })
  .refine((value) => value.endMin > value.startMin, {
    message: "The reminder window has to run forwards.",
    path: ["endMin"],
  });

// ---------------------------------------------------------------- budget

/**
 * Money arrives as a decimal string ("1250.50") and is converted to integer
 * paise at the action boundary. The format is checked here, the range there —
 * see `parseMoneyToCents` and `MAX_AMOUNT_CENTS` in lib/money.ts.
 */
const moneyAmount = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .refine((value) => parseMoneyToCents(value) !== null, {
    message: "That doesn't look like an amount — e.g. 1250 or 1250.50.",
  });

export const moneyTransactionSchema = z.object({
  /** Present when editing an existing transaction. */
  id: cuid.optional(),
  kind: z.enum(["INCOME", "EXPENSE"]),
  amount: moneyAmount,
  /** The account this money sits in — every entry lands in one. */
  accountId: cuid,
  categoryId: cuid,
  /** Present only when the expense is assigned to an envelope. */
  budgetId: emptyToUndefined(cuid).optional(),
  /** Omitted means today. */
  date: emptyToUndefined(isoDate),
  note: notes,
});

/**
 * Every palette token a category may wear — the global incomes' four, the
 * global expenses' ten, and the ten custom shades. Clay stays out — see
 * lib/budget.ts.
 */
export const moneyCategorySchema = z.object({
  /** Present when editing an existing category. */
  id: cuid.optional(),
  kind: z.enum(["INCOME", "EXPENSE"]),
  name: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(40, "Keep it under 40 characters."),
  color: z.enum(MONEY_COLOR_NAMES).default("teal"),
});

export const deleteMoneyTransactionSchema = z.object({ id: cuid });

export const archiveMoneyCategorySchema = z.object({ id: cuid });

/**
 * A spending envelope. Dates are local calendar days (YYYY-MM-DD); the range
 * check (end after start) happens here, the calendar-day resolution in the
 * action.
 */
export const moneyBudgetSchema = z.object({
  /** Present when editing an existing budget. */
  id: cuid.optional(),
  name: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(40, "Keep it under 40 characters."),
  amount: moneyAmount,
  startsOn: isoDate,
  endsOn: isoDate,
}).superRefine((value, ctx) => {
  if (
    value.endsOn &&
    value.startsOn &&
    value.endsOn < value.startsOn
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endsOn"],
      message: "It ends before it starts.",
    });
  }
});

export const deleteMoneyBudgetSchema = z.object({ id: cuid });

export const removeFromBudgetSchema = z.object({ id: cuid });

/** A place money lives: a name and a palette token. */
export const moneyAccountSchema = z.object({
  /** Present when editing an existing account. */
  id: cuid.optional(),
  name: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(40, "Keep it under 40 characters."),
  color: z.enum(MONEY_COLOR_NAMES).default("teal"),
  /** Money already in the account when you started tracking. Omitted = 0. */
  openingAmount: emptyToUndefined(moneyAmount),
});

export const archiveMoneyAccountSchema = z.object({ id: cuid });

/** Moving money between two of the user's own accounts. */
export const logTransferSchema = z.object({
  amount: moneyAmount,
  fromAccountId: cuid,
  toAccountId: cuid,
  /** Omitted means today. */
  date: emptyToUndefined(isoDate),
  note: notes,
}).superRefine((value, ctx) => {
  if (
    value.fromAccountId &&
    value.toAccountId &&
    value.fromAccountId === value.toAccountId
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["toAccountId"],
      message: "It's the same account — there's nothing to move.",
    });
  }
});

/**
 * An IOU: money promised between you and someone else, before it moves.
 * The counterparty is a name, not an entity — free text, like a note that
 * happens to be the whole point.
 */
export const moneyDebtSchema = z.object({
  /** Present when editing an existing IOU. */
  id: cuid.optional(),
  direction: z.enum(["I_OWE", "OWED_TO_ME"]),
  counterparty: z
    .string()
    .trim()
    .min(1, "Who's it with?")
    .max(80, "Keep the name under 80 characters."),
  amount: moneyAmount,
  /** Omitted means today. */
  date: emptyToUndefined(isoDate),
  note: notes,
});

export const settleDebtSchema = z.object({ id: cuid });

export const deleteDebtSchema = z.object({ id: cuid });

/**
 * Settling an IOU logs a real transaction in the same breath it crosses the
 * debt off — the money moved, so the ledger must know. Everything the
 * transaction needs is validated exactly like `moneyTransactionSchema`; the
 * `debtId` is what the action crosses off.
 */
export const settleDebtTransactionSchema = moneyTransactionSchema.extend({
  debtId: cuid,
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

// ---------------------------------------------------------------- exercises

export const EXERCISE_GOALS = [
  "HIP_FLEXOR_MOBILITY",
  "GLUTE_STRENGTH",
  "HAMSTRING_LENGTH",
  "CORE_STABILITY",
  "LOWER_BACK_RELIEF",
  "UPPER_BACK_STRENGTH",
  "CHEST_MOBILITY",
  "POSTURE_AWARENESS",
  "NECK_MOBILITY",
  "NECK_STRENGTH",
  "CALF_MOBILITY",
  "WRIST_MOBILITY",
  "LEG_STRENGTH",
  "PUSH_STRENGTH",
  "BALANCE",
  "CARDIO",
  "HIP_MOBILITY",
  "ANKLE_MOBILITY",
  "CALF_STRENGTH",
] as const;

export const BODY_PARTS = [
  "HIP_FLEXORS",
  "QUADS",
  "GLUTES",
  "HAMSTRINGS",
  "CORE",
  "LOWER_BACK",
  "UPPER_BACK",
  "SHOULDERS",
  "CHEST",
  "SPINE",
  "FULL_BODY",
  "NECK",
  "CALVES",
  "FOREARMS",
  "ADDUCTORS",
  "ANKLES",
  "ARMS",
] as const;

/** The routine builder offers 1 to 7 training days — any week shape is allowed. */
export const ROUTINE_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

/** How many exercises a single day may carry. */
export const MAX_EXERCISES_PER_DAY = 5;

const weekday = z.coerce.number().int().min(0).max(6);
const exerciseId = cuid;

/**
 * Name the exact days, in the app's 0 = Sunday convention, and how many
 * exercises each picked day should carry (1..MAX_EXERCISES_PER_DAY).
 * `counts` is index-aligned with `days` after dedupe/sort.
 */
export const routineDaysSchema = z
  .object({
    daysPerWeek: z.coerce.number().int().min(1).max(7),
    days: z
      .array(weekday)
      .max(7)
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    counts: z.array(z.coerce.number().int().min(1).max(MAX_EXERCISES_PER_DAY)),
    equipment: z.enum(["YOGA", "DUMBBELL", "MIX"]).default("MIX"),
    dayTypes: z.array(z.enum(["STANDARD", "FLOW", "RECOVERY"])).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.days.length !== value.daysPerWeek) {
      ctx.addIssue({
        code: "custom",
        path: ["days"],
        message: `Pick exactly ${value.daysPerWeek} days.`,
      });
    }
    if (value.counts.length !== value.days.length) {
      ctx.addIssue({
        code: "custom",
        path: ["counts"],
        message: "Pick how many exercises each day will carry.",
      });
    }
    if (
      value.dayTypes !== undefined &&
      value.dayTypes.length !== value.days.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["dayTypes"],
        message: "Name a kind for every day.",
      });
    }
  });

/** One slot of the week, named by where it sits rather than what's in it. */
export const routineSlotSchema = z.object({
  routineId: cuid,
  dayOfWeek: weekday,
  position: z
    .coerce.number()
    .int()
    .min(0)
    .max(MAX_EXERCISES_PER_DAY - 1),
});

/** Swap one slot of the routine for a different exercise. */
export const swapRoutineExerciseSchema = routineSlotSchema.extend({
  exerciseId,
});

export const routineIdSchema = z.object({ routineId: cuid });
