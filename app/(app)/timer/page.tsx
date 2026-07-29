import { requireUser } from "@/lib/auth";
import { getTask } from "@/lib/tasks";
import {
  clampIntervals,
  clampTarget,
  suggestIntervals,
  type TimerConfig,
} from "@/lib/timer-math";
import { parseTimerParams, toTimerMode } from "@/lib/timer-url";

import { TimerScreen } from "./_components/timer-screen";
import { getActiveSession } from "./_lib/session-hydrate";

export const metadata = { title: "Timer" };

export default async function TimerPage({
  searchParams,
}: PageProps<"/timer">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise. Parsing never throws — a malformed or
  // hostile query string degrades to "no preferences expressed".
  const params = parseTimerParams(await searchParams);

  // Always scoped by user: an id off the wire is a request, not a fact.
  const task = params.taskId ? await getTask(user, params.taskId) : null;

  const focusSeconds = params.focus ?? user.pomodoroSeconds;

  const mode = toTimerMode(params.mode) ?? task?.defaultMode ?? "POMODORO";

  // Resolution order, for every value: URL → task → user default → hard
  // default. Recovery is the exception: it has no target at all, and zero is
  // the honest value rather than a clamped minimum.
  const targetSeconds =
    mode === "RECOVERY"
      ? 0
      : clampTarget(params.target ?? task?.estimatedSeconds ?? focusSeconds);

  const intervals =
    mode === "POMODORO"
      ? clampIntervals(
          params.intervals ??
            task?.plannedIntervals ??
            suggestIntervals(targetSeconds, focusSeconds),
        )
      : 1;

  const initialConfig: TimerConfig = {
    mode,
    targetSeconds,
    intervals,
    focusSeconds,
    shortBreakSeconds: params.break ?? user.shortBreakSeconds,
    longBreakSeconds: user.longBreakSeconds,
    longBreakEvery: user.longBreakEvery,
  };

  const active = await getActiveSession(user);

  return (
    // Nothing here starts the clock. The screen mounts IDLE with the arc full,
    // and `startSession` only ever fires from the Start button's own handler.
    <TimerScreen
      initialConfig={initialConfig}
      initialTask={
        task ? { id: task.id, title: task.title, type: task.type } : null
      }
      initialSteps={task?.steps ?? []}
      hasActiveSession={active !== null}
    />
  );
}
