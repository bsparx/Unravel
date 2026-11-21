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
    what: "Pomodoro Flow: work/break rounds (like 25/5) where your work baseline keeps flowing past the mark until you choose to take a break or stop. Pomodoro: strict focus rounds that stop at each boundary. Timer: one plain countdown. Recovery: a deliberate break, logged as rest.",
    why: "Pomodoro Flow gives you a baseline to aim for without cutting off a real flow state — and every session is logged honestly against its task.",
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
    what: "Two short steps at night: pick tomorrow's frog and empty what's still on your mind. Then the day hands off to rest. Gratitude lives on the Heart page.",
    why: "Tomorrow starts already decided, and the day ends instead of trailing off.",
  },
  mind: {
    title: "Mind",
    what: "Up to five practices for the head, each switchable in Settings. A brain dump empties your head onto the page for a few minutes. Meditation is a timer for breathing, dhikr and stillness that grows a garden. Reading keeps the books you're reading and the notes each one gathers. WOOP turns a wish into a plan for the obstacle in you. ABCDE takes a gloomy thought after a setback and argues back.",
    why: "Emptying your head, stilling it, feeding it, wanting well and thinking clearly about setbacks are all skills, and all get easier with a place to practise them.",
  },
  heart: {
    title: "Heart",
    what: "Three daily practices for the heart, each switchable in Settings: a page of gratitude, a page of du'a, and a daily set of recitations from the Quran and the sunnah.",
    why: "Thanks, asking and remembrance are the heart's side of the day. Kept together, they take a few quiet minutes in one place.",
  },
  recitation: {
    title: "Daily recitation",
    what: "A set you choose of Quran and remembrance, each shown in Arabic with transliteration and translation, and said as many times as you set: the three Quls, Ayat al-Kursi, the end of al-Baqarah and more. Tap the counter for each time. The day counts once the whole set is said. Each one carries its Sahih hadith.",
    why: "Small, fixed recitations kept every day add up, and the counter keeps your place so the mind can stay on the words.",
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
  body: {
    title: "Body",
    what: "Exercises and intermittent fasting on one page, each switchable in Settings. Exercises is your corrective week and the body-map catalog; Fasting is your eating window and a log of real fasts.",
    why: "Moving and eating are the two daily things the body asks for. Keeping them together makes the day's plan for the body one glance.",
  },
  fasting: {
    title: "Fasting",
    what: "Two kinds. Intermittent: one eating window a day by the clock, like 16:8. Islamic: from Fajr to Maghrib, with the times from your prayer city. Start a fast with a tap and break it with another; the ring shows how far you've come against the goal, and any time can be fixed afterwards.",
    why: "The plan and the log sit side by side, so you can see what you meant to do and what you did. There are no streaks: a shorter fast is still a fast.",
  },
  "islamic-fast": {
    title: "Kind of fast",
    what: "Intermittent follows the clock: you choose the hours you eat in. Islamic (sawm) follows the sun: no food or drink from Fajr to Maghrib, using the prayer times for the city in Settings, so it's longer in summer and shorter in winter.",
    why: "Logged before Fajr, an Islamic fast waits for Fajr to begin; broken after Maghrib, it's logged as ending at Maghrib, so tapping iftar late doesn't stretch it.",
  },
  "fast-window": {
    title: "Eating window",
    what: "The hours you eat in each day. Pick a protocol like 16:8 (fast 16 hours, eat in 8) and when the window opens, or set both ends yourself. A window can run past midnight.",
    why: "A fixed window turns a daily decision into a default. Changing it only affects fasts you start from then on; past fasts keep their own goal.",
  },
  braindump: {
    title: "Brain dump",
    what: "Five or ten minutes of writing out whatever is in your head, unfiltered: tasks, worries, ideas, reminders. When the timer ends you can circle what's actionable and it goes on your task list; the rest folds away and opens tomorrow. Before bed, keep it to a short list for tomorrow.",
    why: "Your mind keeps rehearsing unfinished things so it won't forget them. Written down, they're stored, and it can let go. Naming a worry also takes some of its heat, and the more specific you are, the more fully it lets go.",
  },
  meditation: {
    title: "Meditation",
    what: "Pick a practice and sit with it, full screen. Breathing ones show an orb that fills and empties with each breath, with the count inside; box and triangle trace their shape as you go. Dhikr counts on a ring of beads as you tap. Each is marked easy, medium or hard, and some change level with their setting.",
    why: "A few minutes of slow breathing or quiet attention settles the body and trains you to notice where your mind has gone. The levels are there so you can start where it's easy and stretch when you want to.",
  },
  garden: {
    title: "The garden",
    what: "A moonlit garden that grows one thing for each day you sit: wildflowers, a pond, a lantern, koi, and at the fourteenth the full moon on the water. A day without a sitting takes the newest thing away. Any sitting counts for its day, however short.",
    why: "It rewards coming back, not piling up minutes. A missed day costs one thing, and the next day you sit brings it straight back.",
  },
  scene: {
    title: "The scene",
    what: "Each practice has a place of its own with fourteen things to come into it. Every day you do the practice brings the next one; every day you miss takes the newest one away. Fourteen and it's whole. Today counts the moment it's done, and isn't held against you while it's still open.",
    why: "Consistency over everything else. There are no points and no totals, and nothing is banked: a missed day always costs one thing, and the next day you come back always earns it back. Every day you show up brings something, or keeps a whole scene whole.",
  },
  reading: {
    title: "Reading",
    what: "The books you're reading, on a shelf. Each time you read, log the page you started on and the page you stopped at, and a line about what stayed with you; keep a quote if one stood out. Each book gathers those notes in page order, and when you're ready you write the book in your own words.",
    why: "Writing a little after each sitting is how a book stays with you. A few lines a day add up to notes you'd never sit down and write in one go.",
  },
  "book-notes": {
    title: "Notes",
    what: "Every reading's note and quote, laid out in page order so they read like the book does. Switch to by-date to see them as a diary instead. Copy them as Markdown to keep them anywhere.",
    why: "Notes in page order turn into a summary almost on their own: read them through and the shape of the book is there.",
  },
} as const satisfies Record<string, { title: string; what: string; why: string }>;

export type GlossaryTerm = keyof typeof GLOSSARY;
