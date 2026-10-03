/**
 * Plain-language explanations of the app's own vocabulary, for the info tips
 * beside each term. One place, so a word means the same thing on every screen.
 *
 * Each entry answers what a new user actually wonders: what is this (`what`),
 * and why would I bother (`why`). Keep both to a sentence or two. The tip is a
 * reminder, not a manual.
 */
export const GLOSSARY = {
  identity: {
    title: "Identities",
    what: "A self you want to become, named after someone real or fictional, like Sherlock Holmes or Marcus Aurelius. You can also use a role, like Writer.",
    why: "Link habits to an identity and every habit you keep becomes a vote for that person. Up to six.",
  },
  starter: {
    title: "Starter characters",
    what: "A ready-made identity with two small habits, already linked.",
    why: "One tap and your day has something to check off. You can rename, edit or delete any of it later.",
  },
  vote: {
    title: "Votes",
    what: "Each time you do a habit's minimum, every identity linked to that habit gets one vote.",
    why: "Votes are the evidence that you're becoming that person. They never go down.",
  },
  stage: {
    title: "Stages",
    what: "Five stages, reached by an identity's all-time votes: Trying it on, Practising (10), Showing up (30), Dependable (60) and Second nature (100).",
    why: "They show how far a self has come. You can't lose a stage once you reach it.",
  },
  lead: {
    title: "Today's lead",
    what: "The one identity you focus on today. Its next habit is suggested first, and its question shows when you start the timer.",
    why: "One self at a time keeps the day simple. The weekly review picks a lead for the week, and you can switch on any day.",
  },
  question: {
    title: "Their question",
    what: "The one question this identity asks before starting, like “Is this mine to control?”",
    why: "Read it once before you begin. Looking through their eyes makes starting easier.",
  },
  minimum: {
    title: "The minimum",
    what: "The smallest version of a habit that still counts, like “Read one page”. Doing it completes the habit for the day.",
    why: "A bar you can clear on your worst day is the one that survives a worst day. Anything extra is a bonus, never required.",
  },
  unlinked: {
    title: "Habits without an identity",
    what: "Habits that don't vote for anyone yet.",
    why: "Link each one to an identity so keeping it counts as a vote.",
  },
  dailies: {
    title: "Dailies",
    what: "Habits due today. Check one off once you've done its minimum.",
    why: "Each one you check off is a vote for the identities it serves.",
  },
  quests: {
    title: "Quests",
    what: "To-dos due today.",
    why: "The counter shows done out of total. It only goes up as you finish things.",
  },
  sideQuests: {
    title: "Side quests",
    what: "To-dos with no date.",
    why: "Do them whenever there's room. Nothing about them is late.",
  },
  overdue: {
    title: "Overdue",
    what: "To-dos whose date has passed.",
    why: "Finish it or give it a new date. Either one takes it off this list.",
  },
  shadow: {
    title: "The shadow side",
    what: "Habits you're trying to break, like scrolling in bed. Each one names the identity it pulls against and a plan that makes it harder.",
    why: "Tap Noticed when you catch it. That's useful information, not a failure. Tap Chose otherwise when you resist, and that identity gets a vote.",
  },
  treats: {
    title: "Treats",
    what: "Rewards you set for yourself that unlock with votes, like new running shoes at 30 votes for the self who trains.",
    why: "Nothing is spent, so enjoying a treat never costs progress. A treat for the whole cast unlocks from this week's votes and resets every week.",
  },
  chapters: {
    title: "Chapters",
    what: "A short story for one identity: a few objectives over a few days, like seven rough drawings in ten days.",
    why: "It gives your habits a goal to aim at. Objectives linked to a habit fill in by themselves, and a missed day simply waits.",
  },
  council: {
    title: "The weekly council",
    what: "A ten-minute review once a week. You look back at each identity's votes, make one struggling habit smaller or easier, and choose who leads next week.",
    why: "Small weekly adjustments keep habits doable, so they don't quietly fall away.",
  },
  blocks: {
    title: "Time blocks",
    what: "Claim time on the calendar. A block can be Work, Recovery (deliberate rest, which counts), Buffer (left empty on purpose so the day has give) or Daydream (imaginary time that's never counted).",
    why: "Blocks are the plan, and the timer records what actually happened. Comparing the two shows where your time really goes.",
  },
  timerModes: {
    title: "Timer modes",
    what: "Pomodoro: focus rounds with short breaks. Flow: count toward a goal and keep going if you're in the zone. Timer: one plain countdown. Recovery: a deliberate break, logged as rest.",
    why: "Every session is logged against its task, so Statistics can show where your time went.",
  },
  behavior: {
    title: "Behavior log",
    what: "A quick note of an urge the moment it hits, like scrolling or daydreaming, and what triggered it. Press c anywhere to capture one.",
    why: "Over time the patterns show up here, and a pattern you can see is easier to plan around.",
  },
  frog: {
    title: "The frog",
    what: "Today's one thing: the task that matters most, and usually the one you'd rather put off.",
    why: "Do it first and the rest of the day gets easier. Its first step is shown, so starting isn't a decision.",
  },
  close: {
    title: "Closing the day",
    what: "Three short steps at night: pick tomorrow's frog, empty what's still on your mind, and note one good thing.",
    why: "Tomorrow starts already decided, and the day ends instead of trailing off.",
  },
} as const satisfies Record<string, { title: string; what: string; why: string }>;

export type GlossaryTerm = keyof typeof GLOSSARY;
