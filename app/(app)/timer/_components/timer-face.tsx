"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";

import {
  dualScale,
  liveElapsedSeconds,
  type ClockState,
  type PlannedInterval,
  type TimerConfig,
} from "@/lib/timer-math";

import {
  getServerWebglSupport,
  getWebglSupport,
  markWebglUnavailable,
  subscribeWebglSupport,
} from "../_lib/webgl-support";
import { TimerArc } from "./timer-arc";

/**
 * `three` is ~150kB, and it has no business in the bundle of any route that
 * isn't this one.
 *
 * Next 16: `ssr: false` only works from inside a Client Component, and a
 * Server Component importing a Client Component dynamically does not currently
 * code-split at all. Both are why this call lives here and not in `page.tsx`.
 */
const DecayField = dynamic(
  () => import("./decay-field").then((mod) => mod.DecayField),
  { ssr: false },
);

export type TimerFaceProps = {
  clock: ClockState;
  running: boolean;
  plan: PlannedInterval[];
  intervalIndex: number;
  intervalBaseMs: number;
  config: TimerConfig;
  /** A break past its time. The well turns clay rather than staying teal. */
  overrun?: boolean;
  children?: React.ReactNode;
};

/**
 * Picks which work face to draw.
 *
 * `TimerArc` is deliberately kept rather than deleted. It is the server render,
 * the pre-hydration paint and the fallback when there is no WebGL to be had —
 * all three of which are the same requirement: the face must never be a hole
 * in the page while a 150kB chunk is on its way.
 *
 * Recovery never reaches here. It has its own face, and the reason is in
 * `recovery-face.tsx`.
 */
export function TimerFace({
  clock,
  running,
  plan,
  intervalIndex,
  intervalBaseMs,
  config,
  overrun = false,
  children,
}: TimerFaceProps) {
  const webgl = useSyncExternalStore(
    subscribeWebglSupport,
    getWebglSupport,
    getServerWebglSupport,
  );

  if (!webgl) {
    return (
      <TimerArc
        elapsedSeconds={liveElapsedSeconds(clock)}
        targetSeconds={config.targetSeconds}
        plan={plan}
        running={running}
      >
        {children}
      </TimerArc>
    );
  }

  return (
    <DecayField
      clock={clock}
      running={running}
      plan={plan}
      intervalIndex={intervalIndex}
      intervalBaseMs={intervalBaseMs}
      config={config}
      overrun={overrun}
      dual={dualScale(plan)}
      onContextLost={markWebglUnavailable}
    >
      {children}
    </DecayField>
  );
}
