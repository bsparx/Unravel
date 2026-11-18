/**
 * Gratitude and du'a: the two daily pages on /mind, and the templates they
 * can be written with.
 *
 * A template is a short sequence of steps, one screen each in the ritual.
 * Most steps ask one thing; a few ask a second, optional thing underneath
 * (the "why" in What went well). Exactly one template per practice is
 * counted: "n good things" and "n du'as", where you choose n from 1 to 10.
 *
 * Client-safe on purpose (no Prisma): the ritual, the template picker, the
 * page cards and the server schema all read the same copy and the same
 * clamps, so the prompts you see are the prompts the server checks against.
 */

export type PracticeKind = "gratitude" | "dua";

export type Depth = "light" | "deeper" | "deep";

export type PracticeField = {
  key: string;
  /** Shown above the field when a step has more than one, and on the card. */
  label: string;
  placeholder: string;
  max: number;
  /** Can be left blank. A step whose fields are all optional can be skipped. */
  optional?: boolean;
  /** Taller box for long writing (the letter, the asks). */
  long?: boolean;
};

export type PracticeStep = {
  key: string;
  /** One or two characters for the rail: a numeral or an initial. */
  glyph: string;
  name: string;
  /** The question, in the display serif. */
  question: string;
  /** One line of the method: what makes an answer a good one. */
  guide: string;
  fields: PracticeField[];
};

export type PracticeTemplate = {
  id: string;
  kind: PracticeKind;
  name: string;
  /** One sentence for the picker. */
  blurb: string;
  depth: Depth;
  /** The one "n things" template per practice. */
  counted?: true;
  /** Rough minutes, for the picker. */
  minutes: (count: number) => number;
  /** `seed` only rotates placeholders; keys never depend on it. */
  steps: (count: number, seed?: number) => PracticeStep[];
};

/** One answered field, as stored on the page. */
export type PracticeItem = {
  key: string;
  /** The step's name, so a page can be read without its template. */
  step: string;
  label: string;
  text: string;
};

/** A page as /mind renders it. */
export type PracticePage = {
  id: string;
  dateISO: string;
  /** "Mon 16 Nov", in the user's timezone. */
  dateLabel: string;
  template: string;
  templateName: string;
  items: PracticeItem[];
};

export const PRACTICE_MIN_COUNT = 1;
export const PRACTICE_MAX_COUNT = 10;
export const PRACTICE_DEFAULT_COUNT = 3;

export const DEPTHS: Record<Depth, { label: string; dots: number; hint: string }> = {
  light: { label: "Light", dots: 1, hint: "A minute or two. Good for most days." },
  deeper: { label: "Deeper", dots: 2, hint: "A few minutes, and a little more thought per line." },
  deep: { label: "Deep", dots: 3, hint: "Take your time. Best when you have a quiet ten minutes." },
};

export function clampCount(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return PRACTICE_DEFAULT_COUNT;
  return Math.min(PRACTICE_MAX_COUNT, Math.max(PRACTICE_MIN_COUNT, n));
}

