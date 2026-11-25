/**
 * The meditations on /mind, as data and arithmetic. Nothing here touches the
 * DOM or the clock: the session component asks "where are we at this many
 * milliseconds?", so a backgrounded tab that wakes late lands on the right
 * breath instead of drifting.
 */

export type Level = "easy" | "medium" | "hard";
export type Family = "breathing" | "dhikr" | "guided" | "stillness";
export type Mode = "breath" | "dhikr" | "guided" | "count" | "silent";
export type Cue = "in" | "hold-in" | "out" | "hold-out";

export type BreathPhase = {
  cue: Cue;
  label: string;
  seconds: number;
  /** How full the orb is at the end of the phase, 0 to 1. */
  to: number;
};

export type DhikrSetId = "tasbih" | "istighfar" | "tahlil" | "salawat" | "custom";

export type MeditationOptions = {
  /** Box and triangle sides, resonant in/out: 4 to 8. */
  n?: number;
  /** Longer exhale: the out-breath, 6 to 8. */
  out?: number;
  /** Timed meditations. */
  minutes?: number;
  set?: DhikrSetId;
  /** Custom dhikr. */
  phrase?: string;
  target?: number;
  /** Open awareness: a bell every this many minutes, 0 for none. */
  bell?: number;
};

export type Meditation = {
  id: string;
  name: string;
  family: Family;
  mode: Mode;
  /** One line, on the card. */
  blurb: string;
  /** How to do it, in the card's help popover. */
  how: string;
  level: (options: MeditationOptions) => Level;
  /** Which controls the setup shows, and their bounds. */
  controls: {
    n?: { min: number; max: number; label: string };
    out?: { min: number; max: number; label: string };
    minutes?: boolean;
    dhikr?: boolean;
    bell?: boolean;
  };
  defaults: MeditationOptions;
  /** What the breath guide traces. */
  shape?: "circle" | "box" | "triangle";
  pattern?: (options: MeditationOptions) => BreathPhase[];
  /** Guided prompts, spread evenly over the session. */
  script?: readonly string[];
};

export const N_MIN = 4;
export const N_MAX = 8;
export const MINUTE_CHOICES = [1, 3, 5, 10, 15, 20, 30] as const;
/** Beyond the presets, any whole number of minutes in this range can be typed in. */
export const MINUTES_MIN = 1;
export const MINUTES_MAX = 90;
export const DHIKR_TARGETS = [33, 99, 100, 1000] as const;
export const BELL_CHOICES = [0, 2, 5, 10] as const;
/** Longest sitting the log keeps. */
export const MAX_SESSION_SECONDS = 3 * 60 * 60;
export const PHRASE_MAX = 80;

export const LEVELS: Record<Level, { label: string; dots: number; hint: string }> = {
  easy: { label: "Easy", dots: 1, hint: "Gentle and short. Good for any day, and for starting out." },
  medium: { label: "Medium", dots: 2, hint: "Asks a little more: longer holds, or more to keep track of." },
  hard: { label: "Hard", dots: 3, hint: "Long holds or long silence. Build up to these." },
};

export const FAMILIES: Record<Family, string> = {
  breathing: "Breathing",
  dhikr: "Dhikr",
  guided: "Guided",
  stillness: "Stillness",
};

