"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { logGlass, removeGlass } from "../actions";
import {
  expectedByNow,
  formatMinuteOfDay,
  paceMarkerMinute,
  waterStatusLine,
  type WaterSettings,
} from "@/lib/water";
import { cn } from "@/lib/utils";

/**
 * The day as a fish tank.
 *
 * The timer's signature is a ring that drains, the budget's is a jar that
 * empties; this is the third container restated as a place things live — a
 * wide aquarium whose water level *is* the count. One tap anywhere on the
 * glass logs a glass: the level rises, the surface breaks, and the shoal of
 * three gets a little more alive.
 *
 * The mood is a smooth function of the level, not a set of named stages.
 * Zero water is a dry tank: the floor is cracked, the plants have wilted,
 * and the fish lie slumped with X-eyes. Water arrives and they sit up, then
 * swim — the deeper the water, the faster the tail, the wider the eyes, the
 * more bubbles. There is nothing to read; the fish are the reading.
 *
 * The shoal wears three hues that already exist — primary teal, money-amber,
 * money-rose — so the palette gains no fish colour and dark mode is free.
 *
 * The dashed line is the pace line, unchanged in meaning: where the day
 * *should* be by now, with the clock time that belongs to it — and the hour
 * strip beneath the glass is the schedule that time lives in, the reminder
 * window with a tick at now. The vessel is about volume, so time's axis
 * stays outside it.
 *
 * A mis-tap is a matter of when, not whether — the whole tank is a button —
 * so every logged glass offers an Undo on the toast, riding the same
 * optimistic path as every other correction in the app.
 *
 * A met day settles rather than celebrates: the water tint deepens, the
 * surface calms, and the pace line fades — there is no "should" left to
 * measure against.
 *
 * The motion licence is the same narrow one the timer face holds: the
 * swimming *is* the signal. `prefers-reduced-motion` collapses the tank to a
 * single honest frame — the level, the posture, the mood all still there.
 */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The viewBox is 1000×320 and stretches to the container, so all math is
 *  in viewBox units and every stroke opts out of scaling. */
const TANK_TOP = 12;
const TANK_BOTTOM = 308;
const WATER_DEPTH = TANK_BOTTOM - TANK_TOP;
/** The gravel's surface line — a resting body sits on it, not in it. */
const GRAVEL_Y = 292;

const FISH = [
  {
    color: "var(--primary)",
    scale: 1.0,
    lane: 0.3,
    xMin: 90,
    xMax: 430,
    speed: 0.85,
    phase: 0,
  },
  {
    color: "var(--money-amber)",
    scale: 0.85,
    lane: 0.52,
    xMin: 330,
    xMax: 650,
    speed: 1.1,
    phase: 2.1,
  },
  {
    color: "var(--money-rose)",
    scale: 1.1,
    lane: 0.72,
    xMin: 580,
    xMax: 910,
    speed: 0.7,
    phase: 4.2,
  },
];

const PLANTS = [
  { x: 110, s: 0.95 },
  { x: 500, s: 1.15 },
  { x: 870, s: 0.85 },
];

/** The dry floor's cracks — zigzags that fade in as the water leaves. */
const CRACKS = [
  "M 60 296 L 110 278 L 160 292 L 230 272",
  "M 420 296 L 470 280 L 520 294 L 590 276",
  "M 760 296 L 810 282 L 860 294 L 930 278",
];

const PEBBLES = [
  { x: 34, y: 298, rx: 16, ry: 4.5 },
  { x: 88, y: 302, rx: 12, ry: 3.5 },
  { x: 150, y: 297, rx: 20, ry: 5 },
  { x: 224, y: 301, rx: 13, ry: 4 },
  { x: 300, y: 298, rx: 17, ry: 4.5 },
  { x: 362, y: 302, rx: 11, ry: 3.5 },
  { x: 432, y: 297, rx: 22, ry: 5 },
  { x: 510, y: 301, rx: 14, ry: 4 },
  { x: 572, y: 298, rx: 16, ry: 4.5 },
  { x: 642, y: 302, rx: 12, ry: 3.5 },
  { x: 710, y: 297, rx: 19, ry: 5 },
  { x: 784, y: 301, rx: 13, ry: 4 },
  { x: 850, y: 298, rx: 17, ry: 4.5 },
  { x: 920, y: 302, rx: 12, ry: 3.5 },
  { x: 966, y: 298, rx: 12, ry: 4 },
];