/** Stable per day, so a placeholder doesn't change under you mid-thought. */
export function daySeed(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

const pick = <T,>(list: readonly T[], index: number): T =>
  list[((index % list.length) + list.length) % list.length];

const line = (key: string, label: string, placeholder: string, extra: Partial<PracticeField> = {}): PracticeField => ({
  key,
  label,
  placeholder,
  max: 240,
  ...extra,
});

// ---------------------------------------------------------------- gratitude

const GOOD_THING_PROMPTS = [
  "Something that went better than you expected",
  "Someone who made today easier",
  "A small thing you'd miss if it were gone",
  "Something you did today that took effort",
  "A moment you'd keep from today",
  "Something that worked, however small",
  "Anything at all. It doesn't have to be profound.",
];

const GOOD_THING_QUESTIONS = [
  "What's one good thing from today?",
  "Another one. Small ones count.",
  "And another?",
  "What else went right?",
  "One more, from any part of the day.",
];

export const GRATITUDE_TEMPLATES: readonly PracticeTemplate[] = [
  {
    id: "good-things",
    kind: "gratitude",
    name: "Good things",
    blurb: "A short list of what was good today. You choose how many.",
    depth: "light",
    counted: true,
    minutes: (n) => Math.max(1, Math.ceil(n / 2)),
    steps: (count, seed = 0) =>
      Array.from({ length: clampCount(count) }, (_, i) => ({
        key: `thing-${i + 1}`,
        glyph: String(i + 1),
        name: `Good thing ${i + 1}`,
        question: i === 0 ? GOOD_THING_QUESTIONS[0] : pick(GOOD_THING_QUESTIONS.slice(1), i - 1),
        guide: "One line is enough. Specific beats grand.",
        fields: [line("text", "Good thing", pick(GOOD_THING_PROMPTS, seed + i))],
      })),
  },
  {
    id: "what-went-well",
    kind: "gratitude",
    name: "What went well, and why",
    blurb: "Three good things, each with why it happened. Martin Seligman's version.",
    depth: "deeper",
    minutes: () => 5,
    steps: () =>
      [
        "What went well today?",
        "What else went well?",
        "And a third thing that went well?",
      ].map((question, i) => ({
        key: `well-${i + 1}`,
        glyph: String(i + 1),
        name: `Went well ${i + 1}`,
        question,
        guide: "Then ask why it happened. The why is where you notice your own part in it.",
        fields: [
          line("what", "What went well", pick(["My talk with Sara went better than I feared", "Finished the hard part of the report", "The kids were in bed on time"], i)),
          line("why", "Why it happened", pick(["Because I said the hard thing early", "Because I started before I felt ready", "Because we kept to the routine"], i), { optional: true }),
        ],
      })),
  },
  {
    id: "three-lenses",
    kind: "gratitude",
    name: "Someone, something, yourself",
    blurb: "Three angles on the day: a person, a moment, and you.",
    depth: "deeper",
    minutes: () => 4,
    steps: () => [
      {
        key: "someone",
        glyph: "S",
        name: "Someone",
        question: "Who are you grateful for today?",
        guide: "Name them, then what they did. Even a stranger counts.",
        fields: [
          line("who", "Who", "My brother", { max: 80 }),
          line("what", "What they did", "Called just to ask how the interview went"),
        ],
      },
      {
        key: "moment",
        glyph: "M",
        name: "A moment",
        question: "What moment or thing are you glad of?",
        guide: "Something that happened, or something you have and usually forget.",
        fields: [line("text", "A moment", "Tea on the balcony before anyone was up")],
      },
      {
        key: "yourself",
        glyph: "Y",
        name: "Yourself",
        question: "What are you glad you did, or glad you are?",
        guide: "This one feels awkward at first. Say it anyway.",
        fields: [line("text", "Yourself", "I didn't snap when I wanted to")],
      },
    ],
  },
  {
    id: "savour",
    kind: "gratitude",
    name: "One moment, savoured",
    blurb: "One good moment, gone back to slowly: what it was, what it felt like, why it mattered.",
    depth: "deep",
    minutes: () => 7,
    steps: () => [
      {
        key: "moment",
        glyph: "M",
        name: "The moment",
        question: "Which moment from today do you want to keep?",
        guide: "Just one. Pick the one that comes to mind first.",
        fields: [line("text", "The moment", "Walking home in the rain with the shop lights coming on")],
      },
      {
        key: "senses",
        glyph: "S",
        name: "Senses",
        question: "What did you see, hear, feel?",
        guide: "Go back into it. Details bring the feeling back with them.",
        fields: [line("text", "What you noticed", "Wet tarmac smell, cold hands, someone laughing in a doorway", { max: 600, long: true })],
      },
      {
        key: "meaning",
        glyph: "W",
        name: "Why it mattered",
        question: "Why did it matter to you?",
        guide: "What does it say about what you love, or who you are?",
        fields: [line("text", "Why it mattered", "It reminded me I like this city when I slow down", { max: 600, long: true })],
      },
      {
        key: "carry",
        glyph: "C",
        name: "Carry it",
        question: "How could you have more of this?",
        guide: "Optional. A small way to meet it again.",
        fields: [line("text", "How to carry it", "Walk home one evening a week instead of the bus", { optional: true })],
      },
    ],
  },
  {
    id: "letter",
    kind: "gratitude",
    name: "A letter of thanks",
    blurb: "A short letter to someone you never properly thanked. Seligman's gratitude visit.",
    depth: "deep",
    minutes: () => 12,
    steps: () => [
      {
        key: "to",
        glyph: "T",
        name: "To",
        question: "Who have you never properly thanked?",
        guide: "Someone still around, ideally, so you could give it to them.",
        fields: [line("text", "To", "Mrs Qureshi, my maths teacher", { max: 80 })],
      },
      {
        key: "did",
        glyph: "D",
        name: "What they did",
        question: "What did they do for you?",
        guide: "Be concrete: the day, the words, the thing.",
        fields: [line("text", "What they did", "Stayed after school for a month when I was failing", { max: 600, long: true })],
      },
      {
        key: "changed",
        glyph: "C",
        name: "What it changed",
        question: "How is your life different because of it?",
        guide: "Follow it forward to now.",
        fields: [line("text", "What it changed", "I stopped believing I was 'not a numbers person'", { max: 600, long: true })],
      },
      {
        key: "letter",
        glyph: "L",
        name: "The letter",
        question: "Now write it to them.",
        guide: "A few honest paragraphs. You can decide later whether to send it.",
        fields: [line("text", "The letter", "Dear Mrs Qureshi,", { max: 2000, long: true })],
      },
    ],
  },
];

// ---------------------------------------------------------------- du'a

const DUA_QUESTIONS = [
  "What do you ask Allah for today?",
  "What else is on your heart?",
  "And another?",
  "Anything else you need?",
  "Ask for one more thing.",
];

const DUA_PROMPTS = [
  "Ease in tomorrow's exam",
  "Health for my mother",
  "Patience with the people I love",
  "A way through the money worry",
  "A heart that's present in salah",
  "Guidance on the decision I keep putting off",
];

export const DUA_TEMPLATES: readonly PracticeTemplate[] = [
  {
    id: "n-duas",
    kind: "dua",
    name: "Du'as",
    blurb: "A short list of what you're asking for today. You choose how many.",
    depth: "light",
    counted: true,
    minutes: (n) => Math.max(1, Math.ceil(n / 2)),
    steps: (count, seed = 0) =>
      Array.from({ length: clampCount(count) }, (_, i) => ({
        key: `dua-${i + 1}`,
        glyph: String(i + 1),
        name: `Du'a ${i + 1}`,
        question: i === 0 ? DUA_QUESTIONS[0] : pick(DUA_QUESTIONS.slice(1), i - 1),
        guide: "Ask plainly, as you would someone who is listening. Nothing is too small.",
        fields: [line("text", "Du'a", pick(DUA_PROMPTS, seed + i))],
      })),
  },
  {
    id: "shukr-then-ask",
    kind: "dua",
    name: "Thanks, then ask",
    blurb: "Begin with one thing you're thankful for, then ask.",
    depth: "light",
    minutes: () => 2,
    steps: () => [
      {
        key: "shukr",
        glyph: "S",
        name: "Shukr",
        question: "What are you thankful to Allah for today?",
        guide: "Shukr first. Gratitude opens the asking.",
        fields: [line("text", "Shukr", "Waking up well, and a quiet morning")],
      },
      {
        key: "ask",
        glyph: "A",
        name: "Ask",
        question: "Now, what do you ask for?",
        guide: "As many things as you like, one per line.",
        fields: [line("text", "Ask", "Ease for my father's operation", { max: 600, long: true })],
      },
    ],
  },
  {
    id: "two-worlds",
    kind: "dua",
    name: "This world and the next",
    blurb: "Good in this life, good in the next, and protection: the shape of the du'a so many know by heart.",
    depth: "deeper",
    minutes: () => 4,
    steps: () => [
      {
        key: "dunya",
        glyph: "D",
        name: "Dunya",
        question: "What good do you ask for in this life?",
        guide: "Work, health, family, rizq. Be specific.",
        fields: [line("text", "This life", "Barakah in the new job, and time with my children", { max: 600, long: true })],
      },
      {
        key: "akhirah",
        glyph: "A",
        name: "Akhirah",
        question: "What good do you ask for in the next?",
        guide: "What you hope to be met with, and to become before then.",
        fields: [line("text", "The next", "Forgiveness, and a heart that's steady in prayer", { max: 600, long: true })],
      },
      {
        key: "protection",
        glyph: "P",
        name: "Protection",
        question: "What do you seek His protection from?",
        guide: "Name the fear. Handing it over is part of the du'a.",
        fields: [line("text", "Protection", "My own temper, and the worry that keeps me up", { max: 600, long: true })],
      },
    ],
  },
  {
    id: "circles",
    kind: "dua",
    name: "Circles of du'a",
    blurb: "Widening circles: yourself, family, friends and teachers, the ummah, those who have passed.",
    depth: "deeper",
    minutes: () => 5,
    steps: () =>
      (
        [
          ["self", "Yourself", "What do you ask for yourself?", "Start close. You are allowed to ask for yourself first.", "Steadiness this week"],
          ["family", "Family", "What do you ask for your family?", "Name them one by one if you can.", "Shifa for Nani, and peace between my brothers"],
          ["friends", "Friends and teachers", "Who else is in your circle?", "Friends, teachers, anyone who helped you or needs help.", "Ahmed's job search, and my old Qur'an teacher"],
          ["ummah", "The ummah", "What do you ask for the ummah?", "Those suffering, those far away, those you'll never meet.", "Safety and relief for everyone living through war"],
          ["passed", "Those who have passed", "Who do you remember who has passed?", "Ask mercy for them by name.", "Dada abbu, and my friend Bilal"],
        ] as const
      ).map(([key, name, question, guide, placeholder], i) => ({
        key,
        glyph: String(i + 1),
        name,
        question,
        guide,
        fields: [line("text", name, placeholder, { max: 600, optional: key !== "self" })],
      })),
  },
  {
    id: "adab",
    kind: "dua",
    name: "With its adab",
    blurb: "The full shape: praise, salawat, seeking forgiveness, asking, others, and a closing.",
    depth: "deep",
    minutes: () => 8,
    steps: () => [
      {
        key: "hamd",
        glyph: "H",
        name: "Hamd",
        question: "Begin with praise. What do you praise Allah for?",
        guide: "Call on Him by the names that fit your need: the Most Merciful, the Provider, the One who hears.",
        fields: [line("text", "Hamd", "The Most Merciful, who woke me today and kept me well", { max: 600, long: true })],
      },
      {
        key: "salawat",
        glyph: "S",
        name: "Salawat",
        question: "Send blessings on the Prophet ﷺ.",
        guide: "In the words you know, or your own. Optional to write, worth saying.",
        fields: [line("text", "Salawat", "Peace and blessings on the Prophet, his family and companions", { optional: true })],
      },
      {
        key: "istighfar",
        glyph: "I",
        name: "Istighfar",
        question: "What do you seek forgiveness for?",
        guide: "Leave it blank if you'd rather keep it unwritten. He already knows.",
        fields: [line("text", "Istighfar", "The things I said in anger this week", { max: 600, optional: true, long: true })],
      },
      {
        key: "ask",
        glyph: "A",
        name: "Ask",
        question: "Now ask. What do you need?",
        guide: "With certainty that you'll be answered, in the way and time that's best.",
        fields: [line("text", "Ask", "Ease in the move, and the right words with my father", { max: 600, long: true })],
      },
      {
        key: "others",
        glyph: "O",
        name: "Others",
        question: "Who else do you hold up?",
        guide: "Family, friends, someone struggling, the ummah.",
        fields: [line("text", "Others", "My sister's health, and everyone waiting on news today", { max: 600, optional: true, long: true })],
      },
      {
        key: "close",
        glyph: "C",
        name: "Close",
        question: "Close as you began.",
        guide: "Salawat again, then ameen. Anything to add before you do?",
        fields: [line("text", "Closing", "Ameen", { optional: true })],
      },
    ],
  },
];

export const PRACTICE_TEMPLATES: Record<PracticeKind, readonly PracticeTemplate[]> = {
  gratitude: GRATITUDE_TEMPLATES,
  dua: DUA_TEMPLATES,
};

export const DEFAULT_TEMPLATE: Record<PracticeKind, string> = {
  gratitude: "good-things",
  dua: "adab",
};

export function findTemplate(kind: PracticeKind, id: string | null | undefined): PracticeTemplate | null {
  return PRACTICE_TEMPLATES[kind].find((template) => template.id === id) ?? null;
}

/** Never null: an unknown id (a template since removed) falls back to the default. */
export function templateOrDefault(kind: PracticeKind, id: string | null | undefined): PracticeTemplate {
  return findTemplate(kind, id) ?? findTemplate(kind, DEFAULT_TEMPLATE[kind])!;
}

/** "Good things · 5" for the counted template, the plain name otherwise. */
export function templateLabel(template: PracticeTemplate, count: number): string {
  return template.counted ? `${template.name} · ${clampCount(count)}` : template.name;
}

export const fieldId = (step: PracticeStep, field: PracticeField) => `${step.key}:${field.key}`;

/** A step can be left only once its required fields are written and nothing is over length. */
export function stepComplete(step: PracticeStep, answers: Record<string, string>): boolean {
  return step.fields.every((field) => {
    const text = (answers[fieldId(step, field)] ?? "").trim();
    return text.length <= field.max && (field.optional || text.length > 0);
  });
}

export type BuildResult =
  | { ok: true; items: PracticeItem[] }
  | { ok: false; message: string };

/**
 * Turn raw answers into the stored snapshot, checking them against the
 * template: every key must be one the template asks, every required field
 * filled, nothing over length. Labels come from the template, never from
 * the client.
 */
export function buildPracticeItems(
  template: PracticeTemplate,
  count: number,
  answers: Record<string, string>,
): BuildResult {
  const steps = template.steps(count);
  const known = new Set(steps.flatMap((step) => step.fields.map((field) => fieldId(step, field))));

  for (const key of Object.keys(answers)) {
    if (!known.has(key)) return { ok: false, message: "That page doesn't match its template. Reopen it and try again." };
  }

  const items: PracticeItem[] = [];
  for (const step of steps) {
    for (const field of step.fields) {
      const text = (answers[fieldId(step, field)] ?? "").trim();
      if (text.length > field.max) return { ok: false, message: `${field.label} is a little long.` };
      if (!field.optional && !text) return { ok: false, message: `${step.name} is still blank.` };
      items.push({ key: fieldId(step, field), step: step.name, label: field.label, text });
    }
  }
  return { ok: true, items };
}

/** The page as plain text, for `JournalEntry.body`. */
export function itemsToBody(items: readonly PracticeItem[]): string {
  return items
    .filter((item) => item.text)
    .map((item) => `${item.label}: ${item.text}`)
    .join("\n");
}

/** Back from a page snapshot to answers, for reopening today's page. */
export function itemsToAnswers(items: readonly PracticeItem[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.key, item.text]));
}

