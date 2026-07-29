"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pause, Play, Repeat, RotateCcw, SkipForward, Square } from "lucide-react";
import { toast } from "sonner";

import { StepList } from "@/components/step-list";
import { Button } from "@/components/ui/button";
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

import { useTimer, type TimerTask } from "../_hooks/timer-provider";
import { useWakeLock } from "../_hooks/use-wake-lock";
import { ModeSwitcher } from "./mode-switcher";
import { RecoveryFace } from "./recovery-face";
import { TimerArc } from "./timer-arc";

export function TimerScreen({
  initialConfig,
  initialTask,
  initialSteps = [],
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
  hasActiveSession: boolean;
}) {
  const router = useRouter();
  const timer = useTimer();
  const {
    state,
    plan,
    elapsedSeconds,
    intervalElapsedSeconds,
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
  const recovery = state.config.mode === "RECOVERY";
  const isBreak = !recovery && currentInterval?.kind !== "FOCUS";
  const isFlow = state.config.mode === "FLOW";
  const isOvertime = !recovery && elapsedSeconds > state.config.targetSeconds;
  const running = state.phase === "RUNNING";
  const idle = state.phase === "IDLE";
  const ended = state.phase === "ENDED";

  // During a pomodoro break, count that break down — showing total focus
  // remaining while you're resting is just wrong. Everything else (recovery
  // counting up, flow's overrun, a plain countdown) is one shared rule.
  const readout =
    isBreak && currentInterval
      ? formatClock(
          Math.max(0, currentInterval.targetSeconds - intervalElapsedSeconds),
        )
      : formatClock(
          readoutSeconds(
            state.config.mode,
            elapsedSeconds,
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
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  // Only show the checklist when the running session is genuinely the task
  // this page was opened for. After a cross-route remount the provider can be
  // holding a different task entirely, and a checklist for the wrong thing is
  // worse than none.
  const steps =
    state.task && initialTask && state.task.id === initialTask.id
      ? initialSteps
      : [];
  const upNext = nextStep(steps);

  const focusBlocks = plan.filter((interval) => interval.kind === "FOCUS");
  const focusIndex = plan
    .slice(0, state.intervalIndex + 1)
    .filter((interval) => interval.kind === "FOCUS").length;

  if (ended) {
    return (
      <SessionSummary
        mode={state.config.mode}
        task={state.task}
        elapsedSeconds={elapsedSeconds}
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
                running
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

            <p className="text-muted-foreground mt-1 text-label">
              {recovery
                ? idle
                  ? "For as long as you like"
                  : running
                    ? "Resting"
                    : "Paused"
                : idle
                  ? "Ready when you are"
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
          <TimerArc
            elapsedSeconds={elapsedSeconds}
            targetSeconds={state.config.targetSeconds}
            plan={plan}
            running={running}
          >
            {face}
          </TimerArc>
        );
      })()}

      {/* Live region kept separate from the ticking digits so screen readers
          aren't read a new number four times a second. */}
      <p className="sr-only" aria-live="polite">
        {running ? "Timer running" : idle ? "Timer ready" : "Timer paused"}
      </p>

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
              {idle ? (recovery ? "Start recovery" : "Start focus") : "Resume"}
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
  elapsedSeconds,
  targetSeconds,
  onAgain,
  onDone,
}: {
  mode: TimerMode;
  task: TimerTask;
  elapsedSeconds: number;
  targetSeconds: number;
  onAgain: () => void;
  onDone: () => Promise<void>;
}) {
  const recovery = mode === "RECOVERY";
  const delta = elapsedSeconds - targetSeconds;

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
        {formatClock(elapsedSeconds)}
      </p>

      {task && !recovery && (
        <p className="font-display mt-3 text-title text-balance">{task.title}</p>
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
