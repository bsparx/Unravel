/**
 * The guide to each practice: how it works for someone who has never done
 * it, and what the research says about why it's worth doing.
 *
 * Plain module, so the panels, Settings and the logic check share it.
 *
 * Nothing here is made up. Every study was checked against its DOI and its
 * PubMed abstract, and each `finding` paraphrases that abstract, effect sizes
 * included, without claiming more than it does. Figures not in the abstract
 * were read from the full text (PMC, or the authors' own copies). Quran verses are quran.com's
 * Saheeh International (translation 20). Hadith are quoted verbatim from the
 * sunnah.com English, and only Sahih: al-Bukhari, Muslim, or graded Sahih by
 * al-Albani. Where the evidence is modest, `limits` says so.
 */

export type GuideKey =
  "braindump" | "meditate" | "wishes" | "disputations" | "gratitude" | "dua";

export type EvidenceKind =
  "meta-analysis" | "review" | "trial" | "study" | "book" | "quran" | "hadith";

export type ResearchItem = {
  /** The benefit in one line, as a heading. */
  benefit: string;
  /** What was found, with its numbers; verbatim for Quran and hadith. */
  finding: string;
  /** The headline figure, shown large: "−37%", "time to fall asleep". */
  stat?: { value: string; label: string };
  kind: EvidenceKind;
  /** "Scullin et al., 2018 · Journal of Experimental Psychology: General" */
  cite: string;
  url: string;
  /** For studies on something close to the practice rather than it. */
  note?: string;
};

export type PracticeGuide = {
  key: GuideKey;
  title: string;
  /** The one-line promise on the welcome card. */
  promise: string;
  /** Three steps: what you actually do. */
  steps: readonly [GuideStep, GuideStep, GuideStep];
  /** What makes a good one. */
  tips: readonly { title: string; body: string }[];
  /** What beginners tend to get wrong. */
  mistakes: readonly string[];
  research: readonly ResearchItem[];
  /** The honest edge of the evidence. */
  limits: string;
  /** The practice's sky, for the welcome card. */
  sky: string;
};

type GuideStep = { title: string; body: string };

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  "meta-analysis": "Meta-analysis",
  review: "Systematic review",
  trial: "Randomised trial",
  study: "Experiment",
  book: "Book",
  quran: "Quran",
  hadith: "Sahih hadith",
};

const doi = (id: string) => `https://doi.org/${id}`;

// Shared: the affect-labelling study speaks to brain dumps and to writing du'a.
const LIEBERMAN_2007: ResearchItem = {
  benefit: "Naming a feeling quietens the brain's alarm",
  finding:
    "In an fMRI study of 30 adults, putting a feeling into words cut the amygdala's response to upsetting images compared with labelling something neutral about the same image (d = 0.79). People whose amygdala calmed most showed the most activity in the brain's regulating region (r = .51).",
  stat: {
    value: "d = 0.79",
    label: "calmer amygdala when the feeling is named",
  },
  kind: "study",
  cite: "Lieberman et al., 2007 · Psychological Science",
  url: doi("10.1111/j.1467-9280.2007.01916.x"),
};

