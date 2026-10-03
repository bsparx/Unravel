import type { IdentityKind } from "@/lib/generated/prisma/client";
import type { Archetype, Sigil } from "@/lib/identity-look";

/** One habit a starter brings: a name, its minimum, and the cue it hangs on. */
export type StarterHabit = {
  title: string;
  minimalTask: string;
  cue: string;
  estimateMinutes: number;
};

/**
 * A ready-made character for a first run. Picking one creates the identity and
 * its habits, already linked, so the first vote is one check-in away instead of
 * three forms on three screens.
 *
 * `colorSlot` is a preference, not a promise: a hue another identity already
 * wears falls back to the next free one.
 */
export type StarterSelf = {
  id: string;
  name: string;
  kind: IdentityKind;
  archetype: Archetype;
  sigil: Sigil;
  colorSlot: number;
  statement: string;
  characteristics: string;
  question: string;
  habits: StarterHabit[];
};

export const STARTER_SELVES: StarterSelf[] = [
  {
    id: "sherlock",
    name: "Sherlock Holmes",
    kind: "FICTIONAL",
    archetype: "Sage",
    sigil: "search",
    colorSlot: 1,
    statement: "I notice things and follow my curiosity.",
    characteristics: "Looks before concluding. Follows small details. Keeps an index of odd facts.",
    question: "What am I not noticing yet?",
    habits: [
      { title: "Read a little", minimalTask: "Read one page", cue: "After the morning coffee", estimateMinutes: 10 },
      { title: "Step outside", minimalTask: "A five-minute walk, no phone", cue: "After lunch", estimateMinutes: 10 },
    ],
  },
  {
    id: "leonardo",
    name: "Leonardo da Vinci",
    kind: "REAL",
    archetype: "Creator",
    sigil: "palette",
    colorSlot: 2,
    statement: "I make something small every day.",
    characteristics: "Carries a notebook everywhere. Draws to understand. Comes back to unfinished work.",
    question: "What is the smallest thing I could make right now?",
    habits: [
      { title: "Draw something", minimalTask: "One rough drawing", cue: "After the morning coffee", estimateMinutes: 15 },
      { title: "Keep a notebook", minimalTask: "Write one idea down", cue: "Before closing the laptop", estimateMinutes: 5 },
    ],
  },
  {
    id: "marcus",
    name: "Marcus Aurelius",
    kind: "REAL",
    archetype: "Ruler",
    sigil: "landmark",
    colorSlot: 3,
    statement: "I stay steady when the day gets loud.",
    characteristics: "Ends the day with a few written notes. Separates what can be controlled from what can't.",
    question: "Is this mine to control?",
    habits: [
      { title: "Evening notes", minimalTask: "Three lines in the journal", cue: "Before bed", estimateMinutes: 5 },
      { title: "Sit still", minimalTask: "One minute of quiet breathing", cue: "After the morning coffee", estimateMinutes: 5 },
    ],
  },
  {
    id: "musashi",
    name: "Miyamoto Musashi",
    kind: "REAL",
    archetype: "Hero",
    sigil: "swords",
    colorSlot: 4,
    statement: "I train a little, most days.",
    characteristics: "Trains daily. Studies one way deeply, then uses it everywhere.",
    question: "Can I do one more, with good form?",
    habits: [
      { title: "Train", minimalTask: "Ten slow push-ups", cue: "Before the shower", estimateMinutes: 10 },
      { title: "Stretch", minimalTask: "One minute of stretching", cue: "After getting up", estimateMinutes: 5 },
    ],
  },
  {
    id: "samwise",
    name: "Samwise Gamgee",
    kind: "FICTIONAL",
    archetype: "Caregiver",
    sigil: "heart-handshake",
    colorSlot: 5,
    statement: "I look after the people walking with me.",
    characteristics: "Carries what others forget. Keeps going when it gets hard. Tends the garden.",
    question: "Who could use a hand right now?",
    habits: [
      { title: "Check in on someone", minimalTask: "Send one kind message", cue: "After lunch", estimateMinutes: 5 },
      { title: "Tend something", minimalTask: "Water one plant", cue: "After the morning coffee", estimateMinutes: 5 },
    ],
  },
  {
    id: "amelia",
    name: "Amelia Earhart",
    kind: "REAL",
    archetype: "Explorer",
    sigil: "compass",
    colorSlot: 6,
    statement: "I try one new thing each day.",
    characteristics: "Goes before she feels ready. Learns the machine, not just the route.",
    question: "What haven't I tried yet?",
    habits: [
      { title: "Go somewhere new", minimalTask: "Take a different route", cue: "On the way out", estimateMinutes: 10 },
      { title: "Practise a skill", minimalTask: "Ten minutes of practice", cue: "After the morning coffee", estimateMinutes: 10 },
    ],
  },
  {
    id: "mary",
    name: "Mary Oliver",
    kind: "REAL",
    archetype: "Lover",
    sigil: "feather",
    colorSlot: 5,
    statement: "I pay attention to what is beautiful.",
    characteristics: "Walks with a small notebook. Looks for a long time before writing.",
    question: "What is here that I keep walking past?",
    habits: [
      { title: "Pay attention", minimalTask: "Notice one thing outside and name it", cue: "After lunch", estimateMinutes: 5 },
      { title: "Write it down", minimalTask: "One line about the day", cue: "Before bed", estimateMinutes: 5 },
    ],
  },
  {
    id: "hermione",
    name: "Hermione Granger",
    kind: "FICTIONAL",
    archetype: "Magician",
    sigil: "lamp",
    colorSlot: 6,
    statement: "I prepare before I need to.",
    characteristics: "Reads ahead. Makes a plan, then a backup. Asks the question everyone else skipped.",
    question: "What will I wish I had ready?",
    habits: [
      { title: "Ready tomorrow", minimalTask: "Write tomorrow's first task", cue: "Before closing the laptop", estimateMinutes: 5 },
      { title: "Study", minimalTask: "Review one page of notes", cue: "After the morning coffee", estimateMinutes: 10 },
    ],
  },
];

export const STARTER_IDS = STARTER_SELVES.map((starter) => starter.id) as [string, ...string[]];

export const starterById = (id: string): StarterSelf | undefined =>
  STARTER_SELVES.find((starter) => starter.id === id);

/** The identity form's rule: one name per cast, compared case-insensitively. */
export const isTaken = (starter: StarterSelf, castNames: string[]): boolean =>
  castNames.some((name) => name.toLowerCase() === starter.name.toLowerCase());