export function clampN(n: unknown, min = N_MIN, max = N_MAX, fallback = N_MIN): number {
  const value = Math.round(Number(n));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const inhale = (seconds: number, to = 1, label = "Breathe in"): BreathPhase => ({ cue: "in", label, seconds, to });
const exhale = (seconds: number, label = "Breathe out"): BreathPhase => ({ cue: "out", label, seconds, to: 0 });
const holdIn = (seconds: number): BreathPhase => ({ cue: "hold-in", label: "Hold", seconds, to: 1 });
const holdOut = (seconds: number): BreathPhase => ({ cue: "hold-out", label: "Hold", seconds, to: 0 });

// ---------------------------------------------------------------- dhikr

export type DhikrStep = { phrase: string; meaning: string; count: number };

/**
 * Transliteration and meaning, no Arabic script: the same choice as the du'a
 * templates.
 */
export const DHIKR_SETS: Record<Exclude<DhikrSetId, "custom">, { name: string; steps: DhikrStep[] }> = {
  tasbih: {
    name: "Tasbih after prayer",
    steps: [
      { phrase: "SubhanAllah", meaning: "Glory be to God", count: 33 },
      { phrase: "Alhamdulillah", meaning: "All praise is for God", count: 33 },
      { phrase: "Allahu Akbar", meaning: "God is the greatest", count: 34 },
    ],
  },
  istighfar: {
    name: "Istighfar",
    steps: [{ phrase: "Astaghfirullah", meaning: "I seek God's forgiveness", count: 100 }],
  },
  tahlil: {
    name: "Tahlil",
    steps: [{ phrase: "La ilaha illallah", meaning: "There is no god but God", count: 100 }],
  },
  salawat: {
    name: "Salawat",
    steps: [{ phrase: "Allahumma salli ala Muhammad", meaning: "O God, send blessings upon Muhammad", count: 100 }],
  },
};

export function dhikrSteps(options: MeditationOptions): DhikrStep[] {
  const set = options.set ?? "tasbih";
  if (set === "custom") {
    const phrase = (options.phrase ?? "").trim().slice(0, PHRASE_MAX) || "Your dhikr";
    return [{ phrase, meaning: "", count: clampN(options.target, 1, 1000, 33) }];
  }
  return DHIKR_SETS[set]?.steps ?? DHIKR_SETS.tasbih.steps;
}

/** Which step a running total of taps is on, and how far into it. */
export function dhikrAt(taps: number, steps: readonly DhikrStep[]): { step: number; inStep: number; done: boolean } {
  let left = Math.max(0, Math.floor(taps));
  for (let step = 0; step < steps.length; step += 1) {
    if (left < steps[step].count) return { step, inStep: left, done: false };
    left -= steps[step].count;
  }
  const last = steps.length - 1;
  return { step: last, inStep: steps[last].count, done: true };
}

export function dhikrTotal(steps: readonly DhikrStep[]): number {
  return steps.reduce((sum, step) => sum + step.count, 0);
}

// ---------------------------------------------------------------- the catalog

const BODY_SCAN = [
  "Settle in. Notice where your body meets the floor or the chair.",
  "Bring your attention to the top of your head.",
  "Your forehead and your eyes. Let them soften.",
  "Your jaw. Let your teeth part a little.",
  "Your neck and shoulders. Let them drop.",
  "Down your arms, all the way to your fingertips.",
  "Your chest, rising and falling on its own.",
  "Your belly. Let it be soft.",
  "Your hips, and the weight of your legs.",
  "Your feet. Every toe.",
  "Now the whole body at once, breathing.",
] as const;

const LOVING_KINDNESS = [
  "Begin with yourself. May I be safe. May I be well. May I be at ease.",
  "Someone dear to you. Picture them. May you be safe. May you be well. May you be at ease.",
  "Someone you barely know: a neighbour, a cashier. May you be safe. May you be well. May you be at ease.",
  "Everyone, everywhere. May all be safe. May all be well. May all be at ease.",
] as const;

export const MEDITATIONS: readonly Meditation[] = [
  {
    id: "resonant",
    name: "Resonant breathing",
    family: "breathing",
    mode: "breath",
    blurb: "Breathe in and out for the same count, slow and even.",
    how: "In through the nose for the count, out for the same count, no holds. Five in and five out is about six breaths a minute, the pace that most calms the heart.",
    level: () => "easy",
    controls: { n: { min: 4, max: 7, label: "Seconds each way" }, minutes: true },
    defaults: { n: 5, minutes: 5 },
    shape: "circle",
    pattern: (o) => {
      const n = clampN(o.n, 4, 7, 5);
      return [inhale(n), exhale(n)];
    },
  },
  {
    id: "longer-exhale",
    name: "Longer exhale",
    family: "breathing",
    mode: "breath",
    blurb: "In for four, out for longer. The out-breath slows you down.",
    how: "Breathe in for four, then let the breath out slowly for six to eight, as if through a straw. A longer out-breath is the body's own brake.",
    level: () => "easy",
    controls: { out: { min: 6, max: 8, label: "Seconds out" }, minutes: true },
    defaults: { out: 6, minutes: 3 },
    shape: "circle",
    pattern: (o) => [inhale(4), exhale(clampN(o.out, 6, 8, 6))],
  },
  {
    id: "sigh",
    name: "Physiological sigh",
    family: "breathing",
    mode: "breath",
    blurb: "Two breaths in, one long breath out. Quick relief.",
    how: "A full breath in through the nose, then a short second sip on top, then a long, slow breath out through the mouth. A few rounds settle a racing mind fast.",
    level: () => "easy",
    controls: { minutes: true },
    defaults: { minutes: 1 },
    shape: "circle",
    pattern: () => [inhale(2, 0.78), inhale(1, 1, "A little more"), exhale(6, "Long breath out")],
  },
  {
    id: "box",
    name: "Box breathing",
    family: "breathing",
    mode: "breath",
    blurb: "In, hold, out, hold, each for the same count. The four sides of a box.",
    how: "Breathe in for n, hold for n, breathe out for n, hold empty for n, and trace a square in your mind. Four is gentle; eight takes practice.",
    level: (o) => {
      const n = clampN(o.n);
      return n <= 4 ? "easy" : n <= 6 ? "medium" : "hard";
    },
    controls: { n: { min: N_MIN, max: N_MAX, label: "Seconds per side" }, minutes: true },
    defaults: { n: 4, minutes: 5 },
    shape: "box",
    pattern: (o) => {
      const n = clampN(o.n);
      return [inhale(n), holdIn(n), exhale(n), holdOut(n)];
    },
  },
  {
    id: "triangle",
    name: "Triangle breathing",
    family: "breathing",
    mode: "breath",
    blurb: "In, hold, out, each for the same count. Three sides, no empty hold.",
    how: "Breathe in for n, hold for n, breathe out for n, and start again. Without the empty hold it's a step easier than the box at the same count.",
    level: (o) => (clampN(o.n) <= 5 ? "medium" : "hard"),
    controls: { n: { min: N_MIN, max: N_MAX, label: "Seconds per side" }, minutes: true },
    defaults: { n: 5, minutes: 5 },
    shape: "triangle",
    pattern: (o) => {
      const n = clampN(o.n);
      return [inhale(n), holdIn(n), exhale(n)];
    },
  },
  {
    id: "4-7-8",
    name: "4-7-8 breathing",
    family: "breathing",
    mode: "breath",
    blurb: "In for 4, hold for 7, out for 8. A wind-down before sleep.",
    how: "Breathe in quietly through the nose for 4, hold for 7, then breathe out through the mouth for 8. If the hold is hard, keep the ratio and go faster.",
    level: () => "medium",
    controls: { minutes: true },
    defaults: { minutes: 3 },
    shape: "circle",
    pattern: () => [inhale(4), holdIn(7), exhale(8)],
  },
  {
    id: "dhikr",
    name: "Dhikr",
    family: "dhikr",
    mode: "dhikr",
    blurb: "Remembrance, counted on a ring of beads. Tap for each one.",
    how: "Say the phrase, aloud or under your breath, and tap anywhere (or press Space) for each one. The ring fills like a string of tasbih beads and moves to the next phrase on its own.",
    level: () => "easy",
    controls: { dhikr: true },
    defaults: { set: "tasbih", target: 33 },
  },
  {
    id: "body-scan",
    name: "Body scan",
    family: "guided",
    mode: "guided",
    blurb: "Attention moves slowly from your head down to your toes.",
    how: "Follow each prompt as it appears and rest your attention there until the next one. If you drift, just go back to the part of the body on screen.",
    level: () => "easy",
    controls: { minutes: true },
    defaults: { minutes: 10 },
    script: BODY_SCAN,
  },
  {
    id: "loving-kindness",
    name: "Loving-kindness",
    family: "guided",
    mode: "guided",
    blurb: "Wish yourself well, then someone dear, then someone neutral, then everyone.",
    how: "Repeat the phrases silently and picture who they're for. It may feel flat at first; the wishing is the practice, not the feeling.",
    level: () => "medium",
    controls: { minutes: true },
    defaults: { minutes: 10 },
    script: LOVING_KINDNESS,
  },
  {
    id: "breath-count",
    name: "Breath counting",
    family: "stillness",
    mode: "count",
    blurb: "Count each out-breath from 1 to 10, then start again. Lose count, start at 1.",
    how: "Breathe naturally. Tap (or press Space) on each out-breath and count it. After ten, go back to one. When you notice you've lost count, tap Lost count: noticing is the whole exercise.",
    level: () => "hard",
    controls: { minutes: true },
    defaults: { minutes: 10 },
  },
  {
    id: "open-awareness",
    name: "Open awareness",
    family: "stillness",
    mode: "silent",
    blurb: "Sit in silence and let sounds, thoughts and feelings come and go.",
    how: "No anchor and no counting. Notice whatever arrives, name it if you like (thinking, hearing), and let it pass. An optional bell brings you back every few minutes.",
    level: () => "hard",
    controls: { minutes: true, bell: true },
    defaults: { minutes: 10, bell: 0 },
  },
];

export function findMeditation(id: string | null | undefined): Meditation | null {
  return MEDITATIONS.find((meditation) => meditation.id === id) ?? null;
}

/** The options a meditation runs with: defaults filled in, values in range. */
export function normalizeOptions(meditation: Meditation, raw: MeditationOptions = {}): MeditationOptions {
  const merged = { ...meditation.defaults, ...raw };
  const out: MeditationOptions = {};
  const { controls } = meditation;
  if (controls.n) out.n = clampN(merged.n, controls.n.min, controls.n.max, meditation.defaults.n);
  if (controls.out) out.out = clampN(merged.out, controls.out.min, controls.out.max, meditation.defaults.out);
  if (controls.minutes) {
    out.minutes = clampN(merged.minutes, MINUTES_MIN, MINUTES_MAX, meditation.defaults.minutes ?? 5);
  }
  if (controls.bell) {
    const bell = Math.round(Number(merged.bell));
    out.bell = (BELL_CHOICES as readonly number[]).includes(bell) ? bell : 0;
  }
  if (controls.dhikr) {
    const set = merged.set && (merged.set === "custom" || merged.set in DHIKR_SETS) ? merged.set : "tasbih";
    out.set = set;
    if (set === "custom") {
      out.phrase = (merged.phrase ?? "").trim().slice(0, PHRASE_MAX);
      out.target = clampN(merged.target, 1, 1000, 33);
    }
  }
  return out;
}

/** Whether stored or submitted options are exactly what normalising gives. */
export function optionsValid(meditation: Meditation, raw: MeditationOptions): boolean {
  const normal = normalizeOptions(meditation, raw);
  return (Object.keys(raw) as (keyof MeditationOptions)[]).every((key) => normal[key] === raw[key]);
}

/** Breathing meditations whose name is a shape, so the counts are added. */
const COUNTED = new Set(["resonant", "longer-exhale", "box", "triangle"]);

/** "Box 6-6-6-6", "Resonant 5-5", "Dhikr · Tasbih after prayer". */
export function meditationTitle(meditation: Meditation, options: MeditationOptions): string {
  const o = normalizeOptions(meditation, options);
  if (COUNTED.has(meditation.id) && meditation.pattern) {
    const counts = meditation.pattern(o).map((phase) => phase.seconds).join("-");
    return `${meditation.name.replace(/ breathing$/, "")} ${counts}`;
  }
  if (meditation.mode === "dhikr") {
    const set = o.set ?? "tasbih";
    return `Dhikr · ${set === "custom" ? o.phrase || "your own" : DHIKR_SETS[set].name}`;
  }
  return meditation.name;
}

/** The how-to with the chosen count in place of "n". */
export function howText(meditation: Meditation, options: MeditationOptions): string {
  const n = normalizeOptions(meditation, options).n;
  return n === undefined ? meditation.how : meditation.how.replace(/\bn\b/g, String(n));
}

// ---------------------------------------------------------------- timing

export function cycleSeconds(pattern: readonly BreathPhase[]): number {
  return pattern.reduce((sum, phase) => sum + phase.seconds, 0);
}

/** A timed breathing session rounded to whole breaths, at least one. */
export function sessionLength(minutes: number, pattern: readonly BreathPhase[]): number {
  const cycle = cycleSeconds(pattern);
  if (cycle <= 0) return Math.max(0, minutes * 60);
  return Math.max(1, Math.round((minutes * 60) / cycle)) * cycle;
}

/**
 * How long a session is planned for, in seconds. Dhikr runs until the count
 * is done, so it has no planned length: 0.
 */
export function plannedSeconds(meditation: Meditation, options: MeditationOptions): number {
  const o = normalizeOptions(meditation, options);
  if (meditation.mode === "dhikr") return 0;
  if (meditation.mode === "breath" && meditation.pattern) return sessionLength(o.minutes ?? 1, meditation.pattern(o));
  return (o.minutes ?? 1) * 60;
}

export type BreathMoment = {
  index: number;
  phase: BreathPhase;
  /** 0 to 1 through the current phase. */
  progress: number;
  /** Whole seconds left in the phase, counting down to 1. */
  countdown: number;
  cycle: number;
  /** How full the orb is right now, 0 to 1, eased. */
  level: number;
  /** 0 to 1 around the whole cycle, for a dot tracing the shape. */
  around: number;
};

const ease = (t: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t))) / 2;

