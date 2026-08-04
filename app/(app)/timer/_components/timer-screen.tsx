"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipForward,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import { StepList } from "@/components/step-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatClock, formatDuration } from "@/lib/dates";
import {
  INTERVAL_LABELS,
  MODE_LABELS,
  readoutSeconds,
  type TimerConfig,
  type TimerMode,
} from "@/lib/timer-math";
import { nextStep, type StepLike } from "@/lib/steps";
import { cn } from "@/lib/utils";

import { adjustLoggedTime } from "../actions";
import type { TodayLog as TodayLogData } from "../_lib/today-log";
import { useTimer, type TimerTask } from "../_hooks/timer-provider";
import { useThresholdHaptics } from "../_hooks/use-threshold-haptics";
import { useWakeLock } from "../_hooks/use-wake-lock";
import { ModeSwitcher } from "./mode-switcher";
import { OverrunPanel } from "./overrun-panel";
import { RecoveryFace } from "./recovery-face";
import { ReturnNote } from "./return-note";
import { TimerFace } from "./timer-face";
import { TodayLog } from "./today-log";

export function TimerScreen({
  initialConfig,
  initialTask,
  initialSteps = [],
  todayLog = null,
  hasActiveSession,
}: {
  initialConfig: TimerConfig;
  initialTask: TimerTask;
  /**
   * The steps belonging to the task in the URL. Deliberately NOT part of the
   * provider's state: that state is persisted and rehydrated from the session
   * row, and putting a mutable checklist in it would mean the timer could
   * resume showing a stale copy of one. Guarded below so they only render when
   * the live session really is the task the page was opened for.
   */
  initialSteps?: StepLike[];
  /** Today's roll-up for the task in the URL. Null when there isn't one. */
  todayLog?: TodayLogData | null;
  hasActiveSession: boolean;
}) {
  const router = useRouter();
  const timer = useTimer();
  const {
    state,
    plan,
    elapsedSeconds,
    focusElapsedSeconds,
    intervalElapsedSeconds,
    currentTargetSeconds,
    onBreak,
    overrunSeconds,
    isOverrunning,
    extendInterval,
    setReturnNote,
    configure,
    reset,
    toggle,
    skipInterval,
    stop,
    discard,
  } = timer;

  // Adopt the URL's setup, but never over a live session — a running clock
  // always outranks a link.
  const appliedRef = useRef(false);
  useEffect(() => {
    if (appliedRef.current || hasActiveSession) return;
    appliedRef.current = true;
    if (state.phase === "IDLE") {
      reset(initialConfig, initialTask);
    }
  }, [hasActiveSession, initialConfig, initialTask, reset, state.phase]);

  useWakeLock(state.phase === "RUNNING");

  const currentInterval = plan[Math.min(state.intervalIndex, plan.length - 1)];

  // The cue for when you've stopped looking at the face. Recovery is excluded
  // by its own interval having no target — see the guard in the hook.
  useThresholdHaptics({
    enabled: timer.settings.hapticsEnabled,
    running: state.phase === "RUNNING",
    intervalIndex: state.intervalIndex,
    interval: currentInterval,
    intervalElapsedSeconds,
  });
  const recovery = state.config.mode === "RECOVERY";
  const isBreak = !recovery && onBreak;
  const isFlow = state.config.mode === "FLOW";
  const isOvertime = !recovery && elapsedSeconds > state.config.targetSeconds;
  const running = state.phase === "RUNNING";
  const idle = state.phase === "IDLE";
  const ended = state.phase === "ENDED";

  // During a pomodoro break, count that break down — showing total focus
  // remaining while you're resting is just wrong. Everything else (recovery
  // counting up, flow's overrun, a plain countdown) is one shared rule.
  //
  // The countdown is measured against focus time, not the wall clock: a break
  // that ran over must not eat the remaining digits, or the next focus block
  // would read as 0:00 the moment it starts. `focusElapsedSeconds` is the
  // client's mirror of what endSession logs — see the provider.
  //
  // Once a break is past its time the countdown has nothing left to say, so it
  // turns around and counts up instead. That number is the whole point of the
  // state: a break with no number on it is exactly the break that becomes forty
  // minutes.
  const readout = isOverrunning
    ? `+${formatClock(overrunSeconds)}`
    : isBreak && currentInterval
      ? formatClock(Math.max(0, currentTargetSeconds - intervalElapsedSeconds))
      : formatClock(
          readoutSeconds(
            state.config.mode,
            focusElapsedSeconds,
            state.config.targetSeconds,
          ),
        );

  // Space starts and pauses from anywhere on this screen.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();

      // Not during an overrun. Pausing there would freeze the clock on a break
      // that has already run over, which is precisely how the overrun used to
      // become invisible — the two buttons are the only ways out on purpose.
      if (isOverrunning) return;
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOverrunning, toggle]);

  // A finished session is committed to the day's roll-up by `endSession`, and
  // this page's copy of that roll-up is server-rendered — so without a refetch
  // "logged today" would still be showing the total from before the session
  // you just did. Fires once per transition into ENDED, not on every render
  // while the summary is up.
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (state.phase !== "ENDED") {
      refreshedFor.current = null;
      return;
    }
    if (refreshedFor.current === state.sessionId) return;
    refreshedFor.current = state.sessionId;
    router.refresh();
  }, [router, state.phase, state.sessionId]);

  // Only show the checklist when the running session is genuinely the task
  // this page was opened for. After a cross-route remount the provider can be
  // holding a different task entirely, and a checklist for the wrong thing is
  // worse than none.
  const steps =
    state.task && initialTask && state.task.id === initialTask.id
      ? initialSteps
      : [];
  const upNext = nextStep(steps);

  // Same guard, same reason: a day's total for the wrong task is a wrong
  // number presented as a fact, which is worse than not showing one.
  const ownTask = state.task && initialTask && state.task.id === initialTask.id;
  const dayLog = ownTask ? todayLog : null;

  const focusBlocks = plan.filter((interval) => interval.kind === "FOCUS");
  const focusIndex = plan
    .slice(0, state.intervalIndex + 1)
    .filter((interval) => interval.kind === "FOCUS").length;

  if (ended) {
    return (
      <SessionSummary
        mode={state.config.mode}
        task={state.task}
        sessionId={state.sessionId}
        elapsedSeconds={focusElapsedSeconds}
        targetSeconds={state.config.targetSeconds}
        onAgain={() => reset(state.config, state.task)}
        onDone={async () => {
          router.push("/");
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-5 py-10 md:py-16">
      {hasActiveSession && state.sessionId && (
        <ResumeBanner onDiscard={discard} />
      )}

      <header className="mb-8 text-center">
        {recovery ? (
          <>
            <p className="text-micro text-rest font-medium tracking-wider uppercase">
              Recovery
            </p>
            <h1 className="font-display mt-1 text-heading text-balance">
              The other half of the day
            </h1>
          </>
        ) : state.task ? (
          <>
            <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
              {state.task.type === "HABIT" ? (
                <span className="inline-flex items-center gap-1">
                  <Repeat className="size-3" aria-hidden />
                  Habit
                </span>
              ) : (
                "Focusing on"
              )}
            </p>
            <h1 className="font-display mt-1 text-heading text-balance">
              {state.task.title}
            </h1>
          </>
        ) : (
          <>
            <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
              No task attached
            </p>
            <h1 className="font-display mt-1 text-heading">Just a timer</h1>
          </>
        )}
      </header>

      {(() => {
        const face = (
          <div className="text-center">
            <p
              className={cn(
                "font-mono text-5xl tabular-nums transition-colors",
                // Clay, not the running blue and not rest: this is neither work
                // on the clock nor rest any more. Reusing either colour would
                // make the one state you need to notice look like the two you
                // don't.
                isOverrunning
                  ? "text-destructive"
                  : running
                    ? recovery
                      ? "text-rest"
                      : "text-running"
                    : "text-foreground",
              )}
              role="timer"
              aria-live="off"
            >
              {readout}
            </p>

            <p
              className={cn(
                "mt-1 text-label",
                isOverrunning
                  ? "text-destructive font-medium"
                  : "text-muted-foreground",
              )}
            >
              {recovery
                ? idle
                  ? "For as long as you like"
                  : running
                    ? "Resting"
                    : "Paused"
                : idle
                  ? "Ready when you are"
                  : isOverrunning
                    ? "Break's over"
                    : isFlow && isOvertime
                      ? "Past your goal"
                      : isBreak
                        ? INTERVAL_LABELS[currentInterval.kind]
                        : focusBlocks.length > 1
                          ? `Focus ${focusIndex} of ${focusBlocks.length}`
                          : MODE_LABELS[state.config.mode]}
            </p>
          </div>
        );

        // Recovery gets its own face entirely — see recovery-face.tsx.
        return recovery ? (
          <RecoveryFace>{face}</RecoveryFace>
        ) : (
          // The clock itself is handed over, not a progress number: the face
          // re-derives it every frame from Date.now(). Passing `elapsedSeconds`
          // would tie it back to this component's 4Hz render and put the
          // stepping straight back in.
          <TimerFace
            clock={{
              accumulatedMs: state.accumulatedMs,
              runningSince: state.runningSince,
            }}
            running={running}
            plan={plan}
            intervalIndex={state.intervalIndex}
            intervalBaseMs={state.intervalBaseMs}
            config={state.config}
            overrun={isOverrunning}
          >
            {face}
          </TimerFace>
        );
      })()}

      {/* Live region kept separate from the ticking digits so screen readers
          aren't read a new number four times a second. */}
      <p className="sr-only" aria-live="polite">
        {running ? "Timer running" : idle ? "Timer ready" : "Timer paused"}
      </p>

      {/* The overrun takes the controls over entirely rather than adding to
          them. Leaving Pause and Skip alongside would put four choices in front
          of someone who has just been pulled back from somewhere else, and the
          two that matter would be the easiest to miss. */}
      {isOverrunning ? (
        <OverrunPanel
          returnLabel={
            state.returnNote ?? upNext?.title ?? state.task?.title ?? null
          }
          onBack={skipInterval}
          onExtend={extendInterval}
        />
      ) : (
        <div className="mt-8 flex items-center gap-2">
          <Button
            size="lg"
            onClick={toggle}
            className={cn(
              "min-w-36",
              running &&
                (recovery
                  ? "bg-rest text-rest-foreground hover:bg-rest/90"
                  : "bg-running text-running-foreground hover:bg-running/90"),
            )}
          >
            {running ? (
              <>
                <Pause className="size-4" aria-hidden />
                Pause
              </>
            ) : (
              <>
                <Play className="size-4" aria-hidden />
                {idle
                  ? recovery
                    ? "Start recovery"
                    : "Start focus"
                  : "Resume"}
              </>
            )}
          </Button>

          {!idle && (
            <>
              {plan.length > 1 && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={skipInterval}
                  aria-label="Skip to the next block"
                >
                  <SkipForward className="size-4" aria-hidden />
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                onClick={() => void stop()}
                aria-label="Stop and log this session"
              >
                <Square className="size-4" aria-hidden />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Only while the break is still a break. Once it has run over, the
          answer is what the overrun panel is already holding up — asking for it
          again at that point is asking someone to compose a sentence when what
          they need is one button. */}
      {isBreak && !isOverrunning && !idle && (
        <ReturnNote
          value={state.returnNote}
          placeholder={upNext?.title ?? state.task?.title ?? null}
          onCommit={setReturnNote}
        />
      )}

      {dayLog && !recovery && (
        <TodayLog
          log={dayLog}
          // Focus-only seconds, breaks excluded — the same figure
          // `endSession` will commit, so the running number and the number it
          // settles on are the same one. The raw wall clock would count the
          // coffee as logged time.
          liveSeconds={focusElapsedSeconds}
          live={!idle && state.sessionId !== null}
          unit={state.task?.type === "HABIT" ? "habit" : "todo"}
        />
      )}

      {steps.length > 0 && !recovery && (
        <section className="mt-8 w-full max-w-sm">
          <h2 className="text-micro text-muted-foreground mb-1 text-center font-medium tracking-wider uppercase">
            {upNext ? "You're on" : "All the way through"}
          </h2>
          <StepList steps={steps} />
        </section>
      )}

      {!idle && state.task && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={async () => {
            await stop({ completedTask: true });
            toast.success(`${state.task?.title} — done.`);
          }}
        >
          <Check className="size-4" aria-hidden />
          Stop and mark it done
        </Button>
      )}

      {idle && (
        <div className="mt-10 w-full space-y-6">
          <ModeSwitcher
            config={state.config}
            onChange={(next) => configure(next)}
          />

          <p className="text-muted-foreground text-center text-label">
            {plan.filter((interval) => interval.kind === "FOCUS").length > 1
              ? `${formatDuration(state.config.targetSeconds)} split into ${
                  plan.filter((interval) => interval.kind === "FOCUS").length
                } sessions, with breaks between them.`
              : `${formatDuration(state.config.targetSeconds)} in one go.`}
          </p>
        </div>
      )}

      {state.task && (
        <Link
          href={state.task.type === "HABIT" ? "/habits" : "/tasks"}
          className="text-muted-foreground hover:text-foreground mt-10 text-label underline underline-offset-4"
        >
          Back to {state.task.type === "HABIT" ? "habits" : "tasks"}
        </Link>
      )}
    </div>
  );
}

function ResumeBanner({ onDiscard }: { onDiscard: () => Promise<void> }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="border-running/40 bg-running-muted mb-8 flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <p className="text-label">
        You already had a session going, so this picked up where it left off.
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
          Keep it
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await onDiscard();
            setDismissed(true);
          }}
        >
          Throw it away
        </Button>
      </div>
    </div>
  );
}

function SessionSummary({
  mode,
  task,
  sessionId,
  elapsedSeconds,
  targetSeconds,
  onAgain,
  onDone,
}: {
  mode: TimerMode;
  task: TimerTask;
  sessionId: string | null;
  elapsedSeconds: number;
  targetSeconds: number;
  onAgain: () => void;
  onDone: () => Promise<void>;
}) {
  const recovery = mode === "RECOVERY";

  // The corrected figure, once someone has corrected it. Kept locally because
  // the provider's clock state is the *measurement*, and a claim about where
  // the time went is not the same object — writing it back into the reducer
  // would mean a reset or a "go again" could carry it forward.
  const [claimed, setClaimed] = useState<number | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const logged = claimed ?? elapsedSeconds;
  const delta = logged - targetSeconds;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-16 text-center">
      <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
        {recovery ? "Recovery logged" : "Session logged"}
      </p>

      <p
        className={cn(
          "font-mono mt-3 text-6xl tabular-nums",
          recovery ? "text-rest" : "text-running",
        )}
      >
        {formatClock(logged)}
      </p>

      {task && !recovery && (
        <p className="font-display mt-3 text-title text-balance">
          {task.title}
        </p>
      )}

      {/* The one moment the number is worth questioning: it is on screen, it
          is fresh, and the person still remembers whether the clock was
          telling the truth. Offered here rather than only on the task page
          because the runaway case — a timer left on for hours — is exactly the
          one where nobody goes looking for a settings screen afterwards. */}
      {sessionId && (
        <AdjustLogged
          sessionId={sessionId}
          loggedSeconds={logged}
          open={adjusting}
          onOpen={() => setAdjusting(true)}
          onClose={() => setAdjusting(false)}
          onSaved={(seconds) => {
            setClaimed(seconds);
            setAdjusting(false);
          }}
        />
      )}

      <p className="text-muted-foreground mt-4 text-label">
        {recovery ? (
          // No planned-versus-actual comparison, because there was no plan.
          // Measuring rest against a target is how it stops being rest.
          <>That counts for exactly as much as the work did.</>
        ) : delta > 60 ? (
          <>
            That&apos;s {formatDuration(delta)} past the{" "}
            {formatDuration(targetSeconds)} you planned.
          </>
        ) : delta < -60 ? (
          <>
            You planned {formatDuration(targetSeconds)} and stopped{" "}
            {formatDuration(-delta)} short. That still counts.
          </>
        ) : (
          <>Right about the {formatDuration(targetSeconds)} you planned.</>
        )}
      </p>

      <div className="mt-8 flex gap-2">
        <Button onClick={() => void onDone()}>Back to today</Button>
        <Button variant="outline" onClick={onAgain}>
          <RotateCcw className="size-4" aria-hidden />
          Go again
        </Button>
      </div>
    </div>
  );
}

/**
 * "That wasn't how long it took."
 *
 * Closed by default and one quiet link wide. The measured number is right the
 * overwhelming majority of the time, and a summary screen that opens with an
 * editable field invites second-guessing a figure that was fine — which on
 * this screen, for this audience, is a decision nobody needed to make.
 */
function AdjustLogged({
  sessionId,
  loggedSeconds,
  open,
  onOpen,
  onClose,
  onSaved,
}: {
  sessionId: string;
  loggedSeconds: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSaved: (seconds: number) => void;
}) {
  const [minutes, setMinutes] = useState(
    String(Math.round(loggedSeconds / 60)),
  );
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setMinutes(String(Math.round(loggedSeconds / 60)));
          onOpen();
        }}
        className="text-muted-foreground hover:text-foreground mt-3 text-label underline underline-offset-4"
      >
        That&apos;s not how long it took
      </button>
    );
  }

  const save = async () => {
    const value = Number(minutes);
    if (!Number.isFinite(value)) {
      toast.error("That isn't a number of minutes.");
      return;
    }

    setPending(true);
    const result = await adjustLoggedTime({
      sessionId,
      minutes: Math.round(value),
    });
    setPending(false);

    if (result.status === "error") {
      toast.error(result.message);
      return;
    }

    onSaved(result.loggedSeconds);
    toast.success(
      result.loggedSeconds === 0
        ? "Logged as no time at all."
        : `Logged as ${formatDuration(result.loggedSeconds)}.`,
    );
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        autoFocus
        value={minutes}
        onChange={(event) => setMinutes(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          }
          if (event.key === "Escape") onClose();
        }}
        className="h-9 w-24 text-center tabular-nums"
        aria-label="Minutes actually spent"
      />
      <span className="text-muted-foreground text-label">min</span>
      <Button size="sm" onClick={() => void save()} disabled={pending}>
        Save
      </Button>
      <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
    </div>
  );
}
