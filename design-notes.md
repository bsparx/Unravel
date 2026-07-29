# Design notes

Log of the design decisions per surface, so new pages don't unconsciously
re-derive (or drift from) the ones already made.

## The brief

**Toasty Clock** — a productivity app for people with ADHD. The audience is
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
| **Amber (running)** | `#c97b27` | `#e0a050` | **Reserved.** Means "work is on the clock" and nothing else. |
| **Slate blue (rest)** | `#5a7f8c` | `#7fa6b3` | **Reserved.** Recovery, and only recovery. |
| Clay (destructive) | `#b85c4a` | `#d4796a` | Overdue and delete. A warm relative of the palette, not `red-500`. |
| Warm grey (muted) | `#8a8378` | `#9d9488` | Secondary text. |

Calendar blocks are coloured by **kind, never by state**: work is a wash of
teal, recovery a wash of slate blue, buffer a dashed grey. The now-line is the
only amber on that screen. A planned block borrowing amber would make an entire
untouched day look like it was already in progress — the reservation holds on
the calendar exactly as it holds everywhere else.

The amber reservation is the single most load-bearing rule here. If amber
appears on a button, a badge, or a chart series that isn't about a live work
timer, the signal is diluted and the design has failed.

Recovery got its **own** colour rather than a tint of amber, deliberately. Rest
is a peer of work, not a variation on it, and a paler amber would have said the
opposite. The two are also temperature-opposed — warm for work, cool for rest —
so which kind of time is running is legible from across the room, including in
the mini badge where the label is too small to read.

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

**The depleting arc, and its deliberate absence.**

For work: an SVG ring that drains as time passes, modelled on a physical Time
Timer — the standard tool for making duration legible when your internal clock
doesn't cooperate. Tick marks around the ring mark pomodoro segment boundaries,
so you can *see* how the block is split before you start. In flow mode, once
the target is passed the arc inverts into a growing amber overtime ring and the
digits count up instead of down.

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

## Per-surface log

| Surface | Archetype | Notes |
| --- | --- | --- |
| `/` (signed out) | Centred single column | The landing. Renders inside the same nav-less `(focus)` layout as the one-thing screen. |
| `/` (signed in) | One card, one button | **The home screen.** A single next action and nothing else — no list, no counts, no badges. Everything else is behind three quiet underlined links at the bottom. |
| `/day` | Single focused column, grouped list | The full picture, one tap away: habits due, overdue, due today, anytime. |
| `/inbox` | Flat list, row actions | Triage. Deliberate, unlike capture — which is why it's a page and the dump box isn't. |
| `/tasks` | Grouped list by project | Filters as quiet segmented control, not tabs-as-chrome. Edit and start-timer are hover-revealed row actions; the row body itself is always the timer. |
| `/tasks/[id]` | Single column form + log | Create and edit are the same form. Delete is behind one dialog — it takes the session history with it. |
| `/calendar` | Two columns: grid + scheduling panel | Week by default, day on request. Blocks are dragged and resized directly; the panel is the only place anything is "assigned" a time by pressing a button. |
| `/habits` | List + 8-week adherence grid | Grid is a heatmap row per habit; teal ramp, never amber. Two weights of teal for done — full for optimal, half for minimum — because collapsing them throws away the whole point of two quotas. Today's quota meter sits above the grid: history below, the one actionable thing above. |
| `/habits/stats` | Filters, then charts, then a per-habit table | shadcn/recharts. Optimal is the full primary and minimum is the same hue at half strength — a good day is *more of the same thing*, not a different metric. Missed is clay; skipped is neutral grey, because a deliberate "not today" is not a failure. |
| `/timer` | Full-bleed, centred, minimal chrome | Elevation budget spent here. The face is the page. |
| `/close` | One input per screen, vertically centred | Ritual, not a form. No progress bar, no "step 2 of 4", no back/next chrome — just the question and one quiet way out. |
| `/stats` | Dense, chart-first | Work and recovery get identical panel width, bar height and type scale. Amber only where the series genuinely is work on the clock. |
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

**The dump box is never a route.** It's mounted once in a shared layout and
opens over whatever you're looking at. The moment capture requires a navigation
you've added a decision point, and the thought is already gone.
