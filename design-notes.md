# Design notes

Log of the design decisions per surface, so new pages don't unconsciously
re-derive (or drift from) the ones already made.

## The brief

**Unravel** — a productivity app for people with ADHD. The audience is
someone who has thirteen things they mean to do, no felt sense of how long any
of them take, and who loses the thread the moment a screen gets busy.

Every surface has one job: **make the next action obvious and make time
visible.** If a screen is asking you to make more than one decision, it's wrong.

## Direction: "Calm focus"

Deliberately *not* the two defaults it would otherwise land on: not the
cream-paper/serif/terracotta AI house style, and not untouched shadcn
zinc + Geist + `--radius: 0.5rem`.

### Palette

Tokens live in `app/globals.css` under `:root` / `.dark`, exposed to Tailwind v4
through `@theme inline`. There is no `tailwind.config.ts` — Tailwind v4 is
CSS-first.

| Role | Light | Dark | Notes |
| --- | --- | --- | --- |
| Paper (background) | `#faf7f2` | `#14120f` | Warm, not blue-grey. Reads as paper, not as a dashboard. |
| Ink (foreground) | `#1c1a17` | `#ece6dc` | Warm near-black; pure `#000` is harsh at this contrast. |
| Teal (primary) | `#2f6f6a` | `#6fb3ab` | Muted, low-chroma. Actions and links. |
| **Blue (running)** | `#3b6fb0` | `#7ba7de` | **Reserved.** Means "work is on the clock" and nothing else. |
| **Slate blue (rest)** | `#5a7f8c` | `#7fa6b3` | **Reserved.** Recovery, and only recovery. |
| Clay (destructive) | `#b85c4a` | `#d4796a` | Overdue and delete. A warm relative of the palette, not `red-500`. |
| Warm grey (muted) | `#8a8378` | `#9d9488` | Secondary text. |

Calendar blocks are coloured by **kind, never by state**: work is a wash of
teal, recovery a wash of slate blue, buffer a dashed grey. The now-line is the
only running-blue on that screen. A planned block borrowing it would make an
entire untouched day look like it was already in progress — the reservation holds on
the calendar exactly as it holds everywhere else.

The running-colour reservation is the single most load-bearing rule here. If it
appears on a button, a badge, or a chart series that isn't about a live work
timer, the signal is diluted and the design has failed.

The running colour was amber (`#c97b27` / `#e0a050`) until it was deliberately
moved to blue: a calmer hue to sit under for twenty-five minutes at a stretch,
on a ring large enough to dominate the screen. The reservation is unchanged —
only the hue it is spent on.

Recovery got its **own** colour rather than a tint of the running one,
deliberately. Rest is a peer of work, not a variation on it, and a paler shade
of work would have said the opposite.

**This is the cost of the move to blue, and it is a real one.** Work and rest
used to be temperature-opposed — warm for work, cool for rest — so which kind
of time was running read from across the room, including in the mini badge
where the label is too small to see. Both are now cool, and the pair is carried
entirely by hue and chroma: work is a true blue at ~50% saturation, recovery a
desaturated grey-teal. That still separates, but it is a weaker signal than
temperature was. If the two are ever confused in use, recovery is the one to
move — it has no reservation to protect.

### Typography

Wired via `next/font/google` in `lib/fonts.ts` → CSS variables → `@theme inline`.

- **Newsreader** (`--font-display`) — headings and the task title on the timer.
  A quiet serif; keeps the app from reading like a SaaS dashboard.
- **Karla** (`--font-sans`) — body. Slightly humanist, easy at small sizes.
- **JetBrains Mono** (`--font-mono`) — every numeral: timer digits, durations,
  counts. Always with `.tnum` (tabular figures) so digits don't jitter as they
  count.

A real type scale (`--text-micro` … `--text-display`) is defined in `@theme`
with paired line-heights and letter-spacing, rather than reaching for the bare
`text-sm/base/lg/xl` staircase.

### Shape and elevation

