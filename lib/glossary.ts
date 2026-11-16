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
    what: "Two short steps at night: pick tomorrow's frog and empty what's still on your mind. Then the day hands off to rest. Gratitude lives on the Mind page.",
    why: "Tomorrow starts already decided, and the day ends instead of trailing off.",
  },
  mind: {
    title: "Mind",
    what: "Up to four practices on one page, each switchable in Settings. Gratitude and du'a are a page a day. WOOP turns a wish into a plan for the obstacle in you. ABCDE takes a gloomy thought after a setback and argues back.",
    why: "Noticing the good, asking for what you need, wanting well and thinking clearly about setbacks are all skills, and all get easier written down.",
  },
  woop: {
    title: "WOOP",
    what: "Wish, Outcome, Obstacle, Plan, from Gabriele Oettingen. Picture what you want, then the thing in you most likely to get in the way, then decide what you'll do when it does.",
    why: "Picturing the obstacle next to the outcome works better than positive thinking alone. The plan becomes an if-then you can act on.",
  },
  disputation: {
    title: "Disputation",
    what: "Adversity, Belief, Consequences, Disputation, Energization, from Martin Seligman's Learned Optimism. Write what happened and what you told yourself, then argue back as if someone else had said it.",
    why: "The thought after a setback is often the harshest available one. Checking it against evidence, alternatives, implications and usefulness loosens its grip.",
  },
  gratitude: {
    title: "Gratitude",
    what: "One page a day of what was good. Pick a template: a quick list of good things (you choose how many, up to 10), or a deeper one like What went well and why, or a letter of thanks.",
    why: "Writing down good things trains attention to find them. In Seligman's studies, a week of it lifted mood for months.",
  },
  dua: {
    title: "Du'a",
    what: "One page a day of what you ask Allah for. Pick a template: a short list of du'as (up to 10), widening circles from yourself to the ummah, or the full adab from praise to ameen.",
    why: "Writing it slows you down enough to mean it, and the pages become a record of what you were carrying and asking for.",
  },
  template: {
    title: "Templates",
    what: "The shape of each day's page. Light templates take a minute; deep ones take ten. Change it any time from the chip at the top; pages you've already written keep their own shape.",
    why: "Some days want a quick list, some want slow writing. Neither is the better habit; the one you'll actually do is.",
  },
} as const satisfies Record<string, { title: string; what: string; why: string }>;

export type GlossaryTerm = keyof typeof GLOSSARY;
