"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, Square, Vibrate, VibrateOff, Volume2, VolumeX } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWakeLock } from "@/components/use-wake-lock";
import { cn } from "@/lib/utils";
import { SCENES, stageAt, stageIdsAt, stageLine, wholeLine } from "@/lib/scenes";
import { TEND_DAYS, type Tending } from "@/lib/tending";
import {
  breathAt,
  dhikrAt,
  dhikrSteps,
  dhikrTotal,
  formatTimer,
  howText,
  meditationTitle,
  normalizeOptions,
  plannedSeconds,
  promptAt,
  type Meditation,
  type MeditationOptions,
} from "@/lib/meditations";

import { GardenScene } from "./garden-scene";
import { bead, bell, breathCue, buzz, readPrefs, writePrefs, type SoundPrefs } from "./sound";

export type SessionResult = { seconds: number; count: number | null; completed: boolean; startedAt: Date };

type Stage = "settle" | "run" | "confirm" | "done";

/** Shorter than this and an ended session isn't worth a row. */
const MIN_KEEP_SECONDS = 10;
const SETTLE_SECONDS = 3;
const BEADS_PER_RING = 33;

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One sitting, full screen, over the garden.
 *
 * Time is the wall clock: elapsed = what was banked before the last pause +
 * now since resuming. A requestAnimationFrame loop asks the pure engine in
 * lib/meditations.ts where that lands and writes the orb's size, the tracing
 * dot and the garden's breath straight onto the DOM through refs; React only
 * re-renders when a phase, a second or a prompt changes. A tab that sleeps
 * and wakes lands on the right breath instead of drifting.
 */