/** Items grouped back into their steps, skipping blanks, for the page card. */
export function groupItems(items: readonly PracticeItem[]): { step: string; lines: PracticeItem[] }[] {
  const groups: { step: string; lines: PracticeItem[] }[] = [];
  for (const item of items) {
    if (!item.text) continue;
    const last = groups.at(-1);
    if (last && last.step === item.step) last.lines.push(item);
    else groups.push({ step: item.step, lines: [item] });
  }
  return groups;
}

export type PageGroup = {
  step: string;
  lines: PracticeItem[];
  /** "Good thing 3", "Du'a 2": a counted step, which reads as a list. */
  numbered: boolean;
};

/**
 * Steps as a page shows them. Numbered steps ("Good thing 3") read as a list
 * and don't need their name; named steps (Hamd, Someone, The letter) keep it
 * as a small heading, so a page reads the way it was written.
 */
export function pageGroups(items: readonly PracticeItem[]): PageGroup[] {
  return groupItems(items).map((group) => ({
    ...group,
    numbered: /\d+$/.test(group.step) || !group.step,
  }));
}

/** The first thing written on a page, for a one-line preview. */
export function firstLine(items: readonly PracticeItem[]): string {
  return items.find((item) => item.text.trim())?.text.trim() ?? "";
}

/** Defensive read of the Json column: anything malformed becomes no items. */
export function readItems(raw: unknown): PracticeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { key, step, label, text } = entry as Record<string, unknown>;
    if (typeof key !== "string" || typeof text !== "string") return [];
    return [{
      key,
      step: typeof step === "string" ? step : "",
      label: typeof label === "string" ? label : "",
      text,
    }];
  });
}
