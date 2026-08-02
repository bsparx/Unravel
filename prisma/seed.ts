/**
 * Development seed.
 *
 * Creates a demo user with projects, todos, habits and ~45 days of back-dated
 * sessions, so /stats and the habit grids have something real to render before
 * you've used the app for a month.
 *
 * Run with `pnpm db:seed`. Pass CLERK_USER_ID=user_xxx to attach the data to
 * your own Clerk account instead of the placeholder demo one.
 */

import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";

import { ensureGlobalCategories } from "@/lib/budget";
import { tierFor, type Quota } from "@/lib/quota";
import { PrismaClient } from "../lib/generated/prisma/client";
import type { TimerMode } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const CLERK_ID = process.env.CLERK_USER_ID ?? "user_seed_demo";
const TIMEZONE = process.env.SEED_TIMEZONE ?? "UTC";
const DAYS_OF_HISTORY = 45;

const MS_PER_DAY = 86_400_000;

function localDate(offsetDays: number): Date {
  const now = new Date();
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + offsetDays * MS_PER_DAY);
}

/** Deterministic pseudo-random, so re-seeding produces the same story. */
let seed = 42;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

async function main() {
  console.log(`Seeding for clerkId=${CLERK_ID} in ${TIMEZONE}…`);

  const user = await prisma.user.upsert({
    where: { clerkId: CLERK_ID },
    create: {
      clerkId: CLERK_ID,
      name: "Demo",
      email: "demo@example.com",
      timezone: TIMEZONE,
    },
    update: { timezone: TIMEZONE },
  });

  // Start from a clean slate so re-running doesn't pile up duplicates.
  await prisma.timeBlock.deleteMany({ where: { userId: user.id } });
  await prisma.focusSession.deleteMany({ where: { userId: user.id } });
  await prisma.taskOccurrence.deleteMany({ where: { userId: user.id } });
  await prisma.task.deleteMany({ where: { userId: user.id } });
  await prisma.project.deleteMany({ where: { userId: user.id } });
  await prisma.moneyBudget.deleteMany({ where: { userId: user.id } });
  await prisma.moneyTransaction.deleteMany({ where: { userId: user.id } });
  await prisma.moneyCategory.deleteMany({ where: { ownerKey: user.id } });

  const [deepWork, admin, home] = await Promise.all([
    prisma.project.create({
      data: { userId: user.id, name: "Deep work", color: "teal", sortOrder: 1 },
    }),
    prisma.project.create({
      data: { userId: user.id, name: "Admin", color: "sand", sortOrder: 2 },
    }),
    prisma.project.create({
      data: { userId: user.id, name: "Home", color: "sage", sortOrder: 3 },
    }),
  ]);

  const todos = await Promise.all(
    [
      {
        title: "Write the project proposal",
        projectId: deepWork.id,
        priority: "P1" as const,
        estimatedSeconds: 90 * 60,
        plannedIntervals: 4,
        dueDate: localDate(0),
        // The demo data has to demonstrate the point of steps, not just their
        // existence: step one is deliberately something you could not talk
        // yourself out of.
        steps: [
          { title: "Open last quarter's proposal and skim the headings", minutes: 2 },
          { title: "Write the one-sentence version of what we're asking for", minutes: 10 },
          { title: "Draft the background section badly", minutes: 30 },
          { title: "Put real numbers in the budget table", minutes: 25 },
          { title: "Read it back once and send it", minutes: 20 },
        ],
      },
      {
        title: "Review the pull request backlog",
        projectId: deepWork.id,
        priority: "P2" as const,
        estimatedSeconds: 45 * 60,
        plannedIntervals: 2,
        dueDate: localDate(0),
      },
      {
        title: "Email the landlord about the boiler",
        projectId: admin.id,
        priority: "P1" as const,
        estimatedSeconds: 10 * 60,
        defaultMode: "BASIC" as TimerMode,
        dueDate: localDate(-2),
      },
      {
        title: "Renew the car insurance",
        projectId: admin.id,
        priority: "P2" as const,
        estimatedSeconds: 20 * 60,
        defaultMode: "BASIC" as TimerMode,
        dueDate: localDate(-1),
      },
      {
        title: "Sort out the spare room",
        projectId: home.id,
        priority: "P3" as const,
        estimatedSeconds: 60 * 60,
        defaultMode: "FLOW" as TimerMode,
        steps: [
          { title: "Carry the empty boxes upstairs", minutes: 2 },
          { title: "Clear the desk surface", minutes: 15 },
          { title: "One bag for charity, one for the bin", minutes: 30 },
        ],
      },
      {
        title: "Book the dentist",
        projectId: admin.id,
        priority: "P3" as const,
        estimatedSeconds: 5 * 60,
        defaultMode: "BASIC" as TimerMode,
        dueDate: localDate(1),
      },
    ].map(({ steps, ...task }, index) =>
      prisma.task.create({
        data: {
          userId: user.id,
          type: "TODO",
          sortOrder: index,
          defaultMode: "POMODORO",
          ...task,
          steps: {
            create: (steps ?? []).map((step, position) => ({
              userId: user.id,
              title: step.title,
              position,
              estimatedSeconds: step.minutes * 60,
            })),
          },
        },
      }),
    ),
  );

  // A planned day, so the calendar isn't empty on first open — including a
  // buffer block and a recovery block, because a demo day that is wall-to-wall
  // work would teach exactly the wrong lesson.
  await prisma.timeBlock.createMany({
    data: [
      {
        userId: user.id,
        taskId: todos[0].id,
        title: todos[0].title,
        date: localDate(0),
        startMinute: 9 * 60,
        endMinute: 10 * 60 + 30,
        kind: "WORK" as const,
      },
      {
        userId: user.id,
        title: "Buffer",
        date: localDate(0),
        startMinute: 10 * 60 + 30,
        endMinute: 11 * 60,
        kind: "BUFFER" as const,
      },
      {
        userId: user.id,
        taskId: todos[1].id,
        title: todos[1].title,
        date: localDate(0),
        startMinute: 11 * 60,
        endMinute: 11 * 60 + 45,
        kind: "WORK" as const,
      },
      {
        userId: user.id,
        title: "Read something that isn't a screen",
        date: localDate(0),
        startMinute: 14 * 60,
        endMinute: 14 * 60 + 30,
        kind: "RECOVERY" as const,
      },
      {
        userId: user.id,
        taskId: todos[4].id,
        title: todos[4].title,
        date: localDate(1),
        startMinute: 10 * 60,
        endMinute: 11 * 60,
        kind: "WORK" as const,
      },
    ],
  });

  const habits = await Promise.all(
    [
      {
        title: "Morning pages",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        estimatedSeconds: 15 * 60,
        defaultMode: "BASIC" as TimerMode,
        reliability: 0.82,
        // Two minutes to count, fifteen on a good day. The gap between the two
        // is the point: it is what makes the streak survivable.
        unit: "MINUTES" as const,
        minimumQuota: 2,
        optimalQuota: 15,
      },
      {
        title: "Read something long",
        daysOfWeek: [1, 3, 5],
        estimatedSeconds: 30 * 60,
        defaultMode: "FLOW" as TimerMode,
        reliability: 0.65,
        unit: "COUNT" as const,
        minimumQuota: 1,
        optimalQuota: 10,
      },
      {
        title: "Inbox to zero",
        daysOfWeek: [1, 2, 3, 4, 5],
        estimatedSeconds: 20 * 60,
        defaultMode: "POMODORO" as TimerMode,
        reliability: 0.74,
        unit: "MINUTES" as const,
        minimumQuota: 5,
        optimalQuota: 20,
      },
      {
        title: "Stretch",
        daysOfWeek: [0, 2, 4, 6],
        estimatedSeconds: 10 * 60,
        defaultMode: "BASIC" as TimerMode,
        reliability: 0.5,
        // No stretch goal at all — one of the four, so the "no optimal" path
        // is exercised by the seed rather than only by tests.
        unit: "COUNT" as const,
        minimumQuota: 1,
        optimalQuota: null,
      },
    ].map(async (habit, index) => {
      const task = await prisma.task.create({
        data: {
          userId: user.id,
          type: "HABIT",
          title: habit.title,
          priority: "P3",
          sortOrder: index,
          estimatedSeconds: habit.estimatedSeconds,
          defaultMode: habit.defaultMode,
          recurrence: {
            create: {
              kind: habit.daysOfWeek.length === 7 ? "DAILY" : "SPECIFIC_DAYS",
              daysOfWeek: habit.daysOfWeek,
              startDate: localDate(-DAYS_OF_HISTORY),
              unit: habit.unit,
              minimumQuota: habit.minimumQuota,
              optimalQuota: habit.optimalQuota,
            },
          },
        },
      });
      return { task, ...habit };
    }),
  );

  // ---- back-dated history ------------------------------------------------

  let sessionCount = 0;

  for (let offset = -DAYS_OF_HISTORY; offset <= 0; offset += 1) {
    const date = localDate(offset);
    const weekday = date.getUTCDay();

    for (const habit of habits) {
      if (!habit.daysOfWeek.includes(weekday)) continue;
      // Today is left undone, so the app opens with something to do.
      if (offset === 0) continue;

      const roll = random();
      if (roll > habit.reliability) {
        if (roll > 0.94) {
          await prisma.taskOccurrence.create({
            data: {
              userId: user.id,
              taskId: habit.task.id,
              date,
              status: "SKIPPED",
            },
          });
        }
        continue;
      }

      const target = habit.estimatedSeconds;
      // Real sessions rarely land exactly on the estimate.
      const elapsed = Math.round(target * (0.75 + random() * 0.75));

      // A realistic spread of days: most clear the minimum, a good few go all
      // the way. Derived through `tierFor` rather than assigned, so the seed
      // can't invent a combination the app itself would never produce.
      const quota: Quota = {
        unit: habit.unit,
        minimum: habit.minimumQuota,
        optimal: habit.optimalQuota,
      };
      const ceiling = habit.optimalQuota ?? habit.minimumQuota;
      const progress =
        habit.unit === "MINUTES"
          ? Math.max(habit.minimumQuota, Math.round(elapsed / 60))
          : random() < 0.45
            ? ceiling + Math.floor(random() * 3)
            : habit.minimumQuota + Math.floor(random() * Math.max(1, ceiling - habit.minimumQuota));

      const occurrence = await prisma.taskOccurrence.create({
        data: {
          userId: user.id,
          taskId: habit.task.id,
          date,
          status: "DONE",
          completedAt: new Date(date.getTime() + 9 * 3600_000),
          loggedSeconds: elapsed,
          progress,
          tier: tierFor(progress, quota),
        },
      });

      await createSession({
        userId: user.id,
        taskId: habit.task.id,
        occurrenceId: occurrence.id,
        localDate: date,
        mode: habit.defaultMode,
        targetSeconds: target,
        elapsedSeconds: elapsed,
        hour: 7 + Math.floor(random() * 3),
      });
      sessionCount += 1;
    }

    // A few deep-work sessions on weekdays.
    if (weekday >= 1 && weekday <= 5 && offset < 0 && random() > 0.45) {
      const task = todos[Math.floor(random() * 2)];
      const target = task.estimatedSeconds ?? 1500;
      const elapsed = Math.round(target * (0.6 + random() * 0.9));

      const occurrence = await prisma.taskOccurrence.upsert({
        where: { taskId_date: { taskId: task.id, date } },
        create: {
          userId: user.id,
          taskId: task.id,
          date,
          status: "PENDING",
          loggedSeconds: elapsed,
        },
        update: { loggedSeconds: { increment: elapsed } },
      });

      await createSession({
        userId: user.id,
        taskId: task.id,
        occurrenceId: occurrence.id,
        localDate: date,
        mode: task.defaultMode,
        targetSeconds: target,
        elapsedSeconds: elapsed,
        hour: 10 + Math.floor(random() * 6),
      });
      sessionCount += 1;
    }
  }

  // ---- back-dated money, so the budget opens with a real ledger -----------

  await ensureGlobalCategories();

  const salary = await prisma.moneyCategory.findFirstOrThrow({
    where: { ownerKey: "global", name: "Salary" },
  });

  await Promise.all([
    prisma.moneyCategory.create({
      data: {
        ownerKey: user.id,
        userId: user.id,
        kind: "EXPENSE",
        name: "Coffee",
        color: "sand",
        sortOrder: 1,
      },
    }),
    prisma.moneyCategory.create({
      data: {
        ownerKey: user.id,
        userId: user.id,
        kind: "INCOME",
        name: "Bonus",
        color: "ink",
        sortOrder: 1,
      },
    }),
  ]);
  const bonus = await prisma.moneyCategory.findFirstOrThrow({
    where: { ownerKey: user.id, name: "Bonus" },
  });

  // Amounts are rupees in the source and paise in the ledger.
  const EXPENSE_POOL: { name: string; chance: number; min: number; max: number }[] = [
    { name: "Food", chance: 0.9, min: 300, max: 900 },
    { name: "Groceries", chance: 0.35, min: 1200, max: 5000 },
    { name: "Transport", chance: 0.6, min: 150, max: 700 },
    { name: "Utilities", chance: 0.08, min: 8000, max: 15000 },
    { name: "Medical", chance: 0.05, min: 1500, max: 9000 },
    { name: "Shopping", chance: 0.18, min: 1200, max: 12000 },
    { name: "Entertainment", chance: 0.25, min: 400, max: 3000 },
    { name: "Subscriptions", chance: 0.14, min: 500, max: 4000 },
    { name: "Coffee", chance: 0.45, min: 150, max: 500 },
  ];

  const expenseCategories = await prisma.moneyCategory.findMany({
    where: { kind: "EXPENSE" },
  });

  let transactionCount = 0;

  // Today is left empty, so the app opens with something to do.
  for (let offset = -75; offset < 0; offset += 1) {
    const date = localDate(offset);

    // Payday, the first of every month — salary plus a plausible rent, and
    // sometimes a bonus on top.
    if (date.getUTCDate() === 1) {
      await prisma.moneyTransaction.create({
        data: {
          userId: user.id,
          categoryId: salary.id,
          amountCents: 200_000_00,
          date,
        },
      });
      transactionCount += 1;

      if (random() > 0.6) {
        await prisma.moneyTransaction.create({
          data: {
            userId: user.id,
            categoryId: bonus.id,
            amountCents: Math.round(15000 * (1 + random())) * 100,
            date,
          },
        });
        transactionCount += 1;
      }
    }

    // Two to six expenses a day, drawn with category-appropriate frequency.
    const expenseCount = 2 + Math.floor(random() * 5);
    for (let i = 0; i < expenseCount; i += 1) {
      const pick = EXPENSE_POOL[Math.floor(random() * EXPENSE_POOL.length)];
      if (random() > pick.chance) continue;

      const amountCents = Math.round(pick.min + random() * (pick.max - pick.min)) * 100;
      const category =
        expenseCategories.find((entry) => entry.name === pick.name) ??
        expenseCategories[0];

      await prisma.moneyTransaction.create({
        data: { userId: user.id, categoryId: category.id, amountCents, date },
      });
      transactionCount += 1;
    }
  }

  // Two envelopes: one running right now, one that has already run — the
  // budget page's hero and its "ended" rows. A share of the expenses that
  // fall inside each window count against it, so the drill-in has something
  // to show.
  const budgets = await Promise.all([
    createBudget(user.id, "This week", 25_000_00, -2, 4),
    createBudget(user.id, "Shopping weekend", 18_000_00, -11, -7),
  ]);
  for (const budget of budgets) {
    const inRange = await prisma.moneyTransaction.findMany({
      where: {
        userId: user.id,
        date: { gte: budget.startsOn, lt: new Date(budget.endsOn.getTime() + MS_PER_DAY) },
        category: { kind: "EXPENSE" },
      },
      select: { id: true },
    });
    await Promise.all(
      inRange
        .filter(() => random() < 0.3)
        .map((transaction) =>
          prisma.moneyTransaction.update({
            where: { id: transaction.id },
            data: { budgetId: budget.id },
          }),
        ),
    );
  }

  console.log(
    `Done: ${todos.length} tasks, ${habits.length} habits, ${sessionCount} sessions, ${transactionCount} money entries.`,
  );
}

