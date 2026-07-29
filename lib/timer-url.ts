/**
 * The task -> timer handoff contract, defined in exactly one place.
 *
 *   /timer?taskId=…&mode=pomodoro&target=1200&intervals=1&focus=1500&break=300
 *
 * Every value is optional and every value is self-describing, so the URL can be
 * bookmarked or shared and still reconstruct the same setup.
 *
 * There is deliberately **no `autostart` parameter**. Clicking a task lands you
 * on a configured timer that is sitting still — starting it is always a
 * separate, deliberate press.
 */

import { z } from "zod";

import {
  MAX_INTERVALS,
  MAX_TARGET_SECONDS,
  MIN_TARGET_SECONDS,
  type TimerMode,
} from "@/lib/timer-math";

// `recovery` is accepted so the close ritual's hand-off can deep-link
// /timer?mode=recovery. It is never *written* by buildTimerHref — see below.
const modeParam = z.enum(["pomodoro", "basic", "flow", "recovery"]);

const seconds = z.coerce
  .number()
  .int()
  .min(MIN_TARGET_SECONDS)
  .max(MAX_TARGET_SECONDS);

export const timerParamsSchema = z.object({
  taskId: z.string().min(1).max(64).optional(),
  mode: modeParam.optional(),
  target: seconds.optional(),
  intervals: z.coerce.number().int().min(1).max(MAX_INTERVALS).optional(),
  focus: seconds.optional(),
  break: z.coerce.number().int().min(30).max(3600).optional(),
});

export type TimerParams = z.infer<typeof timerParamsSchema>;

/**
 * Parse whatever came off the URL. Never throws — a malformed or hostile query
 * string degrades to "no preferences expressed", which the page then fills in
 * from the task and the user's defaults.
 */
export function parseTimerParams(
  raw: Record<string, string | string[] | undefined>,
): TimerParams {
  const result = timerParamsSchema.safeParse(raw);
  return result.success ? result.data : {};
}

export function toTimerMode(mode: TimerParams["mode"]): TimerMode | undefined {
  if (!mode) return undefined;
  return mode.toUpperCase() as TimerMode;
}

export function toModeParam(mode: TimerMode): z.infer<typeof modeParam> {
  return mode.toLowerCase() as z.infer<typeof modeParam>;
}

export type TimerLinkInput = {
  id: string;
  estimatedSeconds: number | null;
  defaultMode: TimerMode;
  plannedIntervals: number | null;
};

/** Rebuild a recovery target from a work target — there isn't one. */
export const RECOVERY_HREF = "/timer?mode=recovery";

/**
 * The link every task row points at. A plain URL, so rows stay prefetchable,
 * right-clickable and bookmarkable.
 *
 * Only values the task actually specifies are written — anything omitted falls
 * through to the user's defaults at render time, so changing your default
 * pomodoro length later also changes what an old bookmark opens with.
 */
export function buildTimerHref(task: TimerLinkInput): string {
  const params = new URLSearchParams({ taskId: task.id });

  // A task is never a recovery session — rest isn't scheduled against a todo.
  // Skipping the param lets the timer fall through to its own default rather
  // than writing a mode that would make no sense on arrival.
  if (task.defaultMode !== "RECOVERY") {
    params.set("mode", toModeParam(task.defaultMode));
  }

  if (task.estimatedSeconds) {
    params.set("target", String(task.estimatedSeconds));
  }

  if (task.plannedIntervals) {
    params.set("intervals", String(task.plannedIntervals));
  }

  return `/timer?${params.toString()}`;
}
