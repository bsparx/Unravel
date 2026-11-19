import { DisputationTurn } from "@/components/disputation-card";
import { DuaArch } from "@/components/dua-arch";
import { GratitudePage } from "@/components/gratitude-page";
import type { DisputationFields } from "@/lib/disputation";
import type { GuideKey } from "@/lib/practice-guides";
import type { PracticeItem } from "@/lib/practices";

import { GuideArt } from "./guide-art";

/**
 * One filled-in example of each practice, drawn with the very components a
 * real entry uses, so a beginner sees exactly what theirs will look like.
 * Made-up but ordinary: the point is the shape, not the story.
 */
export function GuideExample({ guide }: { guide: GuideKey }) {
  switch (guide) {
    case "disputations":
      return (
        <DisputationTurn entry={DISPUTATION} dateLabel="An example" expanded />
      );
    case "gratitude":
      return (
        <GratitudePage
          dateLabel="An example"
          templateName="What went well, and why"
          items={GRATITUDE}
        />
      );
    case "dua":
      return (
        <DuaArch
          dateLabel="An example"
          templateName="With its adab"
          items={DUA}
        />
      );
    case "braindump":
      return <DumpExample />;
    case "meditate":
      return <SittingExample />;
  }
}

const DISPUTATION: DisputationFields = {
  adversity:
    "I got a rejection email for the job I really wanted, two days after the final interview.",
  belief: "I'm never going to get a proper job. I always blow interviews.",
  beliefBefore: 8,
  consequences:
    "Felt sick, skipped the gym, didn't apply anywhere else all day.",
  evidence:
    "I reached the final round out of a lot of applicants, so I'm not blowing every interview. I got my current job after an interview.",
  alternatives:
    "They may have had an internal candidate, or wanted more experience with the one tool I haven't used yet. That's specific, and fixable.",
  implications:
    "Even if I did badly in this one, it's one interview. It doesn't decide every one after it.",
  usefulness:
    "Telling myself I always fail just stops me applying. Asking for feedback is more useful.",
  energization:
    "Less sick. I emailed them asking for feedback and sent two more applications.",
  beliefAfter: 3,
};

const item = (
  key: string,
  step: string,
  label: string,
  text: string,
): PracticeItem => ({ key, step, label, text });

const GRATITUDE: PracticeItem[] = [
  item(
    "well-1:what",
    "Went well 1",
    "What went well",
    "Ammi called just to ask how my day was",
  ),
  item(
    "well-1:why",
    "Went well 1",
    "Why it happened",
    "Because I'd told her last week the job hunt was getting to me",
  ),
  item(
    "well-2:what",
    "Went well 2",
    "What went well",
    "Finished the hard part of the report before lunch",
  ),
  item(
    "well-2:why",
    "Went well 2",
    "Why it happened",
    "Because I started before checking my phone",
  ),
  item(
    "well-3:what",
    "Went well 3",
    "What went well",
    "The chai at the corner place on the walk home",
  ),
  item(
    "well-3:why",
    "Went well 3",
    "Why it happened",
    "Because I took the long way for once",
  ),
];

const DUA: PracticeItem[] = [
  item(
    "hamd:text",
    "Hamd",
    "Hamd",
    "All praise is Yours, the Most Merciful, who woke me today and kept my family well.",
  ),
  item(
    "salawat:text",
    "Salawat",
    "Salawat",
    "Peace and blessings on the Prophet ﷺ, his family and his companions.",
  ),
  item(
    "istighfar:text",
    "Istighfar",
    "Istighfar",
    "Forgive me for the sharp words I said to my brother this week.",
  ),
  item(
    "ask:text",
    "Ask",
    "Ask",
    "Make the move next month easy, and give me the right words with my father on Sunday.",
  ),
  item(
    "others:text",
    "Others",
    "Others",
    "Shifa for Nani, and relief for everyone living through war tonight.",
  ),
  item(
    "close:text",
    "Close",
    "Closing",
    "Peace and blessings on the Prophet ﷺ. Ameen.",
  ),
];

/** A five-minute morning dump, with the two lines that became tasks circled. */
function DumpExample() {
  const lines: { text: string; task?: boolean }[] = [
    { text: "the boiler is making that noise again" },
    { text: "email the landlord about the boiler", task: true },
    { text: "worried I sounded rude in the meeting yesterday" },
    { text: "Sana's birthday is Thursday, haven't got anything" },
    { text: "order Sana's present by Tuesday", task: true },
    { text: "keep thinking about quitting sugar again" },
    { text: "what else… tired. that's it" },
  ];
  return (
    <figure className="dump-sky relative overflow-hidden rounded-2xl px-6 py-6 text-[var(--woop-ink)] ring-1 ring-[var(--woop-glass-edge)] sm:px-8">
      <header className="mb-4">
        <p className="font-display text-xl leading-tight">An example</p>
        <p className="text-micro text-[var(--woop-ink-muted)]">
          Everything · 5 min
        </p>
      </header>
      <ul className="space-y-2.5 rounded-xl bg-[var(--woop-glass)] p-4 ring-1 ring-[var(--woop-glass-edge)]">
        {lines.map((line) => (
          <li
            key={line.text}
            className="flex items-center gap-2 text-[0.95rem] leading-snug"
          >
            <span
              className={
                line.task
                  ? "rounded-full px-2.5 py-0.5 ring-2 ring-[var(--dump-air-a)]"
                  : "px-2.5 py-0.5"
              }
            >
              {line.text}
            </span>
            {line.task && (
              <span className="shrink-0 text-micro font-medium text-[var(--dump-air-a)]">
                → task
              </span>
            )}
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 text-micro text-[var(--woop-ink-muted)]">
        Unsorted, unpolished, and two lines circled. The rest folds away until
        tomorrow.
      </figcaption>
    </figure>
  );
}

/** One easy sitting, step by step. */
function SittingExample() {
  const beats = [
    ["Pick", "Box breathing, 4 counts, 5 minutes. Marked easy."],
    ["Settle", "Sit upright, feet on the floor, phone face down. Tap Begin."],
    [
      "Breathe",
      "In for 4 as the orb grows, hold for 4, out for 4 as it shrinks, hold for 4. That's one box; it's about 16 seconds.",
    ],
    [
      "Drift and return",
      "Somewhere around minute two you'll be thinking about lunch. Notice it, and come back to the next count.",
    ],
    [
      "Done",
      "The chime ends it. Five minutes, about 19 boxes, and the garden grows tonight.",
    ],
  ] as const;
  return (
    <figure className="guide-sky-garden rounded-2xl px-6 py-6 text-[var(--woop-ink)] ring-1 ring-[var(--woop-glass-edge)] sm:px-8">
      <div className="mx-auto mb-4 max-w-56">
        <GuideArt guide="meditate" />
      </div>
      <ol className="space-y-3">
        {beats.map(([title, body], i) => (
          <li
            key={title}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3"
          >
            <span className="font-display text-lg leading-6 tabular-nums">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-label text-[var(--woop-ink-muted)]">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