export const GUIDES: Record<GuideKey, PracticeGuide> = {
  braindump: {
    key: "braindump",
    title: "Brain dump",
    promise: "Five minutes to get it out of your head and onto the page.",
    sky: "dump-sky",
    steps: [
      {
        title: "Set the timer",
        body: "Five minutes, or ten on a heavy day. Pick Everything, or Tomorrow's list in the minutes before bed.",
      },
      {
        title: "Write without stopping",
        body: "Tasks, worries, ideas, half-thoughts. Don't sort, don't fix the spelling. If you stall, write \"what else\" until something comes.",
      },
      {
        title: "Circle what's actionable",
        body: "When the timer ends, pick the few lines that are things to do. They go on your task list; the rest folds away until tomorrow.",
      },
    ],
    tips: [
      {
        title: "Unload it",
        body: "Your mind keeps rehearsing unfinished things so it won't forget them. Written down, they're stored, and it can stop.",
      },
      {
        title: "Name it",
        body: "Putting a feeling into words takes some of the heat out of it.",
      },
      {
        title: "Be specific",
        body: '"Email the landlord about the boiler" lets go more fully than "admin".',
      },
      {
        title: "Paper is best",
        body: "No notifications, no light. Done it on paper? Log it here so the day counts.",
      },
      {
        title: "Mind the hour",
        body: "First thing, before your phone, for a noisy morning. Right before bed, keep it to a short list for tomorrow; heavier worries are better after dinner.",
      },
    ],
    mistakes: [
      "Stopping to tidy or answer each thought. Get it down now; sort it later.",
      "Circling everything. Two or three tasks is plenty; the rest was just noise leaving.",
      "Pouring out heavy worries right before sleep. At bedtime, keep to tomorrow's list.",
    ],
    research: [
      {
        benefit: "A to-do list gets you to sleep 9 minutes sooner",
        finding:
          "57 adults wrote for 5 minutes before sleeping in a lab. Those who wrote a to-do list fell asleep in 15.8 minutes on average, against 25.1 for those listing what they'd already done: 37% faster (d = 0.63, p = .02). The more specific the list, the faster they slept (r = −.39).",
        stat: { value: "−37%", label: "time to fall asleep" },
        kind: "trial",
        cite: "Scullin et al., 2018 · Journal of Experimental Psychology: General",
        url: doi("10.1037/xge0000374"),
      },
      {
        benefit: "A written plan cuts intrusive thoughts by 41%",
        finding:
          "Students reminded of unfinished tasks rated their distraction by them at 3.00 during a reading task. Those who wrote a specific plan for the tasks rated it 1.77, a 41% drop and no different from people with nothing unfinished (1.82). They also answered more reading questions right: 6.94 of 8 against 6.13.",
        stat: {
          value: "−41%",
          label: "distracting thoughts after making a plan",
        },
        kind: "study",
        cite: "Masicampo & Baumeister, 2011 · Journal of Personality and Social Psychology",
        url: doi("10.1037/a0024192"),
      },
      LIEBERMAN_2007,
      {
        benefit: "Writing about what's on your mind helps, a little",
        finding:
          "Pooling 146 randomised studies, writing about personal, meaningful things improved health and wellbeing with an average effect of r = .075: reliable, but small.",
        stat: { value: "146", label: "randomised studies pooled" },
        kind: "meta-analysis",
        cite: "Frattaroli, 2006 · Psychological Bulletin",
        url: doi("10.1037/0033-2909.132.6.823"),
        note: "About expressive writing, of which a brain dump is a short, practical form.",
      },
    ],
    limits:
      "The sleep study was one lab study of 57 young adults, and the writing research finds real but small effects. A brain dump is a tool for a noisy head, not a treatment for anxiety or insomnia.",
  },

  meditate: {
    key: "meditate",
    title: "Meditation",
    promise:
      "A few slow minutes of breathing or stillness, with the counting done for you.",
    sky: "guide-sky-garden",
    steps: [
      {
        title: "Pick an easy one",
        body: "Start with box breathing at 4 counts for 5 minutes. It's marked easy. Try harder ones later.",
      },
      {
        title: "Follow the orb",
        body: "Breathe in as it grows, hold while it's still, breathe out as it shrinks. Sit upright and let your shoulders drop.",
      },
      {
        title: "Come back when you drift",
        body: "Your mind will wander. Noticing it and returning to the breath is the practice, not a failure of it.",
      },
    ],
    tips: [
      {
        title: "Short and daily beats long and rare",
        body: "Five minutes every day does more than an hour once a week.",
      },
      {
        title: "Breathe through your nose",
        body: "Slow and quiet, into the belly rather than the chest.",
      },
      {
        title: "Longer out-breaths settle you",
        body: "When you want to calm down, choose a practice where the out-breath is longest, like 4-7-8.",
      },
    ],
    mistakes: [
      "Trying to empty the mind. You can't; you only notice where it went and come back.",
      "Starting with a hard practice. Long holds make beginners light-headed; stay with easy ones first.",
      "Judging a sitting. A restless five minutes still counts.",
    ],
    research: [
      {
        benefit: "Meditation eases anxiety, depression and pain",
        finding:
          "Across 47 trials with 3,515 people, mindfulness programmes improved anxiety (effect size 0.38 at 8 weeks), depression (0.30) and pain (0.33), with benefits still there at 3–6 months (anxiety 0.22, depression 0.23). They were no better than exercise, drugs or therapy.",
        stat: { value: "0.38", label: "effect on anxiety after 8 weeks" },
        kind: "meta-analysis",
        cite: "Goyal et al., 2014 · JAMA Internal Medicine",
        url: doi("10.1001/jamainternmed.2013.13018"),
      },
      {
        benefit: "Five minutes of breathing a day lifts mood",
        finding:
          "108 adults practised for 5 minutes a day for a month. Positive mood rose 1.91 points per session with breathwork against 1.22 with mindfulness meditation (PANAS, 10–50 scale); box breathing alone gave +1.84 (p = .026). Exhale-focused breathing lowered breathing rate more than meditation (p < .05).",
        stat: { value: "+1.91", label: "mood points per 5-minute session" },
        kind: "trial",
        cite: "Balban et al., 2023 · Cell Reports Medicine",
        url: doi("10.1016/j.xcrm.2022.100895"),
      },
      {
        benefit: "Slow breathing calms body and mind",
        finding:
          "Of 2,461 studies screened, 15 met the bar. Across them, breathing under 10 times a minute consistently raised heart-rate variability, a marker of a calmer nervous system, and went with more relaxation and alertness and less anxiety, anger and confusion.",
        stat: {
          value: "< 10",
          label: "breaths a minute, the slow-breathing zone",
        },
        kind: "review",
        cite: "Zaccaro et al., 2018 · Frontiers in Human Neuroscience",
        url: doi("10.3389/fnhum.2018.00353"),
      },
      {
        benefit: "Belly breathing lowers stress hormones",
        finding:
          "40 adults were randomised; half trained in slow belly breathing (about 4 breaths a minute) for 20 sessions over 8 weeks. Their negative-mood score fell 2.55 points (p = .02) while the control group's didn't move (−0.15), and their cortisol dropped significantly where the control group's didn't (η² = .20). Sustained attention improved too.",
        stat: {
          value: "−2.55",
          label: "points of negative mood after 8 weeks",
        },
        kind: "trial",
        cite: "Ma et al., 2017 · Frontiers in Psychology",
        url: doi("10.3389/fpsyg.2017.00874"),
      },
    ],
    limits:
      "Effects are real but small to moderate, and meditation wasn't better than exercise or therapy. Some of these studies are small. If you have a heart or breathing condition, skip long breath holds.",
  },

  wishes: {
    key: "wishes",
    title: "Wishes (WOOP)",
    promise:
      "Turn a wish into a plan for the thing in you that gets in the way.",
    sky: "woop-sky-wish",
    steps: [
      {
        title: "Wish, then picture the best of it",
        body: "Name something you want that's challenging but doable, in a few words. Then picture the best thing about getting there, vividly, for a moment.",
      },
      {
        title: "Find the obstacle in you",
        body: "The honest part: what in you is most likely to stop you? A habit, a feeling, an excuse. Not the world or other people; you.",
      },
      {
        title: "Make it an if-then",
        body: '"If I reach for my phone when it gets hard, then I\'ll put it in the other room and write one more line." Rehearse the card once a day.',
      },
    ],
    tips: [
      {
        title: "The obstacle is inside you",
        body: '"My boss" isn\'t one you can plan for. "I freeze and put it off when I\'m unsure" is.',
      },
      {
        title: "Tiny, concrete plans",
        body: '"Open the file and write one sentence" beats "try harder". The plan should be something you could do in a minute.',
      },
      {
        title: "Rehearse it",
        body: "Reading the if-then again each day keeps it ready for the moment the obstacle shows up.",
      },
    ],
    mistakes: [
      "Stopping at the outcome. Picturing only the good part feels great and can drain the effort; the obstacle is what makes it work.",
      "Naming an outside obstacle. Pick the part you control: your reaction, your habit, your mood.",
      "A vague plan. If you can't picture yourself doing it in the moment, make it smaller.",
    ],
    research: [
      {
        benefit: "If-then plans help you reach goals",
        finding:
          "Pooling 94 independent tests, writing an if-then plan for when and how to act had a medium-to-large effect on reaching goals (d = .65). It helped people get started, stay on track when distracted, and drop failing approaches.",
        stat: {
          value: "d = .65",
          label: "effect of if-then plans across 94 tests",
        },
        kind: "meta-analysis",
        cite: "Gollwitzer & Sheeran, 2006 · Advances in Experimental Social Psychology",
        url: doi("10.1016/S0065-2601(06)38002-1"),
        note: "About implementation intentions, the P in WOOP.",
      },
      {
        benefit: "WOOP itself works, with a small-to-medium effect",
        finding:
          "Across 21 studies and 15,907 people, mental contrasting with implementation intentions (the method behind WOOP) improved goal attainment (g = 0.34). It worked better when practised with a guide (g = 0.47) than from written instructions alone (g = 0.28).",
        stat: {
          value: "g = 0.34",
          label: "effect on reaching goals, 15,907 people",
        },
        kind: "meta-analysis",
        cite: "Wang, Wang & Gai, 2021 · Frontiers in Psychology",
        url: doi("10.3389/fpsyg.2021.565202"),
      },
      {
        benefit: "Twice as much exercise for four months",
        finding:
          "256 women aged 30–50 were randomised. Those who also learned mental contrasting with if-then plans were twice as physically active as those given health information only, nearly 1 hour more a week, from the first week through all 4 months.",
        stat: { value: "2×", label: "weekly physical activity" },
        kind: "trial",
        cite: "Stadler, Oettingen & Gollwitzer, 2009 · American Journal of Preventive Medicine",
        url: doi("10.1016/j.amepre.2008.09.021"),
      },
      {
        benefit: "60% more practice, from one 30-minute session",
        finding:
          "66 high-school students were randomised before their summer break. Those who did a 30-minute written WOOP-style exercise completed 140 practice questions for a big exam on average, against about 84 for the control group (β = .27, p = .04).",
        stat: { value: "+60%", label: "practice questions completed" },
        kind: "trial",
        cite: "Duckworth et al., 2011 · Educational Psychology",
        url: doi("10.1080/01443410.2010.506003"),
      },
      {
        benefit: "Why the obstacle matters: daydreaming alone backfires",
        finding:
          "40 graduates were followed for 2 years. The more positively they daydreamed about their career, the fewer job offers they got (r = −.39), the less they earned (r = −.29) and the fewer applications they sent (r = −.40). Confident expectations, by contrast, predicted more offers (r = .41).",
        stat: { value: "r = −.39", label: "positive daydreams vs. job offers" },
        kind: "study",
        cite: "Oettingen & Mayer, 2002 · Journal of Personality and Social Psychology",
        url: doi("10.1037/0022-3514.83.5.1198"),
      },
    ],
    limits:
      "WOOP's pooled effect is small to medium (g = 0.34), and the meta-analysis found signs of publication bias, so the true effect may be smaller. The daydreaming study is correlational, and several of these samples are small.",
  },

  disputations: {
    key: "disputations",
    title: "Disputation (ABCDE)",
    promise:
      "When a setback leaves a harsh thought behind, argue back like a good lawyer.",
    sky: "abcde-sky-energization",
    steps: [
      {
        title: "Write what happened and what you told yourself",
        body: "A is the event, just the facts. B is the thought it set off, word for word, however harsh. C is what it did to you.",
      },
      {
        title: "Argue back",
        body: "D is the disputation. Check it against the evidence, think of other explanations, ask how bad it really is, and whether the thought is even useful.",
      },
      {
        title: "Notice the shift",
        body: "E is how you feel now. Rate how much you believe the thought before and after; the drop is the point.",
      },
    ],
    tips: [
      {
        title: "Argue as if someone else said it",
        body: "You'd defend a friend against an unfair accusation. Do the same for yourself.",
      },
      {
        title: "Evidence first",
        body: "What actually supports the thought, and what doesn't? Facts, not feelings.",
      },
      {
        title: "Look for the specific cause",
        body: '"I didn\'t prepare that topic" can be fixed. "I\'m hopeless" can\'t. Prefer causes that are temporary and specific.',
      },
    ],
    mistakes: [
      'Writing a feeling under B. "I feel awful" belongs in C; B is the thought, like "I\'ll never get a job".',
      "Swapping in empty positives. \"I'm amazing\" won't hold; an accurate thought will.",
      "Skipping the rating. Without before and after, it's hard to see that it worked.",
    ],
    research: [
      {
        benefit: "The method comes from Learned Optimism",
        finding:
          "ABCDE is Martin Seligman's adaptation of cognitive therapy for everyday setbacks: catch the belief that follows adversity, then dispute it with evidence, alternatives, implications and usefulness.",
        kind: "book",
        cite: "Seligman, 1990 · Learned Optimism",
        url: "https://en.wikipedia.org/wiki/Learned_optimism",
      },
      {
        benefit: "Learning to dispute thoughts lowers depressive symptoms",
        finding:
          "Across 17 studies with 2,498 young people, the Penn Resiliency Program, which teaches this kind of disputing, reduced depressive symptoms against no programme, with effect sizes of 0.11 to 0.21 at the end, at 6–8 months and at 12 months.",
        stat: { value: "12 months", label: "benefit still there a year later" },
        kind: "meta-analysis",
        cite: "Brunwasser, Gillham & Kim, 2009 · Journal of Consulting and Clinical Psychology",
        url: doi("10.1037/a0017671"),
      },
      {
        benefit: "Its parent, CBT, is among the best-tested therapies",
        finding:
          "Reviewing 106 meta-analyses, the strongest support for cognitive behavioural therapy was for anxiety, anger and general stress. In 7 of the 11 reviews comparing response rates, CBT beat the comparison; in only 1 did it do worse.",
        stat: { value: "7 of 11", label: "head-to-head reviews where CBT won" },
        kind: "review",
        cite: "Hofmann et al., 2012 · Cognitive Therapy and Research",
        url: doi("10.1007/s10608-012-9476-1"),
        note: "About CBT as a whole, whose core skill is challenging thoughts like this.",
      },
    ],
    limits:
      "The programme effects are small, and it wasn't shown to beat other active programmes. This is a self-help habit for everyday setbacks; it isn't therapy, and it doesn't replace help for depression.",
  },

  gratitude: {
    key: "gratitude",
    title: "Gratitude",
    promise: "A minute or two each evening noticing what was good today.",
    sky: "thanks-sky-early",
    steps: [
      {
        title: "Pick a template",
        body: "Start with Good things, three of them. Later try What went well, and why, or a letter of thanks.",
      },
      {
        title: "Write small, specific things",
        body: '"Ammi called just to check on me" beats "my family". Each one lights a lantern.',
      },
      {
        title: "Ask why it happened",
        body: "A few words on why. It's where you notice your own part, and other people's kindness.",
      },
    ],
    tips: [
      {
        title: "Specific over grand",
        body: "A single moment you can picture works better than a whole category.",
      },
      {
        title: "New each day",
        body: "Try not to repeat yesterday's list. Looking for new things is what trains your attention.",
      },
      {
        title: "Evenings work well",
        body: "Looking back over the day just before you wind down is the classic way.",
      },
    ],
    mistakes: [
      "Writing the same three things every day. It turns into a ritual without attention.",
      "Forcing it on a terrible day. One small thing is enough; it's allowed to be tea.",
      "Making it a comparison (\"at least I'm not…\"). Thank for what is, not for others' bad luck.",
    ],
    research: [
      {
        benefit: "Counting blessings: better weeks, more exercise",
        finding:
          "192 students kept a weekly list for 9 weeks. The gratitude group exercised 4.35 hours a week against 3.01 for those listing hassles (+45%), reported fewer physical symptoms (3.03 vs 3.54) and rated their lives higher (5.05 vs 4.67), and were more optimistic about the week ahead (5.48 vs 5.11).",
        stat: {
          value: "+1.3 h",
          label: "exercise a week in the gratitude group",
        },
        kind: "trial",
        cite: "Emmons & McCullough, 2003 · Journal of Personality and Social Psychology",
        url: doi("10.1037/0022-3514.84.2.377"),
      },
      {
        benefit: "Three good things: still happier 6 months on",
        finding:
          "In a placebo-controlled trial of 577 adults, the 59 who wrote three good things and why each night for one week were happier than at the start one, three and six months later (effect size .50 on happiness at six months) and less depressed (.28). The placebo group was back to baseline within a week.",
        stat: {
          value: "6 months",
          label: "happier after one week of practice",
        },
        kind: "trial",
        cite: "Seligman, Steen, Park & Peterson, 2005 · American Psychologist",
        url: doi("10.1037/0003-066X.60.5.410"),
      },
      {
        benefit: "It helps, modestly",
        finding:
          "Pooling the studies, gratitude exercises raised psychological wellbeing against doing nothing (d = .31) and against a neutral activity (d = .17), and gratitude itself (d = .46). They didn't reduce anxiety (d = .11) and were no better than other active exercises (d = −.03).",
        stat: {
          value: "d = .31",
          label: "wellbeing gain against doing nothing",
        },
        kind: "meta-analysis",
        cite: "Davis et al., 2016 · Journal of Counseling Psychology",
        url: doi("10.1037/cou0000107"),
      },
      {
        benefit: "Gratitude brings increase",
        finding:
          "And [remember] when your Lord proclaimed, 'If you are grateful, I will surely increase you [in favor]; but if you deny, indeed, My punishment is severe.'\"",
        kind: "quran",
        cite: "Ibrahim 14:7 · Saheeh International",
        url: "https://quran.com/14/7",
      },
      {
        benefit: "Good in every affair",
        finding:
          "Suhaib reported that Allah's Messenger (ﷺ) said:Strange are the ways of a believer for there is good in every affair of his and this is not the case with anyone else except in the case of a believer for if he has an occasion to feel delight, he thanks (God), thus there is a good for him in it, and if he gets into trouble and shows resignation (and endures it patiently), there is a good for him in it",
        kind: "hadith",
        cite: "Sahih Muslim 2999 · Sahih",
        url: "https://sunnah.com/muslim:2999",
      },
    ],
    limits:
      "The research finds gratitude exercises help, but modestly: they beat doing nothing and neutral tasks, not other good habits, and they didn't reduce anxiety. Think of it as a small daily lift, not a cure.",
  },

  dua: {
    key: "dua",
    title: "Du'a",
    promise: "A few quiet minutes to write what you're asking Allah for.",
    sky: "dua-sky-maghrib",
    steps: [
      {
        title: "Pick a shape",
        body: "A short list of du'as is a good start. Circles of du'a widens from you to the ummah; With its adab follows the full order.",
      },
      {
        title: "Begin with praise",
        body: "Open with hamd and salawat, then ask, plainly and specifically, as someone who will be answered.",
      },
      {
        title: "Ask for others too",
        body: "Family, friends, the ummah, those who have passed. Then close with salawat and ameen.",
      },
    ],
    tips: [
      {
        title: "Ask specifically",
        body: '"The right words with my father this weekend" is something you\'ll notice being answered.',
      },
      {
        title: "Ask with certainty",
        body: "Ask as someone who will be answered, in the way and time that's best.",
      },
      {
        title: "Keep going",
        body: "Write the same du'a for days or weeks if it's what you need. The pages become a record of what you carried.",
      },
    ],
    mistakes: [
      'Saying "I asked and wasn\'t answered" and stopping; the hadith below names that impatience.',
      "Keeping it vague because it feels too small. Nothing is too small to ask for.",
      "Only asking for yourself. Asking for others in their absence is answered for you too.",
    ],
    research: [
      {
        benefit: "He is near, and He answers",
        finding:
          "And when My servants ask you, [O Muḥammad], concerning Me - indeed I am near. I respond to the invocation of the supplicant when he calls upon Me. So let them respond to Me [by obedience] and believe in Me that they may be [rightly] guided.",
        kind: "quran",
        cite: "Al-Baqarah 2:186 · Saheeh International",
        url: "https://quran.com/2/186",
      },
      {
        benefit: "Call upon Me",
        finding:
          'And your Lord says, "Call upon Me; I will respond to you." Indeed, those who disdain My worship will enter Hell [rendered] contemptible.',
        kind: "quran",
        cite: "Ghafir 40:60 · Saheeh International",
        url: "https://quran.com/40/60",
      },
      {
        benefit: "Du'a is worship itself",
        finding:
          "An-Nu`man bin Bashir narrated that:The Prophet said: “The supplication, is worship.” Then he recited: And Your Lord said: “Call upon me, I will respond to you. Verily, those who scorn My worship, they will surely enter Hell humiliated",
        kind: "hadith",
        cite: "Jami' at-Tirmidhi 3372 · Sahih (al-Albani)",
        url: "https://sunnah.com/tirmidhi:3372",
      },
      {
        benefit: "Answered, if you don't give up",
        finding:
          'Narrated Abu Huraira:Allah\'s Messenger (ﷺ) said, "The invocation of anyone of you is granted (by Allah) if he does not show impatience (by saying, "I invoked Allah but my request has not been granted)',
        kind: "hadith",
        cite: "Sahih al-Bukhari 6340 · Sahih",
        url: "https://sunnah.com/bukhari:6340",
      },
      {
        benefit: "Asking for others comes back to you",
        finding:
          "Abu Dharr reported that Allah's Messenger (ﷺ) said:There is no believing servant who supplicates for his brother behind his back (in his absence) that the Angels do not say: The same be for you too",
        kind: "hadith",
        cite: "Sahih Muslim 2732 · Sahih",
        url: "https://sunnah.com/muslim:2732a",
      },
      {
        ...LIEBERMAN_2007,
        note: "About putting things into words, which writing a du'a does. It says nothing about prayer itself.",
      },
    ],
    limits:
      "Du'a is worship, and its worth rests on the Quran and sunnah, not on studies. The one study here is about the act of putting things into words, not about prayer or whether it's answered.",
  },
};

export const GUIDE_KEYS = Object.keys(GUIDES) as GuideKey[];