`--radius: 0.625rem` — soft, not pill. Flat surfaces with hairline borders;
**no `shadow-sm` on every card**. The elevation budget is spent in exactly one
place: the timer.

### Layout archetype

Persistent left rail on desktop, bottom bar on mobile; a single focused column
of content. Explicitly not a centred `max-w-7xl` three-column card grid — the
content here is a prioritised list and one big clock, neither of which is a set
of equivalent tiles.

### Signature element

**The draining containers, and their deliberate absence.**

For work: two concentric containers rendered per frame in WebGL
(`decay-field.tsx` + `decay-field.glsl.ts`), modelled on a physical Time Timer —
the standard tool for making duration legible when your internal clock doesn't
cooperate.

- **Macro**, a thin outer ring: the whole plan, *breaks included*. A 3×25 block
  is 85 minutes of your afternoon, not 75, and this is the thing that says so.
  Boundaries are cut as gaps, so a block is legible as three pomodoros before
  anything has started.
- **Micro**, a thick inner well: the interval you are in right now. It is the
  one that moves fast enough to feel, which is the whole reason for showing two.

Below them is a hole, not a disc: the digits live there, and a filled container
behind warm mono type is unreadable at this contrast. The two collapse to one
when the plan is a single interval (BASIC, FLOW), because two rings showing the same
number is a duplicate drawn at a different radius. In flow mode, past the target
a third ring grows outward and the digits count up instead of down.

**Why this is rendered rather than transitioned.** The SVG version it replaced
rode on the provider's 250ms re-render and covered each jump with a 300ms eased
transition — a hold, then a catch-up, permanently a third of a second behind
and visibly stepping. What a person saw was an animation *standing in for*
time. The shader reads `Date.now()` itself every frame and takes nothing from
React, so the face is the clock. The same property that makes it fluid is what
makes it truthful: because every frame is derived rather than advanced, a
throttled tab or a suspended laptop resumes at the right value instead of
easing toward it.

`TimerArc` is kept as the server render, the pre-hydration paint and the
no-WebGL fallback. The face must never be a hole in the page.

For recovery: **nothing moves.** A flat static ring in the same 260px footprint
so the page doesn't jump, and digits counting up. No dasharray, no ticks, no
progress of any kind. This is a separate component (`recovery-face.tsx`), not a
variant of the arc — `TimerArc`'s whole contract is "draw a target being
consumed", and recovery has no target to consume. A ring that drained would
turn rest into a countdown, which is the exact failure the mode exists to
prevent.

The pair *is* the signature: the same screen, the same footprint, two opposite
answers to "how much is left".

Everything else on the timer screen is quiet so the faces carry the page.

### Motion

Three named animations, all under 400ms, defined in `@theme` next to the
colours: `breathe` (attached to exactly one element), `rise` (content
arriving, 6px — enough to read as settling, not as flying in) and `pop`, the
only overshoot in the app, spent entirely on the moment something gets ticked
off. That moment is the reward loop of a task list; everywhere else, bounce
reads as noise.

`prefers-reduced-motion` is honoured with **one global rule** in `globals.css`,
not a `motion-reduce:` variant per element. A per-element variant is something
you have to remember on every new component, and forgetting it fails silently
for everyone who didn't ask for less motion.

On a screen built for people who are easily pulled off task, ambient movement
is a cost. Motion here either confirms something you just did or shows
something arriving. Nothing moves to be decorative.

**The timer face is the one continuous exception, and it does not break that
rule — it is the reason for it.** The movement there *is* the quantity being
measured; the depletion is the information, not a presentation of it. That
licence is narrow, and the file is written to keep it narrow: the frame loop
runs only while the clock does, an idle or paused face is completely still, and
there is no ambient shimmer, drift or idle breathing anywhere in the shader.

It follows that `prefers-reduced-motion` **cannot** be handled here by the
global rule that kills every duration — that rule governs CSS, and a WebGL loop
is invisible to it. Reduced motion switches off the grain drift and nothing
else. Freezing the depletion would remove the feature rather than calm it,
which is the wrong reading of the request: someone asking for less motion is
not asking to stop being able to see how much time is left.

