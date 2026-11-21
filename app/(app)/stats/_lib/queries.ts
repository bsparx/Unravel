import "server-only";

import { prisma } from "@/lib/db";
import {
  addDays,
  dayOfWeek,
  formatDuration,
  toISODate,
  todayLocal,
} from "@/lib/dates";
import type { User } from "@/lib/generated/prisma/client";
import { heartEnabled } from "@/lib/heart-data";
import { enabledHeartTabs } from "@/lib/heart-tabs";
import { mindEnabled } from "@/lib/mind-data";
import { MIND_TABS } from "@/lib/mind-tabs";
import { pagesRead } from "@/lib/reading";
import { describeRecurrence, isDueOn } from "@/lib/recurrence";
import {
  HEART_PRACTICE_LABELS,
  MIND_PRACTICE_LABELS,
  WINDOW_DAYS,
  heartItemId,
  mindItemId,
  resolveStatsWindow,
  type DayItemEntry,
  type DaySessionEntry,
  type StatsDayRecord,
  type StatsOverview,
  type TrackableItem,
} from "@/lib/stats-summary";
import type { TimerMode } from "@/lib/timer-math";

/**
 * Everything /stats needs for one 2-week (14-day) window, in one round trip:
 *  - Every active (non-archived) habit and its recurrence rule
 *  - Every Settings-enabled Mind and Heart practice
 *  - Every day's completion status (strictly honouring each habit's active days)
 *  - Every day's productive time (timer work sessions + manual task/habit logs,
 *    with breaks and recovery cleanly excluded and zero double-counting)
 *  - Per-day session breakdown for the Day Details sheet
 */