export function MeditationSession({
  meditation,
  options: rawOptions,
  tending,
  onSave,
  onClose,
}: {
  meditation: Meditation;
  options: MeditationOptions;
  /** The garden before this sitting: what it shows, and what today would do. */
  tending: Tending;
  onSave: (result: SessionResult) => Promise<boolean>;
  onClose: () => void;
}) {
  const options = normalizeOptions(meditation, rawOptions);
  const planned = plannedSeconds(meditation, options);
  const pattern = meditation.pattern?.(options) ?? [];
  const steps = meditation.mode === "dhikr" ? dhikrSteps(options) : [];
  const title = meditationTitle(meditation, options);
  const reduced = useSyncExternalStore(subscribeMotion, reducedMotion, () => false);

  const [stage, setStage] = useState<Stage>("settle");
  const [settle, setSettle] = useState(SETTLE_SECONDS);
  const [paused, setPaused] = useState(false);
  const [second, setSecond] = useState(0);
  const [phase, setPhase] = useState({ index: 0, cycle: 0, countdown: pattern[0]?.seconds ?? 0 });
  const [prompt, setPrompt] = useState(0);
  const [taps, setTaps] = useState(0);
  const [breaths, setBreaths] = useState({ current: 0, rounds: 0, lost: false });
  const [prefs, setPrefs] = useState<SoundPrefs>(readPrefs);
  const [result, setResult] = useState<{ seconds: number; completed: boolean; status: "saving" | "saved" | "error" | "short" } | null>(null);

  const banked = useRef(0);
  const resumedAt = useRef<number | null>(null);
  const startedAt = useRef<Date | null>(null);
  const last = useRef({ index: -1, cycle: -1, shown: "", second: -1, prompt: -1, bell: 0 });
  const prefsRef = useRef(prefs);
  const tapsRef = useRef(0);
  const breathsRef = useRef(breaths);
  const finished = useRef(false);

  const scene = useRef<HTMLDivElement>(null);
  const orb = useRef<HTMLDivElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const track = useRef<SVGPathElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useWakeLock(stage === "run" && !paused);

  const elapsedMs = () => banked.current + (resumedAt.current === null ? 0 : performance.now() - resumedAt.current);

  const setPref = (key: keyof SoundPrefs) => {
    const next = { ...prefsRef.current, [key]: !prefsRef.current[key] };
    prefsRef.current = next;
    setPrefs(next);
    writePrefs(next);
  };

  // ---- finishing
  const finish = (completed: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (resumedAt.current !== null) {
      banked.current += performance.now() - resumedAt.current;
      resumedAt.current = null;
    }
    const seconds = Math.max(1, Math.round(banked.current / 1000));
    const count =
      meditation.mode === "dhikr" ? tapsRef.current : meditation.mode === "count" ? breathsRef.current.rounds : null;
    setStage("done");
    if (prefsRef.current.sound) void bell(1);
    if (prefsRef.current.haptics) buzz([30, 60, 30]);
    // A finished session is always kept (a quick dhikr is still a dhikr); one
    // ended in its first seconds isn't.
    if (!completed && seconds < MIN_KEEP_SECONDS) {
      setResult({ seconds, completed, status: "short" });
      return;
    }
    setResult({ seconds, completed, status: "saving" });
    void onSave({ seconds, count, completed, startedAt: startedAt.current ?? new Date() }).then((ok) =>
      setResult({ seconds, completed, status: ok ? "saved" : "error" }),
    );
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  // ---- settling in: 3, 2, 1
  useEffect(() => {
    if (stage !== "settle") return;
    if (settle <= 0) {
      const timer = setTimeout(() => {
        startedAt.current = new Date();
        banked.current = 0;
        resumedAt.current = performance.now();
        setStage("run");
        if (prefsRef.current.sound) void bell(0.8);
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setSettle((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [stage, settle]);

  // ---- the loop
  useEffect(() => {
    if (stage !== "run" || paused) return;
    let frame = 0;
    const step = () => {
      const ms = elapsedMs();
      const seconds = Math.floor(ms / 1000);

      if (meditation.mode === "breath" && pattern.length) {
        const moment = breathAt(ms, pattern);
        if (!reduced) {
          orb.current?.style.setProperty("--level", moment.level.toFixed(3));
          scene.current?.style.setProperty("--breath", moment.level.toFixed(3));
          const path = track.current;
          if (path && dot.current) {
            const point = path.getPointAtLength(moment.around * path.getTotalLength());
            dot.current.setAttribute("cx", point.x.toFixed(1));
            dot.current.setAttribute("cy", point.y.toFixed(1));
          }
        }
        if (bar.current) bar.current.style.transform = `scaleX(${moment.progress.toFixed(3)})`;
        const l = last.current;
        if (moment.index !== l.index || moment.cycle !== l.cycle) {
          l.index = moment.index;
          l.cycle = moment.cycle;
          if (prefsRef.current.sound) void breathCue(moment.phase.cue);
          if (prefsRef.current.haptics) buzz(moment.phase.cue === "in" ? 24 : moment.phase.cue === "out" ? [12, 40, 12] : 8);
        }
        const shown = `${moment.index}-${moment.cycle}-${moment.countdown}`;
        if (shown !== l.shown) {
          l.shown = shown;
          setPhase({ index: moment.index, cycle: moment.cycle, countdown: moment.countdown });
        }
      } else if (!reduced) {
        // Everything else breathes slowly on its own: one long swell every ten seconds.
        const swell = 0.5 - Math.cos((ms / 10_000) * 2 * Math.PI) / 2;
        scene.current?.style.setProperty("--breath", swell.toFixed(3));
      }

      if (meditation.mode === "guided" && meditation.script) {
        const index = promptAt(ms, meditation.script, planned);
        if (index !== last.current.prompt) {
          if (last.current.prompt !== -1 && prefsRef.current.sound) void bell(0.45);
          last.current.prompt = index;
          setPrompt(index);
        }
      }

      if (meditation.mode === "silent" && options.bell) {
        const every = options.bell * 60_000;
        const due = Math.floor(ms / every);
        if (due > last.current.bell) {
          last.current.bell = due;
          if (prefsRef.current.sound) void bell(0.6);
          if (prefsRef.current.haptics) buzz(30);
        }
      }

      if (seconds !== last.current.second) {
        last.current.second = seconds;
        setSecond(seconds);
      }

      if (planned > 0 && ms >= planned * 1000) {
        finishRef.current(true);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // The pattern and options are fixed for a session; the component is keyed by them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paused, reduced]);

  // ---- pausing, ending
  const pause = () => {
    if (resumedAt.current === null) return;
    banked.current += performance.now() - resumedAt.current;
    resumedAt.current = null;
    setPaused(true);
  };
  const resume = () => {
    if (resumedAt.current !== null) return;
    resumedAt.current = performance.now();
    setPaused(false);
  };
  const askToEnd = () => {
    pause();
    setStage("confirm");
  };
  const keepSitting = () => {
    setStage("run");
    resume();
  };

  // ---- tapping: dhikr beads and counted breaths
  const tap = () => {
    if (stage !== "run" || paused) return;
    if (meditation.mode === "dhikr") {
      const next = tapsRef.current + 1;
      tapsRef.current = next;
      setTaps(next);
      const at = dhikrAt(next, steps);
      const stepEnded = at.done || at.inStep === 0;
      if (prefsRef.current.sound) void bead(stepEnded);
      if (prefsRef.current.haptics) buzz(stepEnded ? [20, 40, 20] : 6);
      if (at.done) finishRef.current(true);
    } else if (meditation.mode === "count") {
      const prev = breathsRef.current;
      const current = prev.current >= 10 ? 1 : prev.current + 1;
      const next = { current, rounds: prev.rounds + (current === 10 ? 1 : 0), lost: false };
      breathsRef.current = next;
      setBreaths(next);
      if (prefsRef.current.sound) void bead(current === 10);
      if (prefsRef.current.haptics) buzz(current === 10 ? [20, 40, 20] : 6);
    }
  };
  const lostCount = () => {
    if (stage !== "run" || paused) return;
    const next = { current: 0, rounds: breathsRef.current.rounds, lost: true };
    breathsRef.current = next;
    setBreaths(next);
    if (prefsRef.current.sound) void breathCue("hold-out");
  };

  // Space and Enter tap (dhikr, counting) or pause (everything else).
  useEffect(() => {
    if (stage !== "run") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      // A focused button or field answers its own Space and Enter: the tap
      // target counts, Pause pauses, and nothing fires twice.
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, input, textarea, select")) return;
      event.preventDefault();
      if (meditation.mode === "dhikr" || meditation.mode === "count") tap();
      else if (paused) resume();
      else pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- what to show
  const remaining = planned > 0 ? Math.max(0, planned - second) : second;
  const cycles = pattern.length ? Math.round(planned / pattern.reduce((s, p) => s + p.seconds, 0)) : 0;
  // A kept sitting counts for today: the garden grows if the day leaving its
  // window was a miss, and holds if it was kept. A second sitting changes nothing.
  const counted = Boolean(result && result.status !== "short");
  const after = counted && !tending.today ? tending.ifDone : tending.level;
  const grown = stageIdsAt(SCENES.meditate, after).slice(tending.level);
  const brought = after > tending.level ? stageAt(SCENES.meditate, after) : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open) return;
        if (stage === "run") askToEnd();
        else if (stage === "confirm") keepSitting();
        else if (stage === "settle") onClose();
        else onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none bg-[var(--garden-sky-1)] p-0 text-white ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{howText(meditation, options)}</DialogDescription>

        <div ref={scene} className="absolute inset-0" aria-hidden>
          <GardenScene
            level={stage === "done" ? after : tending.level}
            fresh={stage === "done" ? grown : []}
            label={false}
            className="absolute inset-0"
          />
          <div
            className={cn(
              "absolute inset-0 bg-[var(--garden-veil)] transition-opacity duration-1000",
              stage === "done" && "opacity-40",
            )}
          />
        </div>

        <div className="relative flex h-full flex-col">
          {/* Top: what, how long, sound. */}
          <header className="flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
            <p className="min-w-0 truncate pt-2 text-sm font-medium text-white/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">{title}</p>
            {(stage === "run" || stage === "confirm") && (
              <p
                className="font-display text-4xl leading-none tabular-nums [text-shadow:0_2px_16px_rgba(0,0,0,0.35)] sm:text-5xl"
                aria-label={planned > 0 ? `${formatTimer(remaining)} left` : `${formatTimer(remaining)} so far`}
              >
                {formatTimer(remaining)}
              </p>
            )}
            <div className="flex shrink-0 items-center gap-1">
              <GlassIcon label={prefs.sound ? "Turn sound off" : "Turn sound on"} onClick={() => setPref("sound")}>
                {prefs.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </GlassIcon>
              <GlassIcon label={prefs.haptics ? "Turn vibration off" : "Turn vibration on"} onClick={() => setPref("haptics")}>
                {prefs.haptics ? <Vibrate className="size-4" /> : <VibrateOff className="size-4" />}
              </GlassIcon>
            </div>
          </header>

          {/* Centre. */}
          <main className="grid min-h-0 flex-1 place-items-center px-4">
            {stage === "settle" && (
              <div className="flex max-w-md flex-col items-center gap-5 text-center">
                <p className="text-sm tracking-wide text-white/75">Settle in</p>
                <p className="font-display text-8xl leading-none tabular-nums [text-shadow:0_4px_30px_rgba(0,0,0,0.35)]" aria-live="polite">
                  {Math.max(1, settle)}
                </p>
                <p className="text-base leading-relaxed text-white/85">{howText(meditation, options)}</p>
              </div>
            )}

            {(stage === "run" || stage === "confirm") && meditation.mode === "breath" && pattern.length > 0 && (
              <div className="flex flex-col items-center gap-6">
                <div className="relative size-[min(68vmin,400px)]">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
                    <path
                      ref={track}
                      d={
                        meditation.shape === "box"
                          ? "M6 94 L6 6 L94 6 L94 94 Z"
                          : meditation.shape === "triangle"
                            ? "M8 88 L50 10 L92 88 Z"
                            : "M50 4 A46 46 0 1 1 49.99 4 Z"
                      }
                      fill="none"
                      stroke="rgba(255,255,255,0.28)"
                      strokeWidth={0.8}
                      strokeLinejoin="round"
                    />
                    {!reduced && <circle ref={dot} r={2.2} fill="white" style={{ filter: "drop-shadow(0 0 3px white)" }} />}
                  </svg>
                  <div
                    ref={orb}
                    className={cn(
                      "meditation-orb absolute inset-[14%] grid place-items-center rounded-full",
                      reduced && "[--level:0.75]",
                    )}
                  >
                    <span className="font-display text-6xl leading-none text-[#2b2150] tabular-nums sm:text-7xl">
                      {phase.countdown}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="font-display text-4xl leading-tight [text-shadow:0_2px_18px_rgba(0,0,0,0.4)] sm:text-5xl" aria-live="polite">
                    {pattern[phase.index]?.label}
                  </p>
                  <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
                    <div ref={bar} className="h-full origin-left rounded-full bg-white/80" style={{ transform: "scaleX(0)" }} />
                  </div>
                  <p className="text-sm text-white/70 tabular-nums">
                    Breath {Math.min(phase.cycle + 1, cycles)} of {cycles}
                  </p>
                </div>
              </div>
            )}

            {(stage === "run" || stage === "confirm") && meditation.mode === "dhikr" && (
              <DhikrFace taps={taps} steps={steps} onTap={tap} disabled={paused} />
            )}

            {(stage === "run" || stage === "confirm") && meditation.mode === "count" && (
              <div className="flex flex-col items-center gap-6 text-center">
                <button
                  type="button"
                  onClick={tap}
                  disabled={paused}
                  autoFocus
                  className="grid size-[min(60vmin,320px)] place-items-center rounded-full border border-white/25 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-sm transition-transform focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none active:scale-[0.97]"
                  aria-label={`Count this breath. You're on ${breaths.current} of 10.`}
                >
                  <span className="flex flex-col items-center gap-1">
                    <span className="font-display text-8xl leading-none tabular-nums" aria-live="polite">
                      {breaths.current || "·"}
                    </span>
                    <span className="text-sm text-white/75">
                      {breaths.lost ? "Back to one" : breaths.current === 0 ? "Tap on each out-breath" : "of 10"}
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-3">
                  <GlassButton onClick={lostCount} disabled={paused}>
                    Lost count
                  </GlassButton>
                  <p className="text-sm text-white/70 tabular-nums">
                    {breaths.rounds} {breaths.rounds === 1 ? "round" : "rounds"} of ten
                  </p>
                </div>
              </div>
            )}

            {(stage === "run" || stage === "confirm") && meditation.mode === "guided" && meditation.script && (
              <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
                <p
                  key={prompt}
                  className="font-display animate-in fade-in text-3xl leading-snug duration-1000 [text-shadow:0_2px_18px_rgba(0,0,0,0.45)] sm:text-4xl"
                  aria-live="polite"
                >
                  {meditation.script[prompt]}
                </p>
                <div className="flex gap-1.5" aria-hidden>
                  {meditation.script.map((_, i) => (
                    <span key={i} className={cn("size-1.5 rounded-full", i <= prompt ? "bg-white/85" : "bg-white/25")} />
                  ))}
                </div>
              </div>
            )}

            {(stage === "run" || stage === "confirm") && meditation.mode === "silent" && (
              <p className="max-w-md text-center text-lg text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]">
                {options.bell ? `A bell every ${options.bell} minutes. ` : ""}Let things come and go.
              </p>
            )}

            {stage === "done" && result && (
              <div className="w-[min(28rem,100%)] rounded-3xl border border-white/20 bg-white/12 p-6 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-md sm:p-8">
                <p className="text-sm text-white/75">{result.completed ? "Session complete" : "Ended early"}</p>
                <p className="font-display mt-2 text-4xl leading-tight">
                  {result.status === "short" ? "Just a moment" : `You sat for ${sat(result.seconds)}`}
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {result.status === "short"
                    ? "Under ten seconds isn't kept. Come back whenever you like."
                    : meditation.mode === "dhikr"
                      ? `${taps} remembered.`
                      : meditation.mode === "count"
                        ? `${breaths.rounds} ${breaths.rounds === 1 ? "round" : "rounds"} of ten breaths.`
                        : "Today's sitting is in the garden."}
                </p>
                {counted && (
                  <div className="mt-5 space-y-2">
                    {brought ? (
                      <>
                        <p className="text-sm font-medium">The garden grew</p>
                        <p className="mx-auto w-fit rounded-full border border-white/30 bg-white/15 px-3 py-1 text-sm">
                          {brought.name.charAt(0).toUpperCase() + brought.name.slice(1)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-medium">
                        {tending.today ? "The garden is kept for today." : "Today keeps the garden as it is."}
                      </p>
                    )}
                    <p className="text-xs text-white/70">
                      {after === TEND_DAYS ? wholeLine(SCENES.meditate) : stageLine(after)}
                    </p>
                  </div>
                )}
                <p className="mt-4 text-xs text-white/70" aria-live="polite">
                  {result.status === "saving" ? "Saving…" : result.status === "error" ? "Couldn't save this one. Check your connection." : ""}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  autoFocus
                  className="mt-4 w-full rounded-full bg-white px-6 py-3 font-medium text-[#2b2150] transition-transform focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none active:scale-[0.98]"
                >
                  Done
                </button>
              </div>
            )}
          </main>

          {/* Bottom: pause, end. */}
          <footer className="flex items-center justify-center gap-3 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-8">
            {stage === "settle" && <GlassButton onClick={onClose}>Not now</GlassButton>}
            {stage === "run" && (
              <>
                <GlassButton onClick={paused ? resume : pause} aria-label={paused ? "Resume" : "Pause"}>
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                  {paused ? "Resume" : "Pause"}
                </GlassButton>
                <GlassButton onClick={askToEnd}>
                  <Square className="size-3.5" />
                  End
                </GlassButton>
              </>
            )}
            {stage === "confirm" && (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/20 bg-black/25 px-5 py-4 text-center backdrop-blur-md">
                <p className="text-sm">
                  End now? {second >= MIN_KEEP_SECONDS ? `The ${sat(second)} you've sat will be kept.` : "It's too short to keep yet."}
                </p>
                <div className="flex gap-2">
                  <GlassButton onClick={keepSitting} autoFocus>
                    Keep sitting
                  </GlassButton>
                  <button
                    type="button"
                    onClick={() => finishRef.current(false)}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#2b2150] focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none active:scale-[0.98]"
                  >
                    End session
                  </button>
                </div>
              </div>
            )}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function sat(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function GlassButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-5 py-2.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md transition hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-white/50 focus-visible:outline-none active:scale-[0.98] disabled:opacity-50",
        className,
      )}
    />
  );
}

function GlassIcon({ label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="grid size-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-white/50 focus-visible:outline-none"
    />
  );
}

/** The bead ring: one lap of 33, filling as you tap. */
function DhikrFace({
  taps,
  steps,
  onTap,
  disabled,
}: {
  taps: number;
  steps: ReturnType<typeof dhikrSteps>;
  onTap: () => void;
  disabled: boolean;
}) {
  const at = dhikrAt(taps, steps);
  const step = steps[at.step];
  const per = Math.min(BEADS_PER_RING, step.count);
  const lit = at.inStep === 0 ? 0 : ((at.inStep - 1) % per) + 1;
  const total = dhikrTotal(steps);

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      autoFocus
      aria-label={`${step.phrase}. ${at.inStep} of ${step.count}. Tap to count.`}
      className="group flex flex-col items-center gap-5 rounded-[2.5rem] p-4 text-center focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:outline-none"
    >
      <span className="relative grid size-[min(64vmin,380px)] place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {Array.from({ length: per }).map((_, i) => {
            const angle = (i / per) * 2 * Math.PI - Math.PI / 2;
            const on = i < lit;
            return (
              <circle
                key={i}
                cx={50 + 44 * Math.cos(angle)}
                cy={50 + 44 * Math.sin(angle)}
                r={on ? 3.1 : 2.4}
                fill={on ? "var(--garden-light)" : "rgba(255,255,255,0.25)"}
                style={on ? { filter: "drop-shadow(0 0 2px var(--garden-light))" } : undefined}
              />
            );
          })}
        </svg>
        <span className="flex flex-col items-center gap-1 transition-transform group-active:scale-95">
          <span className="font-display text-8xl leading-none tabular-nums [text-shadow:0_4px_24px_rgba(0,0,0,0.35)]" aria-live="polite">
            {at.inStep}
          </span>
          <span className="text-sm text-white/75 tabular-nums">of {step.count}</span>
        </span>
      </span>
      <span className="flex flex-col items-center gap-1">
        <span className="font-display text-3xl leading-tight sm:text-4xl">{step.phrase}</span>
        {step.meaning && <span className="text-base text-white/80">{step.meaning}</span>}
        <span className="mt-1 text-xs text-white/65 tabular-nums">
          {steps.length > 1 ? `Phrase ${at.step + 1} of ${steps.length} · ` : ""}
          {taps} of {total} · tap anywhere here, or press Space
        </span>
      </span>
    </button>
  );
}
