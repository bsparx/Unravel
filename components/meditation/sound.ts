/**
 * The session's sounds, synthesised with Web Audio: no files to load, and a
 * blocked AudioContext (no gesture yet, a strict browser) just means silence,
 * never an error. Everything is quiet on purpose; it should feel like the
 * room, not an app.
 */

let context: AudioContext | null = null;

async function audio(): Promise<AudioContext | null> {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Call from a click so later sounds are allowed to play. */
export function primeAudio() {
  void audio();
}

/**
 * A singing-bowl strike: a low fundamental with a few inharmonic partials,
 * each fading at its own rate, so it rings rather than beeps.
 */
export async function bell(strength = 1) {
  const ctx = await audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const partials: [ratio: number, gain: number, decay: number][] = [
    [1, 0.16, 5.5],
    [2.76, 0.05, 3.2],
    [5.4, 0.025, 1.8],
    [8.93, 0.01, 1.1],
  ];
  for (const [ratio, gain, decay] of partials) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 196 * ratio;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain * strength, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(amp).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + decay + 0.1);
  }
}

/**
 * A soft cue at each breath: a tone gliding up for in, down for out, and a
 * still one for a hold.
 */
export async function breathCue(cue: "in" | "hold-in" | "out" | "hold-out") {
  const ctx = await audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  const [from, to] = cue === "in" ? [294, 392] : cue === "out" ? [392, 262] : [330, 330];
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + 0.6);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(0.05, now + 0.06);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  osc.connect(amp).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1);
}

/** The click of a bead: tiny and wooden. */
export async function bead(last = false) {
  const ctx = await audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = last ? 660 : 1180;
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(last ? 0.08 : 0.04, now + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + (last ? 0.5 : 0.07));
  osc.connect(amp).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

/** A short buzz on phones; nothing elsewhere. */
export function buzz(pattern: number | number[] = 18) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported: fine.
  }
}

const KEY = "unravel:meditation-prefs";
export type SoundPrefs = { sound: boolean; haptics: boolean };

/** Per-device: a phone on silent and a laptop at a desk want different things. */
export function readPrefs(): SoundPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
      return { sound: parsed.sound !== false, haptics: parsed.haptics !== false };
    }
  } catch {
    // Storage blocked: defaults.
  }
  return { sound: true, haptics: true };
}

export function writePrefs(prefs: SoundPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the choice lasts for this session only.
  }
}
