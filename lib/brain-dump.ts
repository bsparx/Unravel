/**
 * Brain dump: everything in your head, written out for a few minutes without
 * sorting or judging it, and then left alone.
 *
 * Why it plausibly works: the mind keeps rehearsing unfinished things so it
 * won't forget them, and writing them down tells it they're stored (cognitive
 * offloading). Putting a feeling into words also dampens it (Lieberman's
 * affect labelling), and the more concrete the item, the more fully it lets
 * go. The bedtime version follows the Baylor sleep study: five minutes on a
 * to-do list for tomorrow, which helped sleep more than a list of what you'd
 * already done.
 *
 * Pure: shared by the session, the panel and the server action.
 */

export const DUMP_KINDS = ["EMPTY", "TOMORROW"] as const;
export type DumpKind = (typeof DUMP_KINDS)[number];

/** The timer lengths on offer. The Baylor participants wrote for five. */
export const DUMP_MINUTES = [5, 10] as const;
export type DumpMinutes = (typeof DUMP_MINUTES)[number];

/** A dump's longest page, in characters. Ten fast minutes is well under it. */
export const DUMP_MAX_CHARS = 20_000;
/** At most this many lines go to the task list from one dump. */
export const DUMP_MAX_TASKS = 40;
/** A task title's limit, as everywhere else. */
export const DUMP_TASK_CHARS = 200;

export type DumpKindCopy = {
  /** "Everything". */
  name: string;
  /** One line for the picker. */
  hint: string;
  /** The empty page. */
  placeholder: string;
  /** Asked at the sort. */
  sortTitle: string;
  sortHint: string;
  /** For when the page goes quiet: concrete places to look. */
  nudges: readonly string[];
};

export const DUMP_COPY: Record<DumpKind, DumpKindCopy> = {
  EMPTY: {
    name: "Everything",
    hint: "Tasks, worries, ideas, reminders, stray thoughts. Best first thing, before your phone.",
    placeholder: "Whatever is in your head. Don't sort it, don't judge it. Just keep writing.",
    sortTitle: "Anything to do?",
    sortHint: "Circle what's actionable and it goes on your task list. Leave the rest.",
    nudges: [
      "Something you said you'd do.",
      "A message you haven't answered.",
      "Something to buy.",
      "A worry you keep coming back to.",
      "An idea you don't want to lose.",
      "Someone you've been meaning to call.",
      "Something at home that needs fixing.",
      "A date or a deadline coming up.",
      "Money: a bill, a payment, a refund.",
      "Your body: sleep, food, an ache.",
      "A small thing that annoyed you.",
      "Something you're looking forward to.",
    ],
  },
  TOMORROW: {
    name: "Tomorrow's list",
    hint: "Only what needs doing tomorrow, short and practical. Best in the minutes before bed.",
    placeholder: "What needs doing tomorrow? One thing to a line, as specific as you can.",
    sortTitle: "Tomorrow's list",
    sortHint: "Everything circled goes on tomorrow's task list. Tap a line to leave it off.",
    nudges: [
      "The first thing you'll do.",
      "Anything with a time attached.",
      "A call, a message, an email.",
      "Something to take with you.",
      "Something to pick up on the way.",
      "Anything carried over from today.",
      "The one thing that would make tomorrow good.",
    ],
  },
};

/**
 * The kind that suits the hour: the bedtime list from eight in the evening
 * until the small hours, everything else the rest of the day.
 */
export function suggestedKind(minuteOfDay: number): DumpKind {
  return minuteOfDay >= 20 * 60 || minuteOfDay < 4 * 60 ? "TOMORROW" : "EMPTY";
}

/**
 * Late enough that heavy worries are better left for earlier in the evening
 * (Breus: a worry journal after dinner, not right before bed).
 */
export function isBedtime(minuteOfDay: number): boolean {
  return minuteOfDay >= 21 * 60 || minuteOfDay < 4 * 60;
}

// A list marker at the start of a line: "-", "*", "•", "1.", "2)", "[ ]".
const MARKER = /^\s*(?:[-*•·–—]+|\d{1,2}[.)]|\[\s?[xX]?\s?\])\s*/;

/**
 * A dump cut into the pieces you can circle: one per line, and a long line
 * cut at its sentences, so a run of unfiltered writing still sorts. List
 * markers and stray spaces go; empty pieces are dropped.
 */
export function dumpLines(body: string): string[] {
  const out: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(MARKER, "").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const pieces = line.length > 80 ? line.split(/(?<=[.!?;])\s+(?=\S)/) : [line];
    for (const piece of pieces) {
      const text = piece.trim();
      // A piece needs a letter or a digit: a lone "..." or "?" isn't a line.
      if (/[\p{L}\p{N}]/u.test(text)) out.push(text);
    }
  }
  return out;
}

/** A circled line as a task title: capitalised, no trailing full stop, within the limit. */
export function taskTitle(line: string): string {
  const text = line.replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
  const capped = text.charAt(0).toUpperCase() + text.slice(1);
  return capped.length > DUMP_TASK_CHARS ? `${capped.slice(0, DUMP_TASK_CHARS - 1).trimEnd()}…` : capped;
}

export function wordCount(body: string): number {
  const words = body.trim().match(/\S+/g);
  return words ? words.length : 0;
}

/** "4:05" for a countdown. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
