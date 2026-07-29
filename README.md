# Toasty Clock

A productivity app for people with ADHD. One place to put everything in your
head, one thing to do next, a timer that treats rest as the other half of the
day, and a ritual that ends it properly.

- **The dump box** — `c` or ⌘K from anywhere. One field, no parsing, no
  decisions. Everything lands in `/inbox`, and you sort it out later.
- **Today is one thing** — `/` shows a single next action, chosen in a quick
  morning pass. Not a list, not a plan. Everything else is one tap away.
- **Todos** — one-off things, with a deadline, a time estimate in minutes, and
  an optional list of steps. Create, edit and delete all live on `/tasks`.
- **Steps, and the first one especially** — break a task into an ordered
  checklist. Step one is treated as a different kind of thing: it gets its own
  framing in the editor, a two-minute default, and it's what every list, the
  one-thing screen and the timer show you *instead of* the task title. A task
  title is a scope; a step is a handle, and the handle is what gets clicked.
- **Calendar and time blocking** — `/calendar`, week or day. Click an empty
  half hour to claim it, drag a block to move it, drag its edge to resize.
  "Fit it in" takes a task's own estimate, finds the first gap it fits, and
  puts it there — and says there's no room rather than double-booking you.
- **Habits, with two bars** — recurring, on whichever days you pick. Each one
  has a **minimum quota** (one page, two minutes) and optionally an **optimal**.
  Only the minimum keeps the streak; the optimal is tracked and celebrated but
  never required. A day that reaches the optimal counts once, as optimal. Quotas
  are counted in minutes (filled automatically by the timer) or as a plain
  count you tap in. Missing a Tuesday doesn't break a Mon/Wed/Fri habit.
- **Habit statistics** — `/habits/stats`. Streaks, adherence, what you missed,
  the minimum/optimal split per day, and time spent per habit and in total.
  Filter by range and by habit; the filters live in the URL, so a view is a
  link.
- **Work and recovery** — one timer, two peers. Work takes one of three shapes
  (pomodoro, a plain countdown, or a flow timer that runs past your goal).
  Recovery has no target, no countdown and no progress ring at all: it counts
  up and stops when you say so. Both log to the same table and get the same
  billing on `/stats`, because rest isn't the reward for focus.
- **The close** — one button at night: tomorrow's one thing, a worry dump, a
  gratitude line, and then the recovery timer starts. Each step saves as you
  advance, so bailing halfway keeps what you entered.
- **The handoff** — click any task and you land on a timer already set up with
  its estimate, split into sessions. It never starts on its own.
- **Everything logged** — every session, its real elapsed time, overtime,
  pauses and completions, so `/stats` can answer "where did the time go" and
  "how wrong are my estimates".

## Setup

Requires Node 20.9+ and pnpm.

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`:

- **`DATABASE_URL`** — the **pooled** connection string from your
  [Neon](https://neon.tech) dashboard (the host containing `-pooler`).
- **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** / **`CLERK_SECRET_KEY`** — from
  [dashboard.clerk.com](https://dashboard.clerk.com) → your app → API keys.

Then create the schema and start:

```bash
pnpm db:migrate        # prisma migrate dev — creates the tables
pnpm db:seed           # optional: demo data + 45 days of history
pnpm dev
```

To attach the seed data to your own Clerk account rather than a placeholder
user, sign in once, copy your Clerk user id, and run:

```bash
CLERK_USER_ID=user_xxx SEED_TIMEZONE=Asia/Karachi pnpm db:seed
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Generates the Prisma client, then builds |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm verify` | Checks over the correctness-critical pure logic (timezones, recurrence, streaks, timer math) |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Prisma Studio |

## How it's put together

Next.js 16 App Router, Tailwind v4, shadcn/ui, Prisma 7 against Neon Postgres,
Clerk for auth. A few things differ from what you may expect:

- **`proxy.ts`, not `middleware.ts`** — Next 16 renamed it. It runs
  `clerkMiddleware()` only; there is deliberately no `createRouteMatcher` /
  `auth.protect()` (deprecated in Clerk 7, because path matching can diverge
  from how Next actually routes). Every page and Server Action guards itself
  with `requireUser()` instead.
- **Prisma 7** — the generator is `prisma-client` with a mandatory `output`, so
  the client is imported from `@/lib/generated/prisma/client`, not
  `@prisma/client`. The connection string lives in `prisma.config.ts`, not in
  `schema.prisma`, and Neon needs the `PrismaNeon` driver adapter.
- **Tailwind v4** — no `tailwind.config.ts`. Design tokens are declared in
  `app/globals.css` under `@theme inline`. See `design-notes.md`.
- **`params` and `searchParams` are Promises** and must be awaited.

### Five ideas worth knowing before you change anything

**Occurrence rows are sparse.** Whether a habit is due on a given day is
*computed* from its recurrence rule, never stored. A `TaskOccurrence` row is
written only when you actually do something — complete, skip, or start a timer.
Absence of a row means "not done". Nothing is ever pre-generated for future
days, so the table grows with activity rather than with the passage of time.

**Recovery has a target of zero, and that is load-bearing.** It makes
`arcProgress`, `overtimeProgress` and the tick marks all return empty without
any of them needing to know what recovery is. Anything that *counts down*,
though, guards on the mode rather than on the number — see the guards in
`timer-provider.tsx` and `timer/actions.ts`. Without them a rest session ends
the instant it starts and logs its whole duration as overtime.

**A habit's tier is derived, never accumulated.** `tierFor(progress, quota)` is
a function of the day's *total*, so "did the minimum, then carried on to the
optimal" is one OPTIMAL day with no special case anywhere — there is no
representable state in which a day counts twice. Don't reintroduce an event log
for it. The tier is then stored on the occurrence rather than recomputed at read
time, because quotas change: raising your minimum from one page to ten must not
retroactively delete a streak you actually earned.

**A plan and a log are different objects.** A `TimeBlock` is what you intended
to do; a `FocusSession` is what you actually did. They are deliberately never
merged — the gap between them is the most useful thing the app can tell you,
and it disappears the moment planning starts writing to the log. Blocks store
`(local date, startMinute, endMinute)` rather than two timestamps, which makes
every overlap, gap and "does this fit" question integer arithmetic with no
timezone in it. That's why `lib/block-math.ts` is testable without a clock.

**The timer never counts ticks.** Elapsed time is always derived from
wall-clock deltas (`accumulated + (now - runningSince)`). A background tab
throttled to 1Hz, or a laptop asleep for an hour, cannot drift the number. The
server recomputes duration from its own `runningSince` on every write, so a
client with a skewed clock can't inflate anything on `/stats`.
# Unravel