export function breathAt(elapsedMs: number, pattern: readonly BreathPhase[]): BreathMoment {
  const cycleMs = cycleSeconds(pattern) * 1000;
  const elapsed = Math.max(0, elapsedMs);
  const cycle = Math.floor(elapsed / cycleMs);
  let within = elapsed - cycle * cycleMs;
  let index = 0;
  while (index < pattern.length - 1 && within >= pattern[index].seconds * 1000) {
    within -= pattern[index].seconds * 1000;
    index += 1;
  }
  const phase = pattern[index];
  const phaseMs = phase.seconds * 1000;
  const progress = Math.min(1, within / phaseMs);
  const from = pattern[(index - 1 + pattern.length) % pattern.length].to;
  return {
    index,
    phase,
    progress,
    countdown: Math.max(1, Math.ceil((phaseMs - within) / 1000)),
    cycle,
    level: from + (phase.to - from) * ease(progress),
    around: (index + progress) / pattern.length,
  };
}

/** Which guided prompt is showing, spread evenly over the session. */
export function promptAt(elapsedMs: number, script: readonly string[], totalSeconds: number): number {
  if (script.length === 0 || totalSeconds <= 0) return 0;
  const each = (totalSeconds * 1000) / script.length;
  return Math.min(script.length - 1, Math.floor(Math.max(0, elapsedMs) / each));
}

/** Seconds as "4:05" or "1:02:00". */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