export function WaterVessel({
  dateISO,
  settings,
  glasses,
  lastTimeMin,
  initialNowMinute,
  timezone,
}: {
  dateISO: string;
  settings: WaterSettings;
  glasses: number;
  lastTimeMin: number | null;
  initialNowMinute: number;
  timezone: string;
}) {
  const [, startTransition] = useTransition();
  const [shown, applyDelta] = useOptimistic(glasses, (current, delta: number) =>
    Math.max(0, current + delta),
  );

  // "Now" starts at the server's answer so the first paint hydrates clean,
  // and ticks every thirty seconds after that.
  const [nowMinute, setNowMinute] = useState(initialNowMinute);
  useEffect(() => {
    const id = setInterval(
      () => setNowMinute(minuteOfDayNow(timezone)),
      30_000,
    );
    return () => clearInterval(id);
  }, [timezone]);

  const log = () => {
    startTransition(async () => {
      applyDelta(1);
      const logged = await logGlass(
        (() => {
          const formData = new FormData();
          formData.set("date", dateISO);
          return formData;
        })(),
      );
      if (!logged) return;

      // The whole tank is a button, so a mis-tap is a matter of when, not
      // whether. The undo rides the same optimistic path as every other
      // correction in the app: the level drops at once, the server confirms.
      toast.success(`Logged ${formatMinuteOfDay(logged.timeMinute)}`, {
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              applyDelta(-1);
              const formData = new FormData();
              formData.set("glassId", logged.id);
              await removeGlass(formData);
            });
          },
        },
      });
    });
  };

  const goal = settings.goal;
  const expected = expectedByNow(
    goal,
    settings.startMin,
    settings.endMin,
    nowMinute,
  );
  const ratio = Math.min(1, Math.max(0, shown / goal));
  const paceMinute = paceMarkerMinute(
    goal,
    expected,
    settings.startMin,
    settings.endMin,
  );
  const status = waterStatusLine({
    glasses: shown,
    goal,
    expected,
    lastTimeMin,
    nowMinute,
  });

  // The frame loop's inputs: the level the water eases toward, the impulse a
  // logged glass gives the surface, and a way to re-draw a static frame when
  // reduced motion disables the loop. Written in effects, never during render.
  const ratioRef = useRef(ratio);
  const splashRef = useRef(0);
  const drawRef = useRef<(dt: number) => void>(() => {});
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    ratioRef.current = ratio;
    if (REDUCED_MOTION) drawRef.current(0);
  }, [ratio]);

  // The count pops and the surface breaks — the same glass, two channels.
  const prevShown = useRef(shown);
  const [popKey, setPopKey] = useState(0);
  useEffect(() => {
    if (shown > prevShown.current) {
      setPopKey((key) => key + 1);
      splashRef.current = 1;
    }
    prevShown.current = shown;
  }, [shown]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const waterRect = svg.querySelector<SVGRectElement>("#wt-water");
    const surface = svg.querySelector<SVGPathElement>("#wt-surface");
    const cracks = svg.querySelector<SVGGElement>("#wt-cracks");
    const bubblesEl = svg.querySelector<SVGGElement>("#wt-bubbles");
    const pace = svg.querySelector<SVGGElement>("#wt-pace");
    if (!waterRect || !surface || !cracks || !bubblesEl) return;

    const bubbleCircles = Array.from(bubblesEl.querySelectorAll("circle"));
    if (bubbleCircles.length === 0) return;

    const fishEls = FISH.map((_, i) => {
      const g = svg.querySelector<SVGGElement>(`#wt-fish-${i}`);
      const tail = svg.querySelector<SVGGElement>(`#wt-tail-${i}`);
      const happy = svg.querySelector<SVGGElement>(`#wt-happy-${i}`);
      const sad = svg.querySelector<SVGGElement>(`#wt-sad-${i}`);
      return { g, tail, happy, sad };
    });
    if (fishEls.some((f) => !f.g || !f.tail || !f.happy || !f.sad)) return;

    const plantEls = PLANTS.map((_, i) =>
      svg.querySelector<SVGGElement>(`#wt-plant-${i}`),
    );
    if (plantEls.some((p) => !p)) return;

    const fishState = FISH.map((f, i) => ({
      x: f.xMin + ((f.xMax - f.xMin) * (i + 1)) / 4,
      dir: 1,
      tailPhase: f.phase,
      phase: f.phase,
    }));

    const pool = bubbleCircles.map((el, i) => ({
      el,
      alive: false,
      x: 0,
      y: 0,
      r: 3,
      v: 0,
      phase: i * 0.9,
    }));

    let level = ratioRef.current;
    let splash = splashRef.current;
    let wavePhase = 0.6;
    let tick = 0;
    let paceOpacity = 1;

    const draw = (dt: number) => {
      const target = ratioRef.current;
      const met = target >= 1;
      if (REDUCED_MOTION) {
        level = target;
      } else {
        // Fill eases slower than it drains: a glass landing is a reward, a
        // removal is a correction and should get on with it.
        level += (target - level) * (target > level ? 0.09 : 0.28);
      }

      const waterH = level * WATER_DEPTH;
      const waterTop = TANK_BOTTOM - waterH;
      const slump = waterH < 3 ? 1 - waterH / 3 : 0;
      const energy = 1 - slump;

      splash *= 0.9;
      wavePhase += (0.5 + energy * 1.4) * dt;
      tick += dt;

      waterRect.setAttribute("y", String(waterTop));
      waterRect.setAttribute("height", String(Math.max(0, waterH)));
      // Goal met: the tank settles. A deeper tint and a calmer surface are
      // parameter changes on the state that already exists — no new motion.
      waterRect.setAttribute("opacity", met ? "0.34" : "0.26");

      if (waterH > 2) {
        const amp = (1 + splash * 2.2) * 2.2 * (met ? 0.55 : 1);
        let d = `M 12 ${waterTop.toFixed(1)}`;
        for (let x = 12; x <= 988; x += 16) {
          d += ` L ${x} ${(waterTop + Math.sin(x * 0.013 + wavePhase) * amp).toFixed(1)}`;
        }
        surface.setAttribute("d", d);
      } else {
        surface.setAttribute("d", "");
      }

      // The pace line has one job — say where the day should be — and a met
      // day has no "should" left. It fades; its label leaves with it.
      const paceTarget = met ? 0 : 1;
      paceOpacity = REDUCED_MOTION
        ? paceTarget
        : paceOpacity + (paceTarget - paceOpacity) * Math.min(1, 0.12 * dt * 60);
      pace?.setAttribute("opacity", paceOpacity.toFixed(2));

      fishEls.forEach((els, i) => {
        const cfg = FISH[i];
        const f = fishState[i];
        f.x += (f.dir * cfg.speed * (0.35 + 0.65 * energy) * dt) * 60;
        if (f.x > cfg.xMax) {
          f.x = cfg.xMax;
          f.dir = -1;
        }
        if (f.x < cfg.xMin) {
          f.x = cfg.xMin;
          f.dir = 1;
        }

        let y = waterTop + cfg.lane * waterH;
        // The dry pose is a fish lying on the gravel, not sunk through it:
        // a 35° nose-down tilt, rested so the body's lowest edge sits on the
        // floor line. The mirrored scale of a left-swimming fish flips the
        // tilt's x, but the nose still points down either way.
        const restY = GRAVEL_Y - 13 * cfg.scale;
        y += (restY - y) * slump;
        y += Math.sin(tick * 1.2 + f.phase) * 2.6 * energy;
        f.tailPhase += 9 * energy * dt;

        els.g?.setAttribute(
          "transform",
          `translate(${f.x.toFixed(1)} ${y.toFixed(1)}) rotate(${(slump * 35).toFixed(1)}) scale(${(cfg.scale * f.dir).toFixed(2)})`,
        );
        els.tail?.setAttribute(
          "transform",
          `rotate(${(Math.sin(f.tailPhase) * 20 * energy).toFixed(1)} -18 0)`,
        );
        els.happy?.setAttribute("opacity", String(1 - slump));
        els.sad?.setAttribute("opacity", String(slump));
      });

      plantEls.forEach((g) => {
        // Wilt to one side and droop — the whole plant sags toward its base
        // instead of shedding leaves at random angles.
        g?.setAttribute(
          "transform",
          `rotate(${(slump * 36).toFixed(1)} 0 0) scale(1 ${(1 - slump * 0.3).toFixed(2)})`,
        );
        g?.setAttribute("opacity", String(1 - slump * 0.45));
      });

      cracks.setAttribute("opacity", String((slump * 0.9).toFixed(2)));

      if (!REDUCED_MOTION && waterH > 8) {
        if (Math.random() < splash * 5 + energy * 0.05) {
          const free = pool.find((b) => !b.alive);
          if (free) {
            free.alive = true;
            free.x = 40 + Math.random() * 920;
            free.y = waterTop + waterH - 6 - Math.random() * 20;
            free.r = 2 + Math.random() * 3;
            free.v = 30 + Math.random() * 46;
            free.phase = Math.random() * Math.PI * 2;
          }
        }
      }
      pool.forEach((b) => {
        if (!b.alive) return;
        if (REDUCED_MOTION || b.y < waterTop + 5 || waterH <= 4) {
          b.alive = false;
        } else {
          b.y -= b.v * dt;
          b.x += Math.sin(tick * 1.6 + b.phase) * 0.6;
        }
        b.el.setAttribute("cx", String(b.x.toFixed(1)));
        b.el.setAttribute("cy", String(b.y.toFixed(1)));
        b.el.setAttribute("r", String(b.r.toFixed(1)));
        b.el.setAttribute("visibility", b.alive ? "visible" : "hidden");
      });
    };

    if (REDUCED_MOTION) {
      draw(0);
    } else {
      let raf = 0;
      let last = performance.now();
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        draw(dt);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(raf);
        drawRef.current = () => {};
      };
    }

    drawRef.current = () => draw(0);
    return () => {
      drawRef.current = () => {};
    };
  }, []);

  const notches = [];
  for (let k = 1; k < goal; k++) notches.push(k);
  const paceY =
    TANK_BOTTOM - (Math.min(1, Math.max(0, expected / goal))) * WATER_DEPTH;
  const dayMet = shown >= goal;

  // The reminder window as a strip of hours. Labels every four hours from
  // the window's own start (so they never drift off the pace line's grid),
  // plus the window's end — and any label that would land on the now-tick
  // stands down, because one of the two numbers is enough.
  const windowSpan = Math.max(1, settings.endMin - settings.startMin);
  const rulerPos = (minute: number) =>
    (Math.min(1, Math.max(0, (minute - settings.startMin) / windowSpan)) * 100);
  const rulerHours: number[] = [];
  for (let m = settings.startMin; m < settings.endMin; m += 240) {
    rulerHours.push(m);
  }
  if (rulerHours[rulerHours.length - 1] !== settings.endMin) {
    rulerHours.push(settings.endMin);
  }
  const nowInWindow =
    nowMinute >= settings.startMin && nowMinute < settings.endMin;
  const nowPos = nowInWindow ? rulerPos(nowMinute) : null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={log}
        aria-label="Log a glass of water"
        className="focus-visible:ring-ring group relative block w-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1000 320"
          preserveAspectRatio="none"
          aria-hidden
          className="block h-56 w-full md:h-64"
        >
          <defs>
            <clipPath id="wt-interior">
              <rect x={12} y={12} width={976} height={296} rx={14} />
            </clipPath>
          </defs>

          <g>
            {/* The tank interior, tinted so the glass reads as a place rather
                than a hole in the page. */}
            <rect
              x={12}
              y={12}
              width={976}
              height={296}
              rx={14}
              fill="var(--accent)"
              opacity={0.28}
            />

            {/* The day's volume marks — one line per glass. Covered by the
                fill as the level rises, which is the point: they exist to be
                crossed. */}
            {notches.map((k) => (
              <line
                key={k}
                x1={12}
                x2={988}
                y1={TANK_BOTTOM - (k / goal) * WATER_DEPTH}
                y2={TANK_BOTTOM - (k / goal) * WATER_DEPTH}
                stroke="var(--border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* The pace line, and the clock time it belongs to. Wrapped so
                the frame loop can fade the whole idea out on a met day. */}
            {paceMinute !== null && (
              <g id="wt-pace">
                <line
                  x1={12}
                  x2={988}
                  y1={paceY}
                  y2={paceY}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.5}
                  strokeWidth={1.5}
                  strokeDasharray="8 7"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}

            {/* Gravel, and the cracks that appear when the tank goes dry. */}
            <rect
              x={12}
              y={292}
              width={976}
              height={16}
              rx={7}
              fill="var(--secondary)"
              opacity={0.55}
            />
            {PEBBLES.map((p, i) => (
              <ellipse
                key={i}
                cx={p.x}
                cy={p.y}
                rx={p.rx}
                ry={p.ry}
                fill="var(--muted-foreground)"
                opacity={i % 3 === 0 ? 0.3 : i % 3 === 1 ? 0.18 : 0.12}
              />
            ))}
            <g id="wt-cracks" opacity={0}>
              {CRACKS.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.7}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            {/* The plants. They wilt with the water — the transform and
                opacity are driven by the frame loop. */}
            {PLANTS.map((p, i) => (
              <g key={i} transform={`translate(${p.x} 300) scale(${p.s})`}>
                <g id={`wt-plant-${i}`} transform="rotate(0 0 0)" opacity={1}>
                  <path
                    d="M 0 0 C -4 -24 4 -44 -2 -62"
                    fill="none"
                    stroke="var(--money-moss)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <ellipse
                    cx={2}
                    cy={-26}
                    rx={4}
                    ry={11}
                    fill="var(--money-moss)"
                    opacity={0.85}
                    transform="rotate(24 2 -26)"
                  />
                  <ellipse
                    cx={-4}
                    cy={-42}
                    rx={4}
                    ry={11}
                    fill="var(--money-moss)"
                    opacity={0.8}
                    transform="rotate(-26 -4 -42)"
                  />
                  <ellipse
                    cx={1}
                    cy={-56}
                    rx={3.5}
                    ry={9}
                    fill="var(--money-moss)"
                    opacity={0.9}
                    transform="rotate(10 1 -56)"
                  />
                </g>
              </g>
            ))}

            {/* The water. Fills from the bottom, never drains from the top —
                a glass is drunk up, but the day accumulates down. */}
            <g clipPath="url(#wt-interior)">
              <rect
                id="wt-water"
                x={12}
                y={TANK_BOTTOM - ratio * WATER_DEPTH}
                width={976}
                height={Math.max(0, ratio * WATER_DEPTH)}
                fill="var(--primary)"
                opacity={0.26}
              />
              <path
                id="wt-surface"
                d=""
                fill="none"
                stroke="var(--primary)"
                strokeOpacity={0.65}
                strokeWidth={2.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Bubbles — a pool of pre-made circles the loop hands out. */}
              <g id="wt-bubbles">
                {Array.from({ length: 26 }, (_, i) => (
                  <circle
                    key={i}
                    cx={0}
                    cy={0}
                    r={3}
                    fill="var(--primary)"
                    opacity={0.45}
                    visibility="hidden"
                  />
                ))}
              </g>
            </g>

            {/* The shoal. Position, slump, tail and mood are the frame loop's
                — React never touches them again after first paint. */}
            {FISH.map((f, i) => (
              <g key={f.color} id={`wt-fish-${i}`} transform="translate(400 240) scale(1)">
                <g id={`wt-tail-${i}`} transform="rotate(0 -18 0)">
                  <path
                    d="M -18 0 L -35 -12 L -35 12 Z"
                    fill={f.color}
                    opacity={0.85}
                  />
                </g>
                <ellipse cx={0} cy={0} rx={17} ry={10} fill={f.color} />
                <path
                  d="M -7 -9 L -1 -19 L 5 -9 Z"
                  fill={f.color}
                  opacity={0.9}
                />
                <path
                  d="M -4 9 L 0 16 L 5 9 Z"
                  fill={f.color}
                  opacity={0.9}
                />
                <ellipse
                  cx={9}
                  cy={5}
                  rx={3.2}
                  ry={2}
                  fill={f.color}
                  opacity={0.8}
                  transform="rotate(-18 9 5)"
                />
                {/* Happy: an open eye and a smile. */}
                <g id={`wt-happy-${i}`} opacity={1}>
                  <circle cx={8.5} cy={-3.5} r={3} fill="#000" opacity={0.5} />
                  <circle cx={9.5} cy={-4.5} r={1} fill="#fff" opacity={0.85} />
                  <path
                    d="M 4.5 4.5 Q 8.5 8 12.5 4.5"
                    fill="none"
                    stroke="#000"
                    strokeOpacity={0.5}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
                {/* Sad: an X for the eye and a frown. */}
                <g id={`wt-sad-${i}`} opacity={0}>
                  <path
                    d="M 5.5 -6.5 L 11 -1 M 11 -6.5 L 5.5 -1"
                    stroke="#000"
                    strokeOpacity={0.55}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M 4.5 6 Q 8.5 2.5 12.5 6"
                    fill="none"
                    stroke="#000"
                    strokeOpacity={0.55}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              </g>
            ))}

            {/* The glass: an outer frame, a hairline inner edge, and a top
                rim so it reads as a tank rather than a box. */}
            <rect
              x={8}
              y={8}
              width={984}
              height={304}
              rx={18}
              fill="none"
              stroke="var(--foreground)"
              strokeOpacity={0.28}
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={12}
              y={12}
              width={976}
              height={296}
              rx={14}
              fill="none"
              stroke="var(--foreground)"
              strokeOpacity={0.12}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={8}
              y={8}
              width={984}
              height={11}
              rx={5.5}
              fill="var(--foreground)"
              opacity={0.07}
            />
          </g>
        </svg>

        {/* The pace line's label, in real type rather than SVG text. It
            leaves with the line on a met day. */}
        {paceMinute !== null && (
          <span
            aria-hidden
            className={cn(
              "bg-background/90 text-muted-foreground absolute right-2 rounded-sm px-1 font-mono text-micro tabular-nums transition-opacity duration-500",
              dayMet && "opacity-0",
            )}
            style={{
              top: `${(paceY / 320) * 100}%`,
              transform: "translateY(-120%)",
            }}
          >
            {formatMinuteOfDay(paceMinute)}
          </span>
        )}

        {/* The invitation. The glass is a button the size of the page's
            hero, and the hover wash is the only "pressable" it wears — the
            hint does the rest, but only while the tank has nothing to show. */}
        <span
          aria-hidden
          className="bg-foreground/0 group-hover:bg-foreground/[0.045] pointer-events-none absolute inset-0 rounded-xl transition-colors duration-150"
        />
        {shown === 0 && (
          <span
            aria-hidden
            className="animate-rise pointer-events-none absolute inset-x-0 top-[36%] flex justify-center"
          >
            <span className="bg-background/85 border-border/60 text-muted-foreground rounded-full border px-3 py-1 text-label backdrop-blur-[2px]">
              Tap anywhere to pour the first glass
            </span>
          </span>
        )}
      </button>

      {/* The day's time, under the glass. The pace line's label says a clock
          time; this is the schedule that time lives in — the reminder window
          as a strip of hours, with a tick at now. The vessel is about volume,
          so the axis lives outside it. */}
      <div aria-hidden className="relative h-5">
        <div className="border-border/70 absolute inset-x-0 top-0 border-t" />
        {rulerHours.map((minute, index) => {
          const pos = rulerPos(minute);
          if (nowPos !== null && Math.abs(pos - nowPos) < 5) return null;
          const first = index === 0;
          const last = index === rulerHours.length - 1;
          return (
            <span
              key={minute}
              className={cn(
                "text-muted-foreground/70 absolute top-1 font-mono text-[0.625rem] tabular-nums",
                first ? "left-0" : last ? "right-0" : "-translate-x-1/2",
              )}
              style={first || last ? undefined : { left: `${pos}%` }}
            >
              {formatMinuteOfDay(minute)}
            </span>
          );
        })}
        {nowPos !== null && (
          <>
            <div
              className="bg-primary absolute top-0 h-2 w-px"
              style={{ left: `${nowPos}%` }}
            />
            <span
              className="text-primary absolute top-1 -translate-x-1/2 font-mono text-[0.625rem] font-medium tabular-nums"
              style={{ left: `${nowPos}%` }}
            >
              {formatMinuteOfDay(nowMinute)}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <p
          aria-live="polite"
          className="text-display font-mono leading-none tabular-nums"
        >
          <span
            key={popKey}
            className={cn("inline-block", popKey > 0 && "animate-pop")}
          >
            {shown}
          </span>
          <span className="text-muted-foreground">/{goal}</span>
        </p>
        <p
          className={cn(
            "text-label",
            shown >= goal ? "text-primary" : "text-muted-foreground",
          )}
        >
          {status}
        </p>
      </div>
    </div>
  );
}

/** Minutes since midnight, in the user's timezone. */
function minuteOfDayNow(timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return value("hour") * 60 + value("minute");
}