Haptics are the same idea in another channel — a short pulse at 50% and 10% of
the current interval, for when you have stopped looking at the face. Separate
from `soundEnabled` (`User.hapticsEnabled`), because a phone face-down on the
desk is exactly when the chime is off.

## Per-surface log

| Surface | Archetype | Notes |
| --- | --- | --- |
| `/` (signed out) | Centred single column | The landing. Renders inside the same nav-less `(focus)` layout as the one-thing screen. |
| `/` (signed in) | One card, one button | **The home screen.** A single next action and nothing else — no list, no counts, no badges. Everything else is behind three quiet underlined links at the bottom. |
| `/day` | Single focused column, grouped list | The full picture, one tap away: habits due, overdue, due today, anytime. |
| `/inbox` | Flat list, row actions | Triage. Deliberate, unlike capture — which is why it's a page and the dump box isn't. |
| `/tasks` | Grouped list by project | Filters as quiet segmented control, not tabs-as-chrome. Edit and start-timer are hover-revealed row actions; the row body itself is always the timer. |
| `/tasks/[id]` | Single column form + log | Create and edit are the same form. Delete is behind one dialog — it takes the session history with it. Every row in the log is correctable in place. |
| `/calendar` | Two columns: grid + scheduling panel | Week by default, day on request. Blocks are dragged and resized directly; the panel is the only place anything is "assigned" a time by pressing a button. Gaps between blocks are drawn as transitions, live while you drag — the space between two things is where a plan comes apart, and it was the only thing on this page not rendered. |

The calendar's second pass: **a week you can see the shape of.** The grid was
information-correct and analytically exhausting — the header asked for
arithmetic ("2h 30m claimed · longest free stretch 1h 15m") from an audience
whose felt sense of duration is exactly what the app exists to replace. Three
changes, all of them re-readings of existing data:

- **Day is the default view** (`?view=` absent → day, anchored on today). The
  rail's "Plan" link is a bare `/calendar`, and a person arriving there
  mid-week is planning one day, not seven. Week remains one explicit toggle
  away, and every link that knows better passes its own `?view=`.