async function createBudget(
  userId: string,
  name: string,
  amountCents: number,
  startOffset: number,
  endOffset: number,
) {
  return prisma.moneyBudget.create({
    data: {
      userId,
      name,
      amountCents,
      startsOn: localDate(startOffset),
      endsOn: localDate(endOffset),
    },
  });
}

async function createSession(input: {
  userId: string;
  taskId: string;
  occurrenceId: string;
  localDate: Date;
  mode: TimerMode;
  targetSeconds: number;
  elapsedSeconds: number;
  hour: number;
}) {
  const startedAt = new Date(input.localDate.getTime() + input.hour * 3600_000);
  const endedAt = new Date(startedAt.getTime() + input.elapsedSeconds * 1000);
  const overtime = Math.max(0, input.elapsedSeconds - input.targetSeconds);

  await prisma.focusSession.create({
    data: {
      userId: input.userId,
      taskId: input.taskId,
      occurrenceId: input.occurrenceId,
      clientKey: `seed_${input.taskId}_${input.localDate.toISOString().slice(0, 10)}`,
      mode: input.mode,
      targetSeconds: input.targetSeconds,
      plannedIntervals: input.mode === "POMODORO" ? 2 : 1,
      focusSeconds: 1500,
      shortBreakSeconds: 300,
      longBreakSeconds: 900,
      status: "COMPLETED",
      startedAt,
      endedAt,
      runningSince: null,
      lastBeatAt: endedAt,
      accumulatedSeconds: input.elapsedSeconds,
      elapsedSeconds: input.elapsedSeconds,
      overtimeSeconds: overtime,
      reachedTargetAt: overtime > 0 ? endedAt : null,
      pausedCount: Math.floor(random() * 3),
      endReason: overtime > 0 ? "USER_STOPPED" : "TARGET_REACHED",
      localDate: input.localDate,
      intervals: {
        create: {
          index: 0,
          kind: "FOCUS",
          targetSeconds: input.targetSeconds,
          startedAt,
          endedAt,
          accumulatedSeconds: input.elapsedSeconds,
          elapsedSeconds: input.elapsedSeconds,
          overtimeSeconds: overtime,
          completed: input.elapsedSeconds >= input.targetSeconds,
        },
      },
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
