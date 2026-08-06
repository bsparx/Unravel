"use client";

import { useEffect, useRef } from "react";
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

import {
  intervalTickFractions,
  liveElapsedMs,
  macroProgress,
  microProgress,
  overtimeProgress,
  type ClockState,
  type PlannedInterval,
  type TimerConfig,
} from "@/lib/timer-math";

import { useFaceColors } from "../_hooks/use-face-colors";
import {
  FRAGMENT_SHADER,
  MAX_TICKS,
  TICK_SENTINEL,
  VERTEX_SHADER,
} from "./decay-field.glsl";

/**
 * The work face: two draining containers, rendered per frame.
 *
 * Sized by its container, not by a constant: the wrapper is an aspect-square
 * `w-full max-w-[400px]` that the two SVG faces share, so switching modes
 * never makes the page jump and the canvas shrinks with the column instead of
 * overflowing a phone. The drawing buffer tracks the measured CSS size times
 * the device pixel ratio, so the ring stays crisp at any width.
 */

export type DecayFieldProps = {
  clock: ClockState;
  running: boolean;
  plan: PlannedInterval[];
  intervalIndex: number;
  /** Milliseconds of the session that elapsed before the current interval. */
  intervalBaseMs: number;
  config: TimerConfig;
  dual: boolean;
  /** A break past its time. The live colour goes clay. */
  overrun: boolean;
  /** Fall back to the SVG arc — the GPU took the context away. */
  onContextLost: () => void;
  children?: React.ReactNode;
};

/**
 * The work face: two draining containers, rendered per frame.
 *
 * The one rule that makes this different from the SVG arc it replaces:
 * **React state never drives what is on screen.** The provider re-renders four
 * times a second for the digits, and the arc used to ride on that — a 250ms
 * hold followed by a 300ms eased catch-up, permanently a third of a second
 * behind the truth and visibly stepping. What a person actually saw was an
 * animation standing in for time.
 *
 * Here the loop reads a ref and recomputes elapsed from `Date.now()` itself,
 * every frame. That buys fluidity, but the reason it is worth doing is the
 * same reason `liveElapsedMs` exists at all: because each frame is *derived*
 * rather than advanced, a throttled tab, a dropped frame or a suspended laptop
 * cannot drift the face. It resumes at the truthful value instead of easing
 * toward it. There is no interpolation anywhere in this file.
 */
