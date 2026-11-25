/**
 * Plain-language explanations of the app's own vocabulary, for the info tips
 * beside each term. One place, so a word means the same thing on every screen.
 *
 * Each entry answers what a new user actually wonders: what is this (`what`),
 * and why would I bother (`why`). Keep both to a sentence or two. The tip is a
 * reminder, not a manual.
 */
export const GLOSSARY = {
  minimum: {
    title: "The minimum",
    what: "The smallest version of a habit that still counts, like “Read one page”. Doing it completes the habit for the day.",
    why: "A bar you can clear on your worst day is the one that survives a worst day. Anything extra is a bonus, never required.",
  },
  dailies: {
    title: "Dailies",
    what: "Habits due today. Check one off once you've done its minimum.",
    why: "Showing up for the smallest version is enough to keep the habit alive.",
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
    what: "Habits you're trying to break, like scrolling in bed. Each one names a plan that makes the pattern harder to slip into.",
    why: "Tap Noticed when you catch it. That's useful information, not a failure. Tap Chose otherwise when you resist.",
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
    what: "A short evening ritual: optionally review your ending summary, pick tomorrow's frog, and empty what's still on your mind. Then the day hands off to rest.",
    why: "Tomorrow starts already decided, and the day ends instead of trailing off.",
  },
  endingSummary: {
    title: "Ending summary",
    what: "An optional first step when closing the day. It compares today's habits and hours against your monthly and weekday averages, and lets you note what worked, what to try tomorrow, and what to avoid.",
    why: "Completing it becomes a daily habit in Statistics, and yesterday's notes show up on Today and Day so each day improves on the last.",
  },
  mind: {
    title: "Mind",
    what: "Up to five practices for the head, each switchable in Settings. A brain dump empties your head onto the page for a few minutes. Meditation is a timer for breathing, dhikr and stillness that grows a garden. Reading keeps the books you're reading and the notes each one gathers. WOOP turns a wish into a plan for the obstacle in you. ABCDE takes a gloomy thought after a setback and argues back.",
    why: "Emptying your head, stilling it, feeding it, wanting well and thinking clearly about setbacks are all skills, and all get easier with a place to practise them.",
  },
  heart: {
    title: "Heart",
    what: "Four daily practices for the heart, each switchable in Settings: the five prayers in their times, a page of gratitude, a page of du'a, and a daily set of recitations from the Quran and the sunnah.",
    why: "Prayer, thanks, asking and remembrance are the heart's side of the day. Kept together, they sit in one place.",
  },
  prayer: {
    title: "The five prayers",
    what: "Fajr, Zuhr, Asr, Maghrib and Isha, each with its window for your city. Mark each one as you pray it; one prayed after its window closes can still be marked, as late. The day counts once all five are marked, and turns over when Isha's window closes, half an hour before the next Fajr.",
    why: "\"Prayer is light\" (Sahih Muslim 223). Five times a day, at set times, is what gives the day its shape; seeing them together makes the ones still to come easy to keep in mind.",
  },
  recitation: {
    title: "Daily recitation",
    what: "A set you choose of Quran, remembrance and Prophetic du'as, each shown in Arabic with transliteration and translation, and said as many times as you set: the three Quls, Ayat al-Kursi, the end of al-Baqarah, Sahih Prophetic supplications and more. Tap the counter for each time. The day counts once the whole set is said. Each one carries its Sahih hadith.",
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
    what: "Exercises and fasting on one page, each switchable (along with their scenes) in Settings. Exercises is your corrective week where checking off even one exercise counts the day; Fasting is your eating window, schedule and log of real fasts.",
    why: "Moving and fasting are the two rhythms the body asks for. Rest and off-schedule days hold your scenes steady without penalty.",
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
    what: "A moonlit garden that grows one thing for each day you sit: wildflowers, a pond, a lantern, koi, a teahouse, and at the sixtieth the full moon on the water. A day without a sitting takes the newest thing away. Any sitting counts for its day, however short.",
    why: "It rewards coming back, not piling up minutes. A missed day costs one thing, and the next day you sit brings it straight back.",
  },
  scene: {
    title: "The scene",
    what: "Each practice is made into a place of its own: reading builds a library, gratitude a village, a brain dump lightens a balloon, disputing a thought clears a river. Sixty things come into it, one for every day you do the practice; every scheduled day you miss takes the newest one away. Sixty and it's whole. Today counts the moment it's done, and scheduled rest days hold steady without penalty.",
    why: "Consistency over everything else. There are no points and no totals, and nothing is banked: a missed scheduled day always costs one thing, and the next day you come back always earns it back. Every day you show up brings something, or keeps a whole scene whole.",
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
