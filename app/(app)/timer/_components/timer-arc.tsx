"use client";

import { arcProgress, overtimeProgress, type PlannedInterval } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 108;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const OVERTIME_RADIUS = RADIUS + STROKE / 2 + 5;
const OVERTIME_CIRCUMFERENCE = 2 * Math.PI * OVERTIME_RADIUS;

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * The signature element: a ring that drains as the time is spent, the way a
 * physical Time Timer does. The point is that duration becomes something you
 * can see at a glance instead of a number you have to do arithmetic on.
 *
 * Tick marks sit at each interval boundary, so a 60-minute block visibly reads
 * as three pomodoros *before* you press start.
 *
 * Past the goal in flow mode it inverts: a second ring grows outward in the
 * running colour,
 * because overtime is information, not failure.
 */
export function TimerArc({
  elapsedSeconds,
  targetSeconds,
  plan,
  running,
  children,
}: {
  elapsedSeconds: number;
  targetSeconds: number;
  plan: PlannedInterval[];
  running: boolean;
  children?: React.ReactNode;
}) {
  const remaining = arcProgress(elapsedSeconds, targetSeconds);
  const overtime = overtimeProgress(elapsedSeconds, targetSeconds);
  const isOvertime = overtime > 0;

  const ticks = tickAngles(plan);

  return (
    <div className="relative isolate" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
        // Start at 12 o'clock and drain clockwise.
        className="-rotate-90"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-arc-track"
        />

        {/* The draining wedge. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="butt"
          strokeDasharray={round(CIRCUMFERENCE)}
          strokeDashoffset={round(CIRCUMFERENCE * (1 - remaining))}
          className={cn(
            "transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none",
            running ? "stroke-running" : "stroke-primary",
          )}
        />

        {/* Overtime grows outside the main ring. */}
        {isOvertime && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OVERTIME_RADIUS}
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={round(OVERTIME_CIRCUMFERENCE)}
            strokeDashoffset={round(OVERTIME_CIRCUMFERENCE * (1 - overtime))}
            className="stroke-running transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none"
          />
        )}

        {/* Interval boundaries. Coordinates are rounded because the server and
            the client serialise raw floats to different digit counts, which
            React reports as a hydration mismatch. */}
        {ticks.map((fraction, index) => {
          const angle = fraction * 2 * Math.PI;
          const inner = RADIUS - STROKE / 2;
          const outer = RADIUS + STROKE / 2;
          return (
            <line
              key={index}
              x1={round(CENTER + inner * Math.cos(angle))}
              y1={round(CENTER + inner * Math.sin(angle))}
              x2={round(CENTER + outer * Math.cos(angle))}
              y2={round(CENTER + outer * Math.sin(angle))}
              strokeWidth={2}
              strokeLinecap="round"
              className="stroke-background"
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Boundaries as fractions of the ring, ignoring breaks. */
function tickAngles(plan: PlannedInterval[]): number[] {
  const focusBlocks = plan.filter((interval) => interval.kind === "FOCUS");
  if (focusBlocks.length < 2) return [];

  const total = focusBlocks.reduce(
    (sum, interval) => sum + interval.targetSeconds,
    0,
  );
  if (total <= 0) return [];

  const fractions: number[] = [];
  let cursor = 0;

  for (const interval of focusBlocks.slice(0, -1)) {
    cursor += interval.targetSeconds;
    fractions.push(cursor / total);
  }

  return fractions;
}
