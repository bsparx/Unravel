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
  /** 0 to 60: how many stages are showing. */
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

const toPath = (points: readonly (readonly [number, number])[]) =>
  `M${points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

/** A point on a Catmull-Rom curve through `points`, for a river. */
export function spline(points: readonly (readonly [number, number, number])[], perSegment: number) {
  const out: [number, number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (k: 0 | 1 | 2) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1), at(2)]);
    }
  }
  out.push([...points[points.length - 1]]);
  return out;
}

/**
 * A river's banks, as one closed path: the centre line through `points`
 * (x, y, width) pushed out by half its width either side.
 */
export function riverPath(points: readonly (readonly [number, number, number])[]) {
  const line = spline(points, 6);
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  line.forEach(([x, y, w], i) => {
    const [ax, ay] = line[Math.max(0, i - 1)];
    const [bx, by] = line[Math.min(line.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    left.push([round(x + nx * w * 0.5), round(y + ny * w * 0.5)]);
    right.push([round(x - nx * w * 0.5), round(y - ny * w * 0.5)]);
  });
  return toPath([...left, ...right.reverse()]);
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