export async function getStatsOverview(
  user: User,
  endParam?: string | null,
): Promise<StatsOverview> {
  const today = todayLocal(user.timezone);
  const win = resolveStatsWindow(today, endParam);
  const { from, to } = win;
  const todayISO = toISODate(today);
  const yesterdayISO = toISODate(addDays(today, -1));

  // 1-day cushion on both ends when querying UTC timestamps so timezone offsets
  // near midnight never drop an entry belonging to `from` or `to`.
  const instantFrom = addDays(from, -1);
  const instantTo = addDays(to, 2);

  const mind = mindEnabled(user);
  const heart = heartEnabled(user);
  const enabledMind = MIND_TABS.filter((tab) => mind[tab]);
  const enabledHeart = enabledHeartTabs(heart);

  const journalKinds: ("GRATITUDE" | "DUA")[] = [];
  if (heart.gratitude) journalKinds.push("GRATITUDE");
  if (heart.dua) journalKinds.push("DUA");

  const [
    habits,
    occurrences,
    sessions,
    brainDumps,
    meditations,
    readings,
    wishRehearsals,
    disputations,
    disputationRevisits,
    journalEntries,
    recitationLogs,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, type: "HABIT", archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        recurrence: {
          select: {
            daysOfWeek: true,
            startDate: true,
            endDate: true,
            minimalTask: true,
            unit: true,
          },
        },
      },
    }),

    prisma.taskOccurrence.findMany({
      where: {
        userId: user.id,
        date: { gte: from, lte: to },
      },
      select: {
        taskId: true,
        date: true,
        status: true,
        minimalTaskDone: true,
        progress: true,
        loggedSeconds: true,
        completedAt: true,
        createdAt: true,
        task: { select: { id: true, title: true, type: true } },
      },
    }),

    prisma.focusSession.findMany({
      where: {
        userId: user.id,
        status: "COMPLETED",
        localDate: { gte: from, lte: to },
      },
      orderBy: { startedAt: "asc" },
      select: {
        id: true,
        mode: true,
        localDate: true,
        startedAt: true,
        elapsedSeconds: true,
        overtimeSeconds: true,
        occurrenceId: true,
        taskId: true,
        task: { select: { id: true, title: true } },
      },
    }),

    mind.braindump
      ? prisma.brainDump.findMany({
          where: { userId: user.id, date: { gte: from, lte: to } },
          select: { date: true, paper: true, seconds: true, createdAt: true },
        })
      : Promise.resolve([]),

    mind.meditate
      ? prisma.meditationSession.findMany({
          where: {
            userId: user.id,
            seconds: { gt: 0 },
            startedAt: { gte: instantFrom, lt: instantTo },
          },
          select: { startedAt: true, seconds: true },
        })
      : Promise.resolve([]),

    mind.reading
      ? prisma.readingLog.findMany({
          where: { userId: user.id, date: { gte: from, lte: to } },
          select: {
            date: true,
            fromPage: true,
            toPage: true,
            createdAt: true,
            book: { select: { title: true, unit: true } },
          },
        })
      : Promise.resolve([]),

    mind.wishes
      ? prisma.wishRehearsal.findMany({
          where: { userId: user.id, date: { gte: from, lte: to } },
          select: { date: true, createdAt: true },
        })
      : Promise.resolve([]),

    mind.disputations
      ? prisma.disputation.findMany({
          where: {
            userId: user.id,
            createdAt: { gte: instantFrom, lt: instantTo },
          },
          select: { createdAt: true },
        })
      : Promise.resolve([]),

    mind.disputations
      ? prisma.disputationRevisit.findMany({
          where: { userId: user.id, date: { gte: from, lte: to } },
          select: { date: true, createdAt: true },
        })
      : Promise.resolve([]),

    journalKinds.length > 0
      ? prisma.journalEntry.findMany({
          where: {
            userId: user.id,
            kind: { in: journalKinds },
            date: { gte: from, lte: to },
          },
          select: { date: true, kind: true, createdAt: true },
        })
      : Promise.resolve([]),

    heart.recitation
      ? prisma.recitationLog.findMany({
          where: { userId: user.id, date: { gte: from, lte: to } },
          select: { date: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  // ---- formatters ----------------------------------------------------------

  const localISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: user.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: user.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const shortDateFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  const fullDateFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  const monthShortFmt = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  });

  const dayMonthFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  const sameYear =
    from.getUTCFullYear() === today.getUTCFullYear() &&
    to.getUTCFullYear() === today.getUTCFullYear();
  const windowLabel = sameYear
    ? `${dayMonthFmt.format(from)} – ${dayMonthFmt.format(to)}`
    : `${dayMonthFmt.format(from)} ${from.getUTCFullYear()} – ${dayMonthFmt.format(to)} ${to.getUTCFullYear()}`;

  // ---- catalog of trackable items -----------------------------------------

  const activeHabits = habits.filter((h) => h.recurrence !== null);

  const items: TrackableItem[] = [
    ...activeHabits.map((h) => ({
      id: h.id,
      group: "habit" as const,
      title: h.title,
      scheduleLabel: describeRecurrence(h.recurrence!.daysOfWeek),
      minimalTask: h.recurrence!.minimalTask || null,
    })),
    ...enabledMind.map((tab) => ({
      id: mindItemId(tab),
      group: "mind" as const,
      title: MIND_PRACTICE_LABELS[tab],
      scheduleLabel: "Mind",
    })),
    ...enabledHeart.map((tab) => ({
      id: heartItemId(tab),
      group: "heart" as const,
      title: HEART_PRACTICE_LABELS[tab],
      scheduleLabel: "Heart",
    })),
  ];

  /** Keep the earliest timestamp recorded on the same local calendar day. */
  const pickEarliest = (
    current: Date | null,
    candidate: Date | null,
    iso: string,
  ): Date | null => {
    if (!candidate) return current;
    if (localISO.format(candidate) !== iso) return current;
    if (!current || candidate.getTime() < current.getTime()) return candidate;
    return current;
  };

  const timeFields = (
    at: Date | null,
  ): { completedAtMs: number | null; completedTime: string | null } =>
    at
      ? { completedAtMs: at.getTime(), completedTime: localTime.format(at) }
      : { completedAtMs: null, completedTime: null };

  // ---- index habit occurrences by (taskId, iso) ---------------------------

  const habitOccByKey = new Map<
    string,
    {
      status: string;
      progress: number;
      loggedSeconds: number;
      completedAt: Date | null;
    }
  >();
  for (const occ of occurrences) {
    if (occ.task.type === "HABIT") {
      const iso = toISODate(occ.date);
      const stamp = occ.status === "DONE" ? (occ.completedAt ?? occ.createdAt) : null;
      habitOccByKey.set(`${occ.taskId}:${iso}`, {
        status: occ.status,
        progress: occ.progress,
        loggedSeconds: occ.loggedSeconds,
        completedAt: pickEarliest(null, stamp, iso),
      });
    }
  }

  // ---- index Mind & Heart completions by day ------------------------------

  const brainDumpByDay = new Map<
    string,
    { count: number; paper: number; seconds: number; firstAt: Date | null }
  >();
  for (const row of brainDumps) {
    const iso = toISODate(row.date);
    const cur = brainDumpByDay.get(iso) ?? {
      count: 0,
      paper: 0,
      seconds: 0,
      firstAt: null,
    };
    cur.count += 1;
    cur.paper += row.paper ? 1 : 0;
    cur.seconds += row.seconds;
    cur.firstAt = pickEarliest(cur.firstAt, row.createdAt, iso);
    brainDumpByDay.set(iso, cur);
  }

  const meditationByDay = new Map<
    string,
    { seconds: number; firstAt: Date | null }
  >();
  for (const row of meditations) {
    const iso = localISO.format(row.startedAt);
    const cur = meditationByDay.get(iso) ?? { seconds: 0, firstAt: null };
    cur.seconds += row.seconds;
    cur.firstAt = pickEarliest(cur.firstAt, row.startedAt, iso);
    meditationByDay.set(iso, cur);
  }

  const readingByDay = new Map<
    string,
    {
      pages: number;
      percent: number;
      logs: number;
      bookTitle: string | null;
      firstAt: Date | null;
    }
  >();
  for (const row of readings) {
    const iso = toISODate(row.date);
    const cur = readingByDay.get(iso) ?? {
      pages: 0,
      percent: 0,
      logs: 0,
      bookTitle: null,
      firstAt: null,
    };
    cur.logs += 1;
    if (row.book.unit === "PERCENT") cur.percent += pagesRead(row);
    else cur.pages += pagesRead(row);
    cur.bookTitle ??= row.book.title;
    cur.firstAt = pickEarliest(cur.firstAt, row.createdAt, iso);
    readingByDay.set(iso, cur);
  }

  const wishByDay = new Map<string, { count: number; firstAt: Date | null }>();
  for (const row of wishRehearsals) {
    const iso = toISODate(row.date);
    const cur = wishByDay.get(iso) ?? { count: 0, firstAt: null };
    cur.count += 1;
    cur.firstAt = pickEarliest(cur.firstAt, row.createdAt, iso);
    wishByDay.set(iso, cur);
  }

  const disputationByDay = new Map<
    string,
    { count: number; firstAt: Date | null }
  >();
  for (const row of disputations) {
    const iso = localISO.format(row.createdAt);
    const cur = disputationByDay.get(iso) ?? { count: 0, firstAt: null };
    cur.count += 1;
    cur.firstAt = pickEarliest(cur.firstAt, row.createdAt, iso);
    disputationByDay.set(iso, cur);
  }
  for (const row of disputationRevisits) {
    const iso = toISODate(row.date);
    const cur = disputationByDay.get(iso) ?? { count: 0, firstAt: null };
    cur.count += 1;
    cur.firstAt = pickEarliest(cur.firstAt, row.createdAt, iso);
    disputationByDay.set(iso, cur);
  }

  const gratitudeByDay = new Map<string, Date | null>();
  const duaByDay = new Map<string, Date | null>();
  for (const row of journalEntries) {
    const iso = toISODate(row.date);
    if (row.kind === "GRATITUDE") {
      gratitudeByDay.set(
        iso,
        pickEarliest(gratitudeByDay.get(iso) ?? null, row.createdAt, iso),
      );
    }
    if (row.kind === "DUA") {
      duaByDay.set(
        iso,
        pickEarliest(duaByDay.get(iso) ?? null, row.createdAt, iso),
      );
    }
  }

  const recitationByDay = new Map<string, Date | null>();
  for (const row of recitationLogs) {
    const iso = toISODate(row.date);
    recitationByDay.set(
      iso,
      pickEarliest(recitationByDay.get(iso) ?? null, row.createdAt, iso),
    );
  }

  // ---- index productive sessions & manual logged time by day --------------

  const workSecondsByDay = new Map<string, number>();
  const recoverySecondsByDay = new Map<string, number>();
  const sessionsByDay = new Map<string, DaySessionEntry[]>();
  const attachedTaskSecondsByDay = new Map<string, number>();

  for (const session of sessions) {
    const iso = toISODate(session.localDate);
    if (session.mode === "RECOVERY") {
      recoverySecondsByDay.set(
        iso,
        (recoverySecondsByDay.get(iso) ?? 0) + session.elapsedSeconds,
      );
      continue;
    }

    workSecondsByDay.set(
      iso,
      (workSecondsByDay.get(iso) ?? 0) + session.elapsedSeconds,
    );

    if (session.occurrenceId && session.taskId) {
      const key = `${iso}:${session.taskId}`;
      attachedTaskSecondsByDay.set(
        key,
        (attachedTaskSecondsByDay.get(key) ?? 0) + session.elapsedSeconds,
      );
    }

    if (session.elapsedSeconds > 0) {
      const list = sessionsByDay.get(iso) ?? [];
      list.push({
        id: session.id,
        title: session.task?.title ?? "Open focus",
        mode: session.mode as TimerMode,
        seconds: session.elapsedSeconds,
        overtimeSeconds: session.overtimeSeconds,
        timeLabel: localTime.format(session.startedAt),
      });
      sessionsByDay.set(iso, list);
    }
  }

  for (const occ of occurrences) {
    if (occ.loggedSeconds <= 0) continue;
    const iso = toISODate(occ.date);
    const attached = attachedTaskSecondsByDay.get(`${iso}:${occ.taskId}`) ?? 0;
    const manualSeconds = Math.max(0, occ.loggedSeconds - attached);
    if (manualSeconds <= 0) continue;

    workSecondsByDay.set(
      iso,
      (workSecondsByDay.get(iso) ?? 0) + manualSeconds,
    );

    const list = sessionsByDay.get(iso) ?? [];
    list.push({
      id: `manual:${iso}:${occ.taskId}`,
      title: occ.task.title,
      mode: "MANUAL",
      seconds: manualSeconds,
      overtimeSeconds: 0,
      timeLabel: null,
    });
    sessionsByDay.set(iso, list);
  }

  // ---- assemble 14 dense day records --------------------------------------

  const days: StatsDayRecord[] = Array.from({ length: WINDOW_DAYS }, (_, offset) => {
    const date = addDays(from, offset);
    const iso = toISODate(date);
    const isToday = iso === todayISO;
    const isYesterday = iso === yesterdayISO;

    const dayItems: Record<string, DayItemEntry> = {};

    // 1. Habits — strictly check `isDueOn` so inactive days are never deducted.
    for (const habit of activeHabits) {
      const rule = {
        daysOfWeek: habit.recurrence!.daysOfWeek,
        startDate: habit.recurrence!.startDate,
        endDate: habit.recurrence!.endDate,
      };
      const due = isDueOn(rule, date);
      const occ = habitOccByKey.get(`${habit.id}:${iso}`);

      let detail: string | null = null;
      if (occ?.status === "DONE") {
        if (occ.loggedSeconds >= 60) {
          detail = formatDuration(occ.loggedSeconds);
        } else if (occ.progress > 0) {
          detail =
            habit.recurrence!.unit === "MINUTES"
              ? `${occ.progress}m`
              : `${occ.progress} logged`;
        }
      }

      const times = timeFields(occ?.completedAt ?? null);

      if (!due) {
        dayItems[habit.id] = {
          itemId: habit.id,
          status: occ?.status === "DONE" ? "bonus" : "inactive",
          detail,
          ...(occ?.status === "DONE" ? times : {}),
        };
      } else if (occ?.status === "DONE") {
        dayItems[habit.id] = {
          itemId: habit.id,
          status: "done",
          detail,
          ...times,
        };
      } else if (occ?.status === "SKIPPED") {
        dayItems[habit.id] = { itemId: habit.id, status: "skipped", detail: null };
      } else {
        dayItems[habit.id] = {
          itemId: habit.id,
          status: isToday ? "open" : "missed",
          detail: null,
        };
      }
    }

    // 2. Mind practices (Settings-enabled only)
    for (const tab of enabledMind) {
      const id = mindItemId(tab);
      let done = false;
      let detail: string | null = null;
      let firstAt: Date | null = null;

      if (tab === "braindump") {
        const entry = brainDumpByDay.get(iso);
        if (entry && entry.count > 0) {
          done = true;
          firstAt = entry.firstAt;
          detail =
            entry.count > 1
              ? `${entry.count} dumps`
              : entry.paper > 0
                ? "On paper"
                : entry.seconds >= 60
                  ? formatDuration(entry.seconds)
                  : "Written";
        }
      } else if (tab === "meditate") {
        const entry = meditationByDay.get(iso);
        if (entry && entry.seconds > 0) {
          done = true;
          firstAt = entry.firstAt;
          detail = formatDuration(entry.seconds);
        }
      } else if (tab === "reading") {
        const entry = readingByDay.get(iso);
        if (entry && entry.logs > 0) {
          done = true;
          firstAt = entry.firstAt;
          if (entry.pages > 0) {
            detail = `${entry.pages} ${entry.pages === 1 ? "page" : "pages"}`;
          } else if (entry.percent > 0) {
            detail = `+${entry.percent}%`;
          } else if (entry.bookTitle) {
            detail = entry.bookTitle;
          }
        }
      } else if (tab === "wishes") {
        const entry = wishByDay.get(iso);
        if (entry && entry.count > 0) {
          done = true;
          firstAt = entry.firstAt;
          detail = entry.count > 1 ? `${entry.count} rehearsed` : "Rehearsed";
        }
      } else if (tab === "disputations") {
        const entry = disputationByDay.get(iso);
        if (entry && entry.count > 0) {
          done = true;
          firstAt = entry.firstAt;
          detail = entry.count > 1 ? `${entry.count} entries` : "Practiced";
        }
      }

      dayItems[id] = {
        itemId: id,
        status: done ? "done" : isToday ? "open" : "missed",
        detail,
        ...(done ? timeFields(firstAt) : {}),
      };
    }

    // 3. Heart practices (Settings-enabled only)
    for (const tab of enabledHeart) {
      const id = heartItemId(tab);
      const done =
        tab === "gratitude"
          ? gratitudeByDay.has(iso)
          : tab === "dua"
            ? duaByDay.has(iso)
            : recitationByDay.has(iso);
      const firstAt =
        tab === "gratitude"
          ? (gratitudeByDay.get(iso) ?? null)
          : tab === "dua"
            ? (duaByDay.get(iso) ?? null)
            : (recitationByDay.get(iso) ?? null);

      dayItems[id] = {
        itemId: id,
        status: done ? "done" : isToday ? "open" : "missed",
        detail: done ? (tab === "recitation" ? "Set completed" : "Written") : null,
        ...(done ? timeFields(firstAt) : {}),
      };
    }

    return {
      iso,
      shortLabel: shortDateFmt.format(date),
      fullLabel: fullDateFmt.format(date),
      dayNumber: date.getUTCDate(),
      monthShort: monthShortFmt.format(date),
      weekday: dayOfWeek(date),
      isToday,
      isYesterday,
      productiveSeconds: workSecondsByDay.get(iso) ?? 0,
      recoverySeconds: recoverySecondsByDay.get(iso) ?? 0,
      items: dayItems,
      sessions: sessionsByDay.get(iso) ?? [],
    };
  });

  return {
    endISO: win.endISO,
    windowLabel,
    isLatest: win.isLatest,
    prevEndISO: win.prevEndISO,
    nextEndISO: win.nextEndISO,
    weekStart: user.weekStart,
    todayISO,
    items,
    days,
  };
}