- **The header reads as one sentence.** "Next up: Draft the intro at 15:00 ·
  2h 05m open before it." — the app's "make the next action obvious" principle
  applied to the planning surface, computed server-side (safe: Server
  Components don't re-render, so there is nothing to hydrate-mismatch).
- **The week strip row.** Each day header carries a 6px bar of its waking
  hours, filled by kind with the same vocabulary as `/day`'s PlanStrip — the
  two are the same glance at different scales. Clay ticks mark switches with
  no room; the running-blue line marks now (the reservation holds; it is still
  only ever a clock). The header row *is* the legend, so there is no legend.
  Strips draw in left-to-right on load (`draw`, 350ms, staggered 40ms/day) —
  the page's single orchestrated moment, the same narrow licence the timer
  face holds.
- The "How to use this" box is gone. Instructions are a debt paid per reader;
  affordances are paid once. Half-hour targets show a dashed inset outline on
  hover/focus, the resize handle is already hover-revealed, and the panel's
  hint line already names the drag. The buffer wisdom ("a day planned wall to
  wall is a day you abandon by eleven") is still spoken — by the strips, which
  make a wall-to-wall day unmissable.
- The scheduling panel groups Habits and Open tasks under quiet labels when
  both are present, and the section header carries a count ("· 2 left") — a
  small number of remaining decisions, which is a motivating number for this
  audience.
| `/habits` | List + 8-week adherence grid | Grid is a heatmap row per habit; teal ramp, never the running colour. Two weights of teal for done — full for optimal, half for minimum — because collapsing them throws away the whole point of two quotas. Today's quota meter sits above the grid: history below, the one actionable thing above. |
| `/habits/stats` | Filters, then charts, then a per-habit table | shadcn/recharts. Optimal is the full primary and minimum is the same hue at half strength — a good day is *more of the same thing*, not a different metric. Missed is clay; skipped is neutral grey, because a deliberate "not today" is not a failure. |
| `/timer` | Full-bleed, centred, minimal chrome | Elevation budget spent here — and since the face is a shader, the "elevation" is a lighting gradient rather than a shadow. The face is the page. One quiet line under the controls carries the day's total for the task, live; correcting it opens today's sessions in place. A break that runs over takes the controls over entirely — two buttons, clay, counting up — because the moment it catches you is the moment you have the least attention to spend on a menu. |
| `/close` | One input per screen, vertically centred | Ritual, not a form. No progress bar, no "step 2 of 4", no back/next chrome — just the question and one quiet way out. |
| `/stats` | Dense, chart-first | Work and recovery get identical panel width, bar height and type scale. The running colour only where the series genuinely is work on the clock. "Getting back" reports overruns as a median and only speaks up when there is a real gap between the break you pick and the break you take. |
| `/water` | One vessel, centred | The day as a column of water — the structural rhyme to the timer's draining ring (time drains, water fills). One tap anywhere on the vessel logs a glass; the count is the only big number and gets the mono display and the app's one overshoot. Edit and reminders sit below in quiet cards. |
| `/budget` | Two charts, one ledger | Money in is the teal of anything going well; money out is the clay of "the thing to notice" — the only two semantic colours the palette spends, and the pair is the whole story of a month. The headline sentence does the arithmetic ("…spent 61,000 and brought in 85,500 — 24,500 ahead"), the month is the grain (‹ August ›), and logging is a dialog, never a navigation. Categories sit on one side of the ledger each, wearing the existing chart hues — no new colour, and clay is never a category. |
| `/settings` | Single column form | Timezone first — everything date-bucketed depends on it. |

### Two structural rules

**The nav-less layout is a route group, not a conditional.** `/` and `/close`
live in `app/(focus)/`, which has no rail and no bottom bar. Making the quiet
structural rather than a `usePathname()` check means it can't be eroded later by
someone adding "just one" link.

**Steps lead, tasks follow.** Anywhere a task with steps is rendered — a row,
the one-thing card, the timer — the *next unticked step* is what gets the
emphasis, and the task title becomes context. A task title is a scope; a step
is a handle. See the "first step" rules in `lib/steps.ts`.

**The minimum is the bar, and the design has to say so.** Every surface that
shows a quota draws progress against the *optimal* with the minimum as a notch
partway along — so how little "enough" actually is stays visible. Filling to
that notch changes the bar's colour: that moment is "the streak is safe", and
it's the single most important piece of feedback in the feature.

**A plan and a log are different objects.** `TimeBlock` is what you intended;
`FocusSession` is what happened. They are never merged, because the gap between
them is the most useful thing the app can show you, and it vanishes the moment
planning writes to the log.

**A measurement is not a claim, and the log holds both.** While a session runs
the server is the sole authority on its duration — a number from the client is
only ever a cross-check. Once it has ended that flips: the person is the
authority on where their time went, and every finished session is correctable
in minutes, from the summary screen the moment it ends and from the task's or
habit's log any time after.

This is not a convenience. An uncorrectable log fails in both directions. It
can't hold the two hours you did on the train, so the log is quietly incomplete
and you stop reading it. Worse, it can't disown the seventeen hours a timer
racked up overnight against a five-minute task — and that number doesn't just
sit there, it flows into the day roll-up, the estimate you'd have learned, and
on a MINUTES habit into the day's quota, tier and streak. **A confidently wrong
number is worse than a missing one**, and for an audience whose whole reason
for being here is a broken felt sense of duration, one bad figure is enough to
make the entire record untrustworthy.

Three rules keep the correction honest:

- It **overwrites** `FocusSession.elapsedSeconds` rather than living beside it.
  Every aggregate in the app reads that column; a parallel "corrected" column
  would mean auditing all of them forever, and one that got missed would
  disagree with the others in a chart nobody looks at twice.
- What the clock actually saw is kept in `measuredSeconds`, and the corrected
  row keeps saying so. The gap between measured and claimed is worth more than
  a tidy list — it's what stops an estimate being read back later as a
  measurement.
- It is the **only** path allowed to move habit progress downward, and it splits
  the figure first: the part the clock earned follows the clock down, anything
  above it was entered by hand and is a floor. Correcting a bad session must
  never revoke a day someone explicitly claimed.

Zero is a valid correction and does not delete the row. "This didn't happen" is
a thing people need to be able to say about a timer they left running, and the
record that the mistake was made is worth keeping.

**The session clock and the day's total are two different numbers, and `/timer`
shows both.** The big readout answers "how far into *this* sitting am I" — the
right question for the face, and the wrong one to plan an afternoon on, because
it resets every time you press start. Someone who already gave a task two hours
this morning sees `08:14` and has nothing on screen saying otherwise. So the
day's total sits under the controls, quiet and muted, and ticks while the clock
runs.

It has to be assembled on the client: `TaskOccurrence.loggedSeconds` is only
written by `endSession`, so mid-session the true total for today exists nowhere
else. The server sends the committed part and the live seconds are added on top
— which is also why the server must not include them, or every running second
would be counted twice.

**The total is displayed; the sessions under it are what's editable.** Editing
the roll-up directly would have to guess which session was wrong, and on the
day that matters most — one runaway session among several good ones — it would
guess wrong. So "fix today's times" expands the same `SessionLog` the task and
habit pages use. The session still on the clock is deliberately absent from it:
a live row can't be corrected because the next heartbeat would overwrite the
correction, and the panel says so rather than showing a control that fails.

**The dump box is never a route.** It's mounted once in a shared layout and
opens over whatever you're looking at. The moment capture requires a navigation
you've added a decision point, and the thought is already gone.

**The gap between two things is an object, not an absence.** The app made time
visible for everything you were *doing* and left the space between untouched —
which is precisely backwards for this audience. Switching from one task to
another is work: it takes a length of time, that length is knowable, and a plan
that allots it nothing fails at the first switch and cascades from there. It
shows up in two places, and they are the same idea:

- **On `/timer`, a break stays on the clock past its own boundary.** It used to
  advance to the next focus interval and immediately pause. A paused clock
  accumulates nothing, so the five minutes that became forty were not merely
  unannounced — they were *never recorded*, and afterwards there was no evidence
  they had happened. The app went blind at the exact moment it was needed. Now
  the break overruns in place: still measured, still visible, counting up in
  clay, and written to `SessionInterval.overtimeSeconds` when it finally closes.
- **On `/calendar`, gaps are drawn.** `freeSlots` had always computed them; only
  a header stat consumed them. `lib/transitions.ts` turns them into objects with
  a length and a verdict, and a switch with no room in it gets said out loud —
  at drop time, before the plan is made, not after.

Three things keep it honest:

- **Nothing auto-starts.** The old rule — an unattended break must not quietly
  become focus time — still holds, and holds harder: the overrun accrues against
  the *break* and is credited to no task at all. The forcing function is that
  the number is on screen, not that the app decides for you.
- **Time taken on purpose is not time that got away.** "5 more minutes" raises
  the interval's own target, so it lands in `extended`; walking away leaves the
  target alone, so it lands in `overrun`. On a clock these are identical and
  they mean opposite things, and the `/stats` panel is worthless if it can't
  tell them apart.
- **A transition is derived, never stored.** A `TimeBlock` row would need
  reconciling on every drag, resize and delete, and would eventually disagree
  with the blocks around it. A derived value cannot drift. The one exception is
  a habit-stack cue, which is *built* to abut its habit — flagging that would be
  the calendar objecting to the only deliberate adjacency in the day.

**Clay now carries a third meaning, and it does not encroach on the running
colour.** It was destructive actions and a missed habit; it is now also a break
past its time. The common thread is "this is not going the way it was meant to",
which is exactly what an overrun is. It matters that it is *neither* `--running`
nor `--rest`: an overrunning break has stopped being rest and has not become
work, and borrowing either token would make the one state you need to notice
look like one of the two you don't.

**Break time was being logged as work, and the fix changes what old numbers
mean.** `FocusSession.accumulatedSeconds` runs straight through break intervals,
so the raw wall clock counted the coffee — and that figure became
`elapsedSeconds`, which rolls up into `TaskOccurrence.loggedSeconds`, habit
quota, tier and streaks. The schema comment claiming otherwise was simply false.
`endSession` now subtracts the breaks (`loggedElapsedSeconds`), rather than
summing the focus intervals, because a focus interval only gets its
`elapsedSeconds` written when it *closes* and the last one of every session is
open at the moment Stop is pressed.

Nothing rewrites history: rows written before this keep whatever they have. That
leaves two eras of data that disagree, which is recorded here deliberately
rather than left to be rediscovered. Only multi-interval pomodoros were ever
affected — a session with no breaks reduces to exactly the old arithmetic, which
is what the second `verify-logic` check pins down.

**A cue survives the gap; a task title doesn't.** `SessionInterval.returnNote`
is written during the break, while the answer to "what was I doing" is still in
your head, and handed back at the boundary, in the badge, and as the
notification body. It lives on the interval rather than the session because a
later break is a different return to a different place. Prefilled from
`nextStep()` and skippable in one press — a required field here would be one
more reason not to take the break.

**Alerts escalate rather than repeat, and permission is asked for late.** One
notification at the moment a break ends is the worst possible timing: the
failure is not "I never heard it", it's "I heard it and carried on scrolling".
So there is a chime and a haptic at the boundary, then notifications at 2, 5, 10
and 20 minutes, then silence — something that never stops gets muted at the OS
level, which costs every future alert too. Permission is requested when a break
first *starts*, never on page load, because a browser gives you exactly one
prompt and a denial can't be re-asked from the page.

**Water is teal, by reservation.** The running blue is the most load-bearing
token in the app and it is never borrowed — so the water vessel fills with
`--primary` teal, the same colour as anything else going well. The feature
introduces no new hue. Its one structural addition is the pace line: a quiet
dashed mark on the vessel at "how many you should have had by now", labelled
with the clock time that belongs to it — the day's schedule drawn as a level.

**The goal being met is the day's end.** Water reminders follow the break
alerts' posture — permission asked when the feature is first turned on, one
notification per slot, replace-not-stack — but with a different silence rule.
A break overrun escalates until it is resolved; water reminders stop the moment
the goal is met, because a budget that never runs out gets the app muted at the
OS level. The reminders also stay silent while you're on pace: they exist to
catch the day that fell behind the line, not to narrate the one that didn't.
They share the honest limitation of the break alerts too — an Unravel tab has
to be open, and a closed app is out of reach of anything but a service worker
this app deliberately doesn't run.

**A glass is an event, not a number.** `WaterGlass` is one row per glass, with
the minute it was drunk — the count for a day is a groupBy, never a stored
total. That timestamp is what makes "last glass was 3h ago" and the backdate
menu truthful, and a backdated glass keeps its claimed time: the record is
"when did this happen", not "when was the button pressed".

### Loading states

**A loading screen is the page's own skeleton, not a spinner.** Every route
under `(app)` and `(focus)` has a `loading.tsx` built from shadcn `Skeleton`,
mirroring the page's real container classes and its main shapes — the calendar
skeleton is the grid, the water skeleton is the vessel — so the page arrives
already laid out and nothing jumps when it does. The bones pulse; the block
itself rises in with `rise` (320ms) once. Both are killed by the single global
reduced-motion rule. They are deliberately dumb: no logic, no data, no motion
vocabulary of their own.

### The now-tick draws two pixels, so only those re-render

`useNowMinute` used to live in `CalendarView`, which meant every 30-second tick
re-rendered the whole grid — strips, columns, the optimistic layer — for the
sake of a 1px line in today's strip and the running line in the day column. The
tick now lives in a `NowProvider` that holds the grid as a stable child; the two
markers subscribe through context and re-render alone. Behaviour is unchanged —
the running line still appears a frame after first paint, because null on the
first render is what keeps the moving element out of the hydration diff — only
the blast radius of the tick is gone.

### A failed action still revalidates

The calendar's actions are optimistic: the block moves and the tick flips the
instant you let go, and the server answers by revalidating. That revalidation
used to be skipped when an action bailed out early — a malformed payload or a
missing id left the server cache holding the old state, and the block snapped
back on the next visit even though the screen said otherwise. Every exit path
of `moveBlock` and `toggleBlockDone` now revalidates: the cache must agree with
what the user is looking at, whatever the action decided.

### Money is in and out, not red and black

The budget keeps the palette's discipline by giving the ledger only two
semantic colours: income is teal (the colour of things going well), spending is
clay (the colour of "the thing to notice") — which is why clay is never a
category colour. `MoneyTransaction.amountCents` is paise, an integer, so money
never rounds on the way in or out; the decimal form is only a string at the
input boundary, parsed once. The month is the grain: weeks are bars, the
donut shows one side of the ledger at a time (a question, not a dashboard), and
the headline sentence does the arithmetic instead of a stat grid. Categories
are archived, never deleted while they hold entries, and built-ins — owned by
`"global"`, not the user — can't be archived at all; the unique
`(ownerKey, kind, name)` pair is what keeps two people's "Coffee" from
colliding while still letting everyone share one "Food".

**A budget is an envelope, not a filter.** Assigning an expense to a budget
changes nothing about the ledger — the entry stays where it is, its totals
untouched; `MoneyTransaction.budgetId` is a pointer that `onDelete: SetNull`
turns into "no budget" rather than "no transaction". So removing an expense
from a budget is a single update, never a delete, and deleting a budget leaves
every entry on the ledger. An envelope has its own dates (10–20 August), not
the month's — the budget page's grain is the month, but money's grain is
whatever stretch it belongs to. That is why the server checks an assignment
against `[startsOn, endsOn]` instead of trusting the form, why the picker only
offers envelopes covering the entry's date, why changing the date drops a
selection that no longer fits, and why editing a budget's dates unassigns the
expenses that fall outside them in the same transaction as the edit. A running
budget leads the envelopes card with its countdown; everything else is a row.

**The third container.** The budget page's big question is "how much do I have
left?", and the answer is a jar: the month's net balance as a liquid level in a
glass vessel — the rhyme to the water glass and the timer ring, the third
draining container. Income fills it, spending drains it; a full jar is a good
month, an overspent one turns the liquid clay. The jar is the hero, and the
statistics are its readout: one big mono number (the balance), In and Out as
its parts with arrows against last month, and a sentence about the pace. The
running balance chart keeps last month's line as the palette's dormant fifth
wheel — brass — the one comparison the page is allowed, "above the line is a
good month". The motion budget is the app's own: the fill rises once on
arrival, tilts toward the pointer while you point at it, settles when an
expense lands, and never moves on its own. WebGL is a luxury, not a
dependency: if it fails, the same jar is drawn in SVG.

## The brand mark

`components/brand-mark.tsx` — a loop that has come undone: a ring with a 50°
gap at the top (the timer's circle, the day's loop) and a single thread pulled
loose, unspooling once around the outside and hooking back in. One stroke in
`currentColor`, so it wears whatever token its context does — primary teal on
the sidebar rail, foreground on paper. Geometry is deliberate: the arc runs
the long way around (`large-arc 1, sweep 0`), the tail's control points clear
the ring's outside edge, and at the collapsed rail's 24px the mark still holds
~13% ink coverage with strong contrast in both themes. The sidebar shows the
mark alone when collapsed; the wordmark returns with the labels when expanded.
