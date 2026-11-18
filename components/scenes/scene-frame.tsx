import type { ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";
import { stageIdsAt, type Scene } from "@/lib/scenes";

/**
 * What every Mind scene shares: one 1200 x 560 drawing that fills its box
 * from the bottom up (so a narrow phone crops the sides and a wide screen
 * crops the sky, never the ground), named for a screen reader, and a way to
 * draw a stage only once its day has come.
 *
 * Everything inside is original line and shape work, coloured from CSS
 * variables so each scene has a light and a dark sky. Ambient motion is
 * marked with `data-fx` and only runs when motion is welcome (globals.css).
 */

export type SceneProps = {
  /** 0 to 14: how many stages are showing. */
  level: number;
  /** Stage ids that have just arrived, which grow in. */
  fresh?: readonly string[];
  className?: string;
  /** False when the scene is a backdrop, so it stays silent. */
  label?: boolean;
};

/** A tiny deterministic generator, so stars and grass sit still between renders. */
export function scatter(seed: number, count: number, area: { x: [number, number]; y: [number, number] }) {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: area.x[0] + next() * (area.x[1] - area.x[0]),
    y: area.y[0] + next() * (area.y[1] - area.y[0]),
    r: next(),
  }));
}

/**
 * Trig results rounded for the drawing: Node and the browser can disagree in
 * the last digit of a cosine, and a server-drawn scene has to match.
 */
export const round = (value: number) => Math.round(value * 100) / 100;

/** A point on a quadratic curve, for things strung along a sagging line. */
export function onCurve(
  [x0, y0]: readonly [number, number],
  [cx, cy]: readonly [number, number],
  [x1, y1]: readonly [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
}

/** Extra attributes for a stage's group, `data-fx` included. */
export type StageProps = SVGProps<SVGGElement> & { [key: `data-${string}`]: string | undefined };

/**
 * Stage helpers for one render: whether a stage is showing, and a group that
 * draws it (with its name as a hover title, growing in if it's fresh).
 */
export function stager(scene: Scene, level: number, fresh: readonly string[] = []) {
  const showing = new Set(stageIdsAt(scene, level));
  const names = Object.fromEntries(scene.stages.map((stage) => [stage.id, stage.name]));
  return {
    has: (id: string) => showing.has(id),
    /** `part` keeps keys apart when one stage is drawn in two layers. */
    stage: (id: string, children: ReactNode, props: StageProps = {}, part = "") =>
      showing.has(id) ? (
        <g key={`${id}${part}`} data-stage={id} {...(fresh.includes(id) ? { "data-grow": "" } : {})} {...props}>
          <title>{names[id]}</title>
          {children}
        </g>
      ) : null,
  };
}

export function SceneSvg({
  scene,
  level,
  label = true,
  className,
  defs,
  children,
}: {
  scene: Scene;
  level: number;
  label?: boolean;
  className?: string;
  defs?: ReactNode;
  children: ReactNode;
}) {
  const showing = scene.stages.slice(0, level).map((stage) => stage.name);
  const description = `${scene.title}: ${[scene.base, ...showing].join(", ")}.`;
  return (
    <svg
      viewBox="0 0 1200 560"
      preserveAspectRatio="xMidYMax slice"
      className={cn("mind-scene block size-full", className)}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label ? description : undefined}
    >
      {defs && <defs>{defs}</defs>}
      {children}
    </svg>
  );
}