export function DecayField({
  clock,
  running,
  plan,
  intervalIndex,
  intervalBaseMs,
  config,
  dual,
  overrun,
  onContextLost,
  children,
}: DecayFieldProps) {
  // A container, not a canvas. `forceContextLoss` permanently poisons the
  // element it was called on — a canvas that has had its context force-lost
  // can never be given another one. Reusing a React-owned <canvas> across
  // mounts therefore hands the second renderer a dead context, which is
  // exactly what StrictMode's double-mount does in development and what any
  // remount does in production. So the renderer creates and owns its canvas,
  // and teardown throws the whole element away.
  const containerRef = useRef<HTMLDivElement>(null);
  const colors = useFaceColors();

  // Everything the loop needs, mirrored so it can read current values without
  // being torn down and rebuilt — a loop that restarts on every prop change
  // would drop a frame four times a second, which is the exact artefact this
  // component exists to remove.
  const propsRef = useRef({
    clock,
    running,
    plan,
    intervalIndex,
    intervalBaseMs,
    config,
    dual,
    overrun,
    colors,
  });
  // Synced in an effect rather than assigned during render, which React 19
  // rejects outright. Being one frame behind on these costs nothing: they are
  // configuration, and the number that actually moves is read from
  // `Date.now()` inside the loop, not from here.
  useEffect(() => {
    propsRef.current = {
      clock,
      running,
      plan,
      intervalIndex,
      intervalBaseMs,
      config,
      dual,
      overrun,
      colors,
    };
  });

  const drawRef = useRef<(() => void) | null>(null);
  const kickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        alpha: true,
        antialias: false, // The edges are analytic; MSAA would only cost fill.
        powerPreference: "low-power",
      });
    } catch {
      onContextLost();
      return;
    }

    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    const uniforms = {
      uMacro: { value: 1 },
      uMicro: { value: 1 },
      uOvertime: { value: 0 },
      uTime: { value: 0 },
      uFlourish: { value: 1 },
      uDual: { value: dual ? 1 : 0 },
      uResolution: { value: new Vector2(1, 1) },
      uRun: { value: new Vector3(...colors.running) },
      uTrack: { value: new Vector3(...colors.track) },
      uTicks: { value: new Array<number>(MAX_TICKS).fill(TICK_SENTINEL) },
    };

    const scene = new Scene();
    // The vertex shader writes clip space directly, so the camera exists only
    // because `render` demands one.
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new PlaneGeometry(2, 2);
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    scene.add(new Mesh(geometry, material));

    // The depletion itself stays fluid under reduced motion: it is the
    // quantity being measured, not decoration. Only the grain drift stops.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyFlourish = () => {
      uniforms.uFlourish.value = reduced.matches ? 0 : 1;
    };
    applyFlourish();

    const mountedAt = performance.now();

    const draw = () => {
      const p = propsRef.current;

      const elapsedMs = liveElapsedMs(p.clock);
      // Seconds as a float, deliberately unfloored. `elapsedSeconds` in the
      // provider is floored for the digits, which is right there and would
      // reintroduce a one-second staircase here.
      const elapsedSeconds = elapsedMs / 1000;
      const intervalSeconds = Math.max(0, elapsedMs - p.intervalBaseMs) / 1000;

      const interval = p.plan[Math.min(p.intervalIndex, p.plan.length - 1)];

      uniforms.uMacro.value = macroProgress(elapsedSeconds, p.plan);
      uniforms.uMicro.value = microProgress(intervalSeconds, interval);
      uniforms.uOvertime.value = overtimeProgress(
        elapsedSeconds,
        p.config.targetSeconds,
      );
      uniforms.uDual.value = p.dual ? 1 : 0;
      uniforms.uTime.value = (performance.now() - mountedAt) / 1000;

      // The running blue means work is on the clock. During a break the live
      // colour is teal — the reservation in `design-notes.md` has to survive
      // the move into a shader, where nothing would ever catch it going wrong.
      // The running blue is reserved for work on the clock and the teal for a
      // break; a break that has stopped being a break gets neither, because
      // wearing either one would make the state you need to notice look like
      // one of the two you don't.
      const live = p.overrun
        ? p.colors.overrun
        : interval && interval.kind !== "FOCUS"
          ? p.colors.rest
          : p.colors.running;
      uniforms.uRun.value.set(...live);
      uniforms.uTrack.value.set(...p.colors.track);

      const ticks = intervalTickFractions(p.plan);
      for (let i = 0; i < MAX_TICKS; i += 1) {
        uniforms.uTicks.value[i] = i < ticks.length ? ticks[i] : TICK_SENTINEL;
      }

      renderer.render(scene, camera);
    };

    drawRef.current = draw;

    // The frame loop. It re-reads `running` from the ref each frame rather
    // than closing over it, so starting and stopping never rebuilds the
    // context.
    let frame = 0;
    const loop = () => {
      draw();
      if (propsRef.current.running) frame = requestAnimationFrame(loop);
      else frame = 0; // Drew the final frame; a stopped clock has nothing to animate.
    };

    // Idempotent, so it is safe to call from anywhere that might need to wake
    // the loop. Owning this here rather than in the effect below is what keeps
    // the loop from depending on effect ordering: an effect that only knows
    // how to *start* on a change would never recover if it happened to run
    // before this one had published `draw`.
    const kick = () => {
      if (!frame && propsRef.current.running) frame = requestAnimationFrame(loop);
    };
    kickRef.current = kick;

    // rAF is throttled to a crawl in a hidden tab. Because every frame is
    // derived from Date.now() the face is never *wrong* while away — it simply
    // stops updating — so one frame on return is all it takes to catch up, and
    // it lands on the truthful value rather than easing toward it.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      draw();
      kick();
    };

    // Tearing down calls `forceContextLoss`, which fires this same event. Only
    // a loss we did not ask for means the GPU has actually taken the context
    // away; without this flag the component reports its own cleanup as a
    // failure and falls back to the SVG arc permanently — immediately under
    // StrictMode, and on the first navigation away from /timer in production.
    let disposing = false;

    const onLost = (event: Event) => {
      event.preventDefault();
      if (disposing) return;
      onContextLost();
    };

    const resize = () => {
      // The wrapper is `w-full max-w-[400px]` and square, so one measurement
      // is the whole size. Measured rather than assumed: the face mounts
      // inside a column whose width depends on the sidebar state.
      const width = container.clientWidth;
      if (width <= 0) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, width, false);
      const buffer = renderer.getDrawingBufferSize(new Vector2());
      uniforms.uResolution.value.set(buffer.x, buffer.y);
      draw();
    };
    resize();
    // The column can resize without the window doing so — the sidebar
    // collapsing is the obvious case — so the buffer tracks the container,
    // not the viewport.
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    // A face that mounts mid-session is already running, so it must not wait
    // for `running` to *change* before it starts moving.
    kick();

    canvas.addEventListener("webglcontextlost", onLost);
    document.addEventListener("visibilitychange", onVisible);
    reduced.addEventListener("change", applyFlourish);

    return () => {
      disposing = true;
      if (frame) cancelAnimationFrame(frame);
      drawRef.current = null;
      kickRef.current = null;
      canvas.removeEventListener("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", onVisible);
      reduced.removeEventListener("change", applyFlourish);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      // Without this the context survives the unmount, and a browser caps how
      // many it will hand out — a dozen navigations in and the face goes dark.
      renderer.forceContextLoss();
      canvas.remove();
    };
    // Built once and only once. Every value the loop needs arrives through
    // `propsRef`, so rebuilding the context on a prop change would be pure
    // cost. `onContextLost` is a stable callback from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Starting is a kick; stopping needs nothing, because the loop notices the
  // flag itself on the next frame and draws one final time on its way out. A
  // frozen face is correct and costs nothing — a paused timer has nothing to
  // animate, and an idle one is meant to be completely still.
  useEffect(() => {
    if (running) kickRef.current?.();
  }, [running]);

  // Config, plan and palette all change without the clock moving — a stopped
  // face has no loop running to pick them up, so redraw explicitly.
  useEffect(() => {
    if (!running) drawRef.current?.();
  }, [colors, config, dual, intervalIndex, overrun, plan, running]);

  return (
    <div className="relative isolate @container aspect-square w-full max-w-[400px]">
      <div ref={containerRef} className="absolute inset-0" aria-hidden />
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
