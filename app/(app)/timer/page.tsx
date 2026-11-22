import { requireUser } from "@/lib/auth";
import { getTask } from "@/lib/tasks";
import {
  clampBreak,
  clampIntervals,
  clampTarget,
  hasIntervals,
  suggestIntervals,
  type TimerConfig,
} from "@/lib/timer-math";
import { parseTimerParams, toTimerMode } from "@/lib/timer-url";

import { TimerScreen } from "./_components/timer-screen";
import { getActiveSession } from "./_lib/session-hydrate";
import { getTodayLog } from "./_lib/today-log";

export const metadata = { title: "Timer" };

export default async function TimerPage({
  searchParams,
}: PageProps<"/timer">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise. Parsing never throws — a malformed or
  // hostile query string degrades to "no preferences expressed".
  const params = parseTimerParams(await searchParams);

  // Always scoped by user: an id off the wire is a request, not a fact. The
  // other reads don't depend on the task, so they share its round trip.
  // Today's log only needs the id, so it rides along too and is dropped below
  // unless the task turns out to be this user's.
  const [task, active, taskLog] = await Promise.all([
    params.taskId ? getTask(user, params.taskId) : null,
    getActiveSession(user),
    params.taskId ? getTodayLog(user, params.taskId) : null,
  ]);

  const focusSeconds = params.focus ?? user.pomodoroSeconds;

  const mode = toTimerMode(params.mode) ?? task?.defaultMode ?? "POMODORO";

  // Resolution order, for every value: URL → task → user default → hard
  // default. Recovery is the exception: it has no target at all, and zero is
  // the honest value rather than a clamped minimum.
  const targetSeconds =
    mode === "RECOVERY"
      ? 0
      : clampTarget(params.target ?? task?.estimatedSeconds ?? focusSeconds);

  const intervals = hasIntervals(mode)
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
    shortBreakSeconds: clampBreak(params.break ?? user.shortBreakSeconds),
    longBreakSeconds: user.longBreakSeconds,
    longBreakEvery: user.longBreakEvery,
  };


  // Only for the task the page was opened for. A live session belonging to a
  // *different* task is guarded in the screen, exactly as the step list is.
  const todayLog = task ? taskLog : null;

  return (
    // Nothing here starts the clock. The screen mounts IDLE with the arc full,
    // and `startSession` only ever fires from the Start button's own handler.
    <TimerScreen
      initialConfig={initialConfig}
      initialTask={
        task ? { id: task.id, title: task.title, type: task.type } : null
      }
      initialSteps={task?.steps ?? []}
      todayLog={todayLog}
      hasActiveSession={active !== null}
    />
  );
}
