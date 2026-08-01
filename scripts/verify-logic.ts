/**
 * Checks over the correctness-critical pure logic: timezone day-bucketing,
 * habit recurrence and streaks, the interval planner, and the wall-clock
 * elapsed calculation. These are the parts that are easy to get subtly wrong
 * and hard to notice, so they are exercised in isolation.
 *
 * Run with `pnpm verify`.
 */

import assert from "node:assert/strict";

import {
  addDays,
  dayOfWeek,
  formatClock,
  formatDuration,
  formatRelativeDate,
  parseLocalDate,
  toISODate,
  toLocalDate,
} from "@/lib/dates";
import {
  computeStreak,
  describeRecurrence,
  expectedDatesBetween,
  isDueOn,
} from "@/lib/recurrence";
import {
  adjustedOvertime,
  arcProgress,
  buildIntervalPlan,
  clampLoggedSeconds,
  dualScale,
  endsAutomatically,
  hasProgressIndicator,
  intervalOverrunSeconds,
  intervalTickFractions,
  isBreakKind,
  liveElapsedMs,
  loggedElapsedSeconds,
  macroProgress,
  MAX_LOGGED_SECONDS,
  microProgress,
  overtimeProgress,
  planFocusSeconds,
  planTotalSeconds,
  readoutSeconds,
  sessionKind,
  suggestIntervals,
  WORK_MODES,
} from "@/lib/timer-math";
import {
  abutsNeighbour,
  tightCount,
  transitionMinutes,
  transitionsForDay,
  type TransitionBlock,
} from "@/lib/transitions";
import { breaksWorthReporting, summariseBreaks } from "@/lib/break-stats";
import { balanceRatio, describeBalance, recoveryShare } from "@/lib/balance";
import { parseQuickAdd } from "@/lib/quick-parse";
import {
  gratitudePrompt,
  nextCloseStep,
  parseCloseStep,
} from "@/lib/close-ritual";
import {
  claimedMinutes,
  clampSpan,
  conflictsWith,
  findFreeSlot,
  formatMinuteOfDay,
  freeSlots,
  layoutColumns,
  mergeSpans,
  MIN_BLOCK_MINUTES,
  overlaps,
  parseMinuteOfDay,
  snap,
  spanOfLength,
} from "@/lib/block-math";
import {
  anchorTitleOf,
  chainOf,
  cueEdges,
  cueLengthMinutes,
  cueSpanFor,
  describeCue,
  describeStack,
  wouldCycle,
} from "@/lib/habit-cue";
import {
  meetsMinimum,
  minimumMarkerRatio,
  minutesFromSeconds,
  quotaRatio,
  recreditedProgress,
  remainingToMinimum,
  statusForTier,
  tierFor,
  type Quota,
} from "@/lib/quota";
import {
  EASY_FIRST_STEP_SECONDS,
  firstStep,
  isGentleStart,
  nextStep,
  stepProgress,
} from "@/lib/steps";
import {
  buildTimerHref,
  parseTimerParams,
} from "@/lib/timer-url";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

console.log("\ndates — timezone bucketing");

check("an instant late on the 28th in Karachi is the 28th, not the 29th", () => {
  // 2026-07-28 20:00 in Karachi (UTC+5) is 15:00Z the same day.
  const instant = new Date("2026-07-28T15:00:00.000Z");
  assert.equal(toISODate(toLocalDate(instant, "Asia/Karachi")), "2026-07-28");
});

check("the same instant is still the 28th in UTC", () => {
  const instant = new Date("2026-07-28T15:00:00.000Z");
  assert.equal(toISODate(toLocalDate(instant, "UTC")), "2026-07-28");
});

check("22:00 UTC is already tomorrow in Karachi", () => {
  const instant = new Date("2026-07-28T22:00:00.000Z");
  assert.equal(toISODate(toLocalDate(instant, "Asia/Karachi")), "2026-07-29");
});

check("02:00 UTC is still yesterday in Los Angeles", () => {
  const instant = new Date("2026-07-28T02:00:00.000Z");
  assert.equal(toISODate(toLocalDate(instant, "America/Los_Angeles")), "2026-07-27");
});

check("addDays across a US DST boundary stays exact", () => {
  // 2026-03-08 is the US spring-forward. UTC-midnight arithmetic must not skew.
  const before = parseLocalDate("2026-03-07")!;
  assert.equal(toISODate(addDays(before, 1)), "2026-03-08");
  assert.equal(toISODate(addDays(before, 2)), "2026-03-09");
});

check("dayOfWeek matches the real calendar", () => {
  // 2026-07-28 is a Tuesday.
  assert.equal(dayOfWeek(parseLocalDate("2026-07-28")!), 2);
  assert.equal(dayOfWeek(parseLocalDate("2026-08-02")!), 0); // Sunday
});

check("parseLocalDate rejects junk", () => {
  assert.equal(parseLocalDate("not-a-date"), null);
  assert.equal(parseLocalDate("2026-7-8"), null);
});

console.log("\ndates — formatting");

check("formatClock pads and switches to hours", () => {
  assert.equal(formatClock(1500), "25:00");
  assert.equal(formatClock(65), "1:05");
  assert.equal(formatClock(3933), "1:05:33");
  assert.equal(formatClock(0), "0:00");
});

check("formatDuration reads like prose", () => {
  assert.equal(formatDuration(30), "30s");
  assert.equal(formatDuration(1200), "20m");
  assert.equal(formatDuration(3600), "1h");
  assert.equal(formatDuration(4800), "1h 20m");
});

check("formatRelativeDate names the near days", () => {
  const today = parseLocalDate("2026-07-28")!;
  assert.equal(formatRelativeDate(today, today), "Today");
  assert.equal(formatRelativeDate(addDays(today, 1), today), "Tomorrow");
  assert.equal(formatRelativeDate(addDays(today, -1), today), "Yesterday");
  assert.equal(formatRelativeDate(addDays(today, -3), today), "3 days overdue");
});

console.log("\nrecurrence — the sparse model");

const monWedFri = {
  daysOfWeek: [1, 3, 5],
  startDate: parseLocalDate("2026-07-01")!,
  endDate: null,
};

check("a Mon/Wed/Fri habit is due on Wednesday", () => {
  assert.equal(isDueOn(monWedFri, parseLocalDate("2026-07-29")!), true); // Wed
});

check("...and is not due on Tuesday", () => {
  assert.equal(isDueOn(monWedFri, parseLocalDate("2026-07-28")!), false); // Tue
});

check("...and is not due before it started", () => {
  assert.equal(isDueOn(monWedFri, parseLocalDate("2026-06-29")!), false); // a Monday
});

check("...and stops after endDate", () => {
  const ended = { ...monWedFri, endDate: parseLocalDate("2026-07-10")! };
  assert.equal(isDueOn(ended, parseLocalDate("2026-07-13")!), false); // Monday after
});

check("expectedDatesBetween counts only due days", () => {
  const dates = expectedDatesBetween(
    monWedFri,
    parseLocalDate("2026-07-06")!,
    parseLocalDate("2026-07-12")!,
  );
  assert.deepEqual(dates.map(toISODate), ["2026-07-06", "2026-07-08", "2026-07-10"]);
});

check("a missed Tuesday does not break a Mon/Wed/Fri streak", () => {
  const today = parseLocalDate("2026-07-31")!; // Friday
  const history = new Map<string, "DONE" | "SKIPPED">([
    ["2026-07-20", "DONE"],
    ["2026-07-22", "DONE"],
    ["2026-07-24", "DONE"],
    ["2026-07-27", "DONE"],
    ["2026-07-29", "DONE"],
  ]);
  const streak = computeStreak(monWedFri, history, today);
  // Today (Friday) is not yet a miss, so the five prior due days all count.
  assert.equal(streak.current, 5);
});

check("a missed due day does break the streak", () => {
  const today = parseLocalDate("2026-07-31")!;
  const history = new Map<string, "DONE" | "SKIPPED">([
    ["2026-07-20", "DONE"],
    ["2026-07-22", "DONE"],
    // 2026-07-24 (Fri) missed
    ["2026-07-27", "DONE"],
    ["2026-07-29", "DONE"],
  ]);
  assert.equal(computeStreak(monWedFri, history, today).current, 2);
});

check("an explicit skip holds the streak without extending it", () => {
  const today = parseLocalDate("2026-07-31")!;
  const history = new Map<string, "DONE" | "SKIPPED">([
    ["2026-07-20", "DONE"],
    ["2026-07-22", "DONE"],
    ["2026-07-24", "SKIPPED"],
    ["2026-07-27", "DONE"],
    ["2026-07-29", "DONE"],
  ]);
  assert.equal(computeStreak(monWedFri, history, today).current, 4);
});

check("describeRecurrence uses the names people say", () => {
  assert.equal(describeRecurrence([0, 1, 2, 3, 4, 5, 6]), "Every day");
  assert.equal(describeRecurrence([1, 2, 3, 4, 5]), "Weekdays");
  assert.equal(describeRecurrence([0, 6]), "Weekends");
  assert.equal(describeRecurrence([1, 3, 5]), "Mon, Wed, Fri");
});

console.log("\ntimer — plan building");

const settings = {
  focusSeconds: 1500,
  shortBreakSeconds: 300,
  longBreakSeconds: 900,
  longBreakEvery: 4,
};

check("basic mode is one block, no breaks", () => {
  const plan = buildIntervalPlan({
    mode: "BASIC",
    targetSeconds: 1200,
    intervals: 1,
    ...settings,
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, "FOCUS");
  assert.equal(plan[0].targetSeconds, 1200);
});

check("a 20-minute task is one pomodoro, not zero", () => {
  assert.equal(suggestIntervals(1200, 1500), 1);
});

check("a 60-minute task suggests two 25-minute pomodoros", () => {
  assert.equal(suggestIntervals(3600, 1500), 2);
});

check("pomodoro interleaves breaks and never ends on one", () => {
  const plan = buildIntervalPlan({
    mode: "POMODORO",
    targetSeconds: 3600,
    intervals: 3,
    ...settings,
  });
  assert.deepEqual(
    plan.map((i) => i.kind),
    ["FOCUS", "SHORT_BREAK", "FOCUS", "SHORT_BREAK", "FOCUS"],
  );
  assert.equal(plan.at(-1)!.kind, "FOCUS");
});

check("focus time in the plan matches the target", () => {
  const plan = buildIntervalPlan({
    mode: "POMODORO",
    targetSeconds: 3600,
    intervals: 3,
    ...settings,
  });
  assert.equal(planFocusSeconds(plan), 3600);
});

check("a long break lands after every fourth focus block", () => {
  const plan = buildIntervalPlan({
    mode: "POMODORO",
    targetSeconds: 5 * 1500,
    intervals: 5,
    ...settings,
  });
  assert.deepEqual(
    plan.map((i) => i.kind),
    [
      "FOCUS", "SHORT_BREAK",
      "FOCUS", "SHORT_BREAK",
      "FOCUS", "SHORT_BREAK",
      "FOCUS", "LONG_BREAK",
      "FOCUS",
    ],
  );
});

check("flow mode is a single block regardless of intervals", () => {
  const plan = buildIntervalPlan({
    mode: "FLOW",
    targetSeconds: 1800,
    intervals: 4,
    ...settings,
  });
  assert.equal(plan.length, 1);
});

console.log("\ntimer — the wall clock");

check("elapsed is derived from wall-clock deltas, not ticks", () => {
  const start = 1_000_000;
  const state = { accumulatedMs: 0, runningSince: start };
  // Simulate the tab being frozen for three minutes: no ticks happened at all.
  assert.equal(liveElapsedMs(state, start + 180_000), 180_000);
});

check("a paused clock does not advance", () => {
  const state = { accumulatedMs: 42_000, runningSince: null };
  assert.equal(liveElapsedMs(state, Date.now()), 42_000);
  assert.equal(liveElapsedMs(state, Date.now() + 999_999), 42_000);
});

check("resuming adds to what was already banked", () => {
  const state = { accumulatedMs: 60_000, runningSince: 5_000 };
  assert.equal(liveElapsedMs(state, 35_000), 90_000);
});

check("the arc drains from full to empty and stops there", () => {
  assert.equal(arcProgress(0, 1200), 1);
  assert.equal(arcProgress(600, 1200), 0.5);
  assert.equal(arcProgress(1200, 1200), 0);
  assert.equal(arcProgress(9999, 1200), 0); // clamped, never negative
});

check("the macro container measures the whole plan, breaks included", () => {
  // 3x25 focus with two 5-minute breaks between them: 85 minutes of your
  // afternoon, not the 75 minutes of focus that arcProgress measures.
  const plan = buildIntervalPlan({
    mode: "POMODORO",
    targetSeconds: 4500,
    intervals: 3,
    ...settings,
  });
  assert.equal(planTotalSeconds(plan), 5100);

  assert.equal(macroProgress(0, plan), 1);
  assert.equal(macroProgress(5100, plan), 0);
  assert.equal(macroProgress(99999, plan), 0); // clamped, never negative

  // The distinction that makes the second container worth drawing: at the end
  // of the first pomodoro the macro ring has barely moved.
  assert.equal(Math.round(macroProgress(1500, plan) * 100), 71);
});

check("the micro container measures only the interval you are in", () => {
  const interval = { index: 0, kind: "FOCUS" as const, targetSeconds: 1500 };
  assert.equal(microProgress(0, interval), 1);
  assert.equal(microProgress(750, interval), 0.5);
  assert.equal(microProgress(1500, interval), 0);
  assert.equal(microProgress(9999, interval), 0);
});

check("LOAD-BEARING: neither container fills over a zero target", () => {
  // Recovery's single interval has a target of zero and its plan totals zero.
  // Without these guards rest renders as a fully spent container, and the
  // haptic thresholds both fire the moment it starts.
  const plan = buildIntervalPlan({
    mode: "RECOVERY",
    targetSeconds: 0,
    intervals: 1,
    ...settings,
  });
  assert.equal(macroProgress(0, plan), 0);
  assert.equal(macroProgress(600, plan), 0);
  assert.equal(microProgress(600, plan[0]), 0);
  assert.equal(microProgress(600, undefined), 0);
});

check("both containers are only worth drawing when they differ", () => {
  const single = buildIntervalPlan({
    mode: "BASIC",
    targetSeconds: 1500,
    intervals: 1,
    ...settings,
  });
  const split = buildIntervalPlan({
    mode: "POMODORO",
    targetSeconds: 3000,
    intervals: 2,
    ...settings,
  });

  assert.equal(dualScale(single), false);
  assert.equal(dualScale(split), true);

  // The reason: with one interval the two are the same number, so the second
  // ring would be a duplicate drawn at a different radius.
  assert.equal(macroProgress(750, single), microProgress(750, single[0]));
});

check("overtime only exists past the target", () => {
  assert.equal(overtimeProgress(1199, 1200), 0);
  assert.equal(overtimeProgress(1800, 1200), 0.5);
  assert.equal(overtimeProgress(99999, 1200), 1); // clamped
});

console.log("\nthe task -> timer handoff");

check("a task's link carries its estimate and mode", () => {
  const href = buildTimerHref({
    id: "task_abc",
    estimatedSeconds: 1200,
    defaultMode: "POMODORO",
    plannedIntervals: 2,
  });
  assert.equal(href, "/timer?taskId=task_abc&mode=pomodoro&target=1200&intervals=2");
});

check("there is no autostart parameter anywhere in the link", () => {
  const href = buildTimerHref({
    id: "task_abc",
    estimatedSeconds: 1200,
    defaultMode: "FLOW",
    plannedIntervals: null,
  });
  assert.equal(href.includes("autostart"), false);
  assert.equal(href.includes("start"), false);
});

check("a task with no estimate omits the target so defaults apply", () => {
  const href = buildTimerHref({
    id: "t1",
    estimatedSeconds: null,
    defaultMode: "BASIC",
    plannedIntervals: null,
  });
  assert.equal(href, "/timer?taskId=t1&mode=basic");
});

check("the page round-trips its own link", () => {
  const parsed = parseTimerParams({
    taskId: "task_abc",
    mode: "pomodoro",
    target: "1200",
    intervals: "2",
  });
  assert.deepEqual(parsed, {
    taskId: "task_abc",
    mode: "pomodoro",
    target: 1200,
    intervals: 2,
  });
});

check("a hostile query string degrades to no preferences, never a throw", () => {
  assert.deepEqual(parseTimerParams({ mode: "evil", target: "-999999" }), {});
  assert.deepEqual(parseTimerParams({ target: "9999999999" }), {});
  assert.deepEqual(parseTimerParams({}), {});
});

console.log("\nrecovery — the shape of rest");

// The five checks marked LOAD-BEARING below are the ones that would catch the
// recovery bugs: without them, a rest session ends the instant it starts and
// logs its entire duration as overtime. None of it is visible in the UI until
// you have a month of stats, so this is the only place it gets caught.

check("a recovery plan is one open-ended block, not a focus block", () => {
  const plan = buildIntervalPlan({
    mode: "RECOVERY",
    targetSeconds: 0,
    intervals: 1,
    ...settings,
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, "RECOVERY");
  assert.equal(plan[0].targetSeconds, 0);
});

check("recovery never ends on its own", () => {
  assert.equal(endsAutomatically("RECOVERY"), false);
});

check("flow never ends on its own either", () => {
  assert.equal(endsAutomatically("FLOW"), false);
});

check("basic and pomodoro do end on their own", () => {
  assert.equal(endsAutomatically("BASIC"), true);
  assert.equal(endsAutomatically("POMODORO"), true);
});

check("recovery draws no progress indicator at all", () => {
  assert.equal(hasProgressIndicator("RECOVERY"), false);
  assert.equal(hasProgressIndicator("BASIC"), true);
});

check("LOAD-BEARING: an arc over a zero target is empty, not full", () => {
  assert.equal(arcProgress(0, 0), 0);
  assert.equal(arcProgress(500, 0), 0);
});

check("LOAD-BEARING: a zero target produces no overtime", () => {
  // Without this, endSession logs every second of rest as time past a goal.
  assert.equal(overtimeProgress(9999, 0), 0);
});

check("a recovery plan has no tick marks", () => {
  const plan = buildIntervalPlan({
    mode: "RECOVERY",
    targetSeconds: 0,
    intervals: 1,
    ...settings,
  });
  assert.deepEqual(intervalTickFractions(plan), []);
});

check("a recovery readout climbs from zero", () => {
  assert.equal(readoutSeconds("RECOVERY", 0, 0), 0);
  assert.equal(readoutSeconds("RECOVERY", 930, 0), 930);
});

check("a basic readout falls to zero and stops there", () => {
  assert.equal(readoutSeconds("BASIC", 0, 1500), 1500);
  assert.equal(readoutSeconds("BASIC", 1400, 1500), 100);
  assert.equal(readoutSeconds("BASIC", 1600, 1500), 0);
});

check("a flow readout falls to zero, then climbs", () => {
  assert.equal(readoutSeconds("FLOW", 1400, 1500), 100);
  assert.equal(readoutSeconds("FLOW", 1600, 1500), 1600);
});

check("recovery is not one of the work shapes", () => {
  assert.equal(WORK_MODES.includes("RECOVERY" as never), false);
  assert.equal(WORK_MODES.length, 3);
});

check("work and recovery are peers, not siblings of pomodoro", () => {
  assert.equal(sessionKind("POMODORO"), "WORK");
  assert.equal(sessionKind("BASIC"), "WORK");
  assert.equal(sessionKind("FLOW"), "WORK");
  assert.equal(sessionKind("RECOVERY"), "RECOVERY");
});

console.log("\nbalance — work against rest");

check("no time logged at all has no ratio, rather than a zero one", () => {
  assert.equal(recoveryShare(0, 0), null);
  assert.equal(balanceRatio(0, 0), null);
});

check("all work and no rest is a share of zero", () => {
  assert.equal(recoveryShare(3600, 0), 0);
});

check("an even day is a half share and a 1:1 ratio", () => {
  assert.equal(recoveryShare(3600, 3600), 0.5);
  assert.equal(balanceRatio(3600, 3600), 1);
});

check("zero recovery has no ratio rather than infinity", () => {
  assert.equal(balanceRatio(3600, 0), null);
});

check("a rest-only day is a ratio of zero, not null", () => {
  assert.equal(balanceRatio(0, 1800), 0);
});

check("the balance sentence never says NaN or Infinity", () => {
  for (const [work, rest] of [
    [0, 0],
    [3600, 0],
    [0, 3600],
    [3600, 3600],
    [7200, 1800],
    [1800, 7200],
  ]) {
    const sentence = describeBalance(work, rest);
    assert.equal(sentence.includes("NaN"), false);
    assert.equal(sentence.includes("Infinity"), false);
    assert.ok(sentence.length > 0);
  }
});

console.log("\ncapture shorthand — parsed at triage, never at capture");

check("a dumped line with shorthand promotes to a parsed task", () => {
  assert.deepEqual(parseQuickAdd("Email the landlord 20m #Admin p1"), {
    title: "Email the landlord",
    minutes: 20,
    projectName: "Admin",
    priority: "P1",
  });
});

check("a dump with no shorthand promotes verbatim", () => {
  assert.deepEqual(parseQuickAdd("call mum"), {
    title: "call mum",
    minutes: null,
    projectName: null,
    priority: "P4",
  });
});

check("shorthand-only input yields no title, so promotion can refuse it", () => {
  assert.equal(parseQuickAdd("20m #Admin p1").title, "");
});

check("hours and minutes combine", () => {
  assert.equal(parseQuickAdd("thing 1h 30m").minutes, 90);
});

check("an absurd estimate is capped rather than accepted", () => {
  assert.equal(parseQuickAdd("thing 999m").minutes, 480);
});

console.log("\nthe close — stepped through the URL");

check("an unknown step falls back to the first, never throws", () => {
  assert.equal(parseCloseStep("nonsense"), "one-thing");
  assert.equal(parseCloseStep(undefined), "one-thing");
  assert.equal(parseCloseStep(["worry"]), "one-thing");
});

check("a real step is preserved, so refresh doesn't restart the ritual", () => {
  assert.equal(parseCloseStep("worry"), "worry");
  assert.equal(parseCloseStep("gratitude"), "gratitude");
});

check("the four steps advance in order and the last has no next", () => {
  assert.equal(nextCloseStep("one-thing"), "worry");
  assert.equal(nextCloseStep("worry"), "gratitude");
  assert.equal(nextCloseStep("gratitude"), "handoff");
  assert.equal(nextCloseStep("handoff"), null);
});

check("the gratitude prompt is stable for a given day", () => {
  const date = parseLocalDate("2026-07-28")!;
  assert.equal(gratitudePrompt(date), gratitudePrompt(date));
  assert.ok(gratitudePrompt(date).length > 0);
  // And it does actually rotate.
  const prompts = new Set(
    Array.from({ length: 14 }, (_, i) =>
      gratitudePrompt(addDays(date, i)),
    ),
  );
  assert.ok(prompts.size > 1);
});

console.log("\ntime blocking — minute arithmetic");

const span = (startMinute: number, endMinute: number) => ({ startMinute, endMinute });

check("touching blocks do not overlap, because the end is exclusive", () => {
  // LOAD-BEARING. If this flips, every back-to-back pair on the calendar
  // renders half width forever, and "the day is double booked" stops meaning
  // anything because it's always true.
  assert.equal(overlaps(span(540, 600), span(600, 660)), false);
  assert.equal(overlaps(span(540, 601), span(600, 660)), true);
  assert.equal(overlaps(span(540, 660), span(560, 600)), true, "fully contained");
  assert.equal(overlaps(span(560, 600), span(540, 660)), true, "the other way round");
});

check("a block cannot be dragged inside out, or to nothing", () => {
  const inverted = clampSpan(600, 540);
  assert.ok(inverted.endMinute > inverted.startMinute);
  assert.ok(inverted.endMinute - inverted.startMinute >= MIN_BLOCK_MINUTES);

  const zero = clampSpan(600, 600);
  assert.equal(zero.endMinute - zero.startMinute, MIN_BLOCK_MINUTES);
});

check("a block dragged past midnight is trimmed, not wrapped", () => {
  const late = spanOfLength(1430, 60);
  assert.equal(late.endMinute, 1440);
  assert.ok(late.startMinute < late.endMinute);
});

check("snapping goes to the nearest quarter hour", () => {
  assert.equal(snap(0), 0);
  assert.equal(snap(7), 0);
  assert.equal(snap(8), 15);
  assert.equal(snap(608), 615);
  assert.equal(snap(-40), 0, "and never below zero");
});

check("overlapping spans merge instead of producing a phantom gap", () => {
  // The bug this guards: a naive pairwise walk reports free time between two
  // blocks that overlap, and the scheduler then books a task into it.
  const merged = mergeSpans([span(540, 660), span(600, 720)]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0], span(540, 720));
});

check("claimed time counts double bookings once", () => {
  assert.equal(claimedMinutes([span(540, 660), span(600, 720)]), 180);
  assert.equal(claimedMinutes([]), 0);
});

check("free slots are the complement of the busy ones", () => {
  const free = freeSlots([span(540, 600), span(660, 720)], 480, 780);
  assert.deepEqual(free, [span(480, 540), span(600, 660), span(720, 780)]);
});

check("an empty day is one free slot, and a full one is none", () => {
  assert.deepEqual(freeSlots([], 540, 600), [span(540, 600)]);
  assert.deepEqual(freeSlots([span(500, 700)], 540, 600), []);
});

check("scheduling finds the first gap the task actually fits in", () => {
  const day = [span(540, 600), span(615, 700)];
  const slot = findFreeSlot(day, 30, 480);
  assert.ok(slot);
  assert.equal(slot.startMinute, 480, "the gap before the first block");
  assert.equal(slot.endMinute, 510);

  // 45 minutes doesn't fit before 09:00 (only 60 does, but 15 is left after
  // the first block), so it lands after the second.
  const later = findFreeSlot(day, 90, 540);
  assert.ok(later);
  assert.ok(later.startMinute >= 700);
});

check("a full day returns no slot rather than inventing one", () => {
  // LOAD-BEARING. Returning a slot here would silently stack blocks on top of
  // each other, which is exactly how a calendar stops being believed.
  assert.equal(findFreeSlot([span(0, 1440)], 30, 0), null);
  assert.equal(findFreeSlot([span(540, 600)], 120, 540, 600), null);
});

check("a found slot never collides with what's already there", () => {
  const day = [span(540, 600), span(615, 700), span(800, 900)];
  const slot = findFreeSlot(day, 60, 540);
  assert.ok(slot);
  assert.deepEqual(conflictsWith(slot, day.map((s, i) => ({ ...s, id: String(i) }))), []);
});

check("editing a block does not report it as conflicting with itself", () => {
  const blocks = [{ ...span(540, 600), id: "a" }, { ...span(700, 760), id: "b" }];
  assert.equal(conflictsWith(span(540, 600), blocks).length, 1);
  assert.equal(conflictsWith(span(540, 600), blocks, "a").length, 0);
});

check("overlapping blocks are laid out side by side", () => {
  const laid = layoutColumns([
    { ...span(540, 660), id: "a" },
    { ...span(600, 720), id: "b" },
  ]);
  assert.equal(laid.length, 2);
  assert.deepEqual(laid.map((item) => item.columns), [2, 2]);
  assert.deepEqual([...new Set(laid.map((item) => item.column))].sort(), [0, 1]);
});

check("an uncontested block is never narrowed by a busy morning elsewhere", () => {
  const laid = layoutColumns([
    { ...span(540, 660), id: "a" },
    { ...span(600, 720), id: "b" },
    { ...span(900, 960), id: "afternoon" },
  ]);
  const afternoon = laid.find((item) => item.block.id === "afternoon")!;
  assert.equal(afternoon.columns, 1, "clusters break where nothing is running");
});

check("minute-of-day formatting round-trips", () => {
  assert.equal(formatMinuteOfDay(545), "09:05");
  assert.equal(formatMinuteOfDay(0), "00:00");
  assert.equal(formatMinuteOfDay(1440), "00:00", "midnight at the far end");
  assert.equal(parseMinuteOfDay("09:05"), 545);
  assert.equal(parseMinuteOfDay("23:59"), 1439);
});

check("a malformed time is rejected rather than coerced to midnight", () => {
  // Coercing would move someone's block to 00:00 with no error shown.
  assert.equal(parseMinuteOfDay("nonsense"), null);
  assert.equal(parseMinuteOfDay("25:00"), null);
  assert.equal(parseMinuteOfDay("9:5"), null);
  assert.equal(parseMinuteOfDay(""), null);
});

console.log("\nhabit stacking — cues and chains");

const cue = (
  anchorTaskId: string | null,
  anchorLabel: string | null,
  anchorMinutes = 5,
) => ({ anchorTaskId, anchorLabel, anchorMinutes });

check("a cue block ends exactly where the habit it cues begins", () => {
  // LOAD-BEARING. Adjacency IS habit stacking — a cue with a gap after it is
  // just an unrelated block, and one that overlaps has eaten the habit's time.
  const habit = span(480, 540);
  const placed = cueSpanFor(habit, 5)!;
  assert.equal(placed.endMinute, habit.startMinute);
  assert.equal(placed.startMinute, 475);
  assert.equal(overlaps(placed, habit), false);
});

check("a cue up against midnight is shortened, never pushed past it", () => {
  // The alternative is moving the habit to make room, which silently rewrites
  // the time you chose.
  const placed = cueSpanFor(span(3, 60), 30)!;
  assert.equal(placed.startMinute, 0);
  assert.equal(placed.endMinute, 3, "abuts, even at 3 minutes long");

  assert.equal(cueSpanFor(span(0, 60), 15), null, "nothing comes before 00:00");
});

check("a habit anchor's own estimate beats the fallback minutes", () => {
  // Two answers to "how long does the workout take" is one too many, and the
  // habit's own estimate is the one every other surface already shows.
  assert.equal(cueLengthMinutes(cue("workout", null, 5), 45 * 60), 45);
  assert.equal(cueLengthMinutes(cue("workout", null, 5), null), 5);
  // A label anchor has no estimate to borrow, whatever gets passed.
  assert.equal(cueLengthMinutes(cue(null, "tea", 7), 45 * 60), 7);
  assert.equal(
    cueLengthMinutes(cue(null, "tea", 1), null),
    MIN_BLOCK_MINUTES,
    "and never shorter than the shortest block",
  );
});

check("the anchor's title comes from whichever kind of anchor it is", () => {
  assert.equal(anchorTitleOf(cue("workout", null), "Workout"), "Workout");
  assert.equal(anchorTitleOf(cue(null, "drinking tea"), undefined), "drinking tea");
  assert.equal(
    anchorTitleOf(cue("workout", null), undefined),
    null,
    "a habit anchor with no title in hand resolves to nothing, not to ''",
  );
  assert.equal(anchorTitleOf(cue(null, "   ")), null, "whitespace is not a cue");
});

check("the recipe reads as a sentence, because that's the technique", () => {
  assert.equal(
    describeStack("drinking tea", "Meditation"),
    "After drinking tea, I will Meditation.",
  );
  assert.equal(describeCue("drinking tea"), "After drinking tea");
  assert.equal(describeCue(null), null, "no anchor, no sentence");
});

check("stacking a habit on itself is a cycle", () => {
  assert.equal(wouldCycle("a", "a", new Map()), true);
});

check("a cycle is caught however far down the chain it closes", () => {
  // LOAD-BEARING. The chain is walked by following each habit's own anchor, so a
  // loop anywhere in it hangs every surface that renders the stack.
  const edges = cueEdges([
    { taskId: "meditation", anchorTaskId: "tea-habit" },
    { taskId: "journal", anchorTaskId: "meditation" },
  ]);

  assert.equal(wouldCycle("tea-habit", "journal", edges), true, "3-cycle");
  assert.equal(wouldCycle("tea-habit", "meditation", edges), true, "2-cycle");
  assert.equal(
    wouldCycle("stretching", "journal", edges),
    false,
    "extending the chain is fine",
  );
});

check("label anchors never take part in a cycle", () => {
  // They're leaves: nothing can be stacked on a thing that isn't a habit.
  const edges = cueEdges([{ taskId: "meditation", anchorTaskId: null }]);
  assert.equal(edges.size, 0);
  assert.equal(wouldCycle("meditation", "journal", edges), false);
});

check("the chain comes back earliest first, and stops at the root", () => {
  const edges = cueEdges([
    { taskId: "meditation", anchorTaskId: "tea-habit" },
    { taskId: "journal", anchorTaskId: "meditation" },
  ]);

  assert.deepEqual(chainOf("journal", edges), [
    "tea-habit",
    "meditation",
    "journal",
  ]);
  assert.deepEqual(chainOf("tea-habit", edges), ["tea-habit"], "a root is itself");
});

check("walking a corrupt chain terminates instead of hanging the render", () => {
  // wouldCycle should mean this can never be stored, but a walk that could spin
  // forever on bad data is not worth the two lines it saves.
  const looped = new Map([
    ["a", "b"],
    ["b", "a"],
  ]);
  assert.deepEqual(chainOf("a", looped), ["b", "a"]);
});

console.log("\nsteps — the way in");

const step = (
  id: string,
  position: number,
  estimatedSeconds: number | null,
  completedAt: Date | null = null,
) => ({ id, title: id, position, estimatedSeconds, completedAt });

check("the first step is by position, not by array order", () => {
  const steps = [step("b", 1, null), step("a", 0, null)];
  assert.equal(firstStep(steps)?.id, "a");
});

check("the next step is the first unticked one, which is not the first step", () => {
  // These two diverge the moment you tick anything, and every surface that
  // renders a checklist depends on the difference.
  const steps = [step("a", 0, null, new Date()), step("b", 1, null)];
  assert.equal(firstStep(steps)?.id, "a");
  assert.equal(nextStep(steps)?.id, "b");
});

check("a fully ticked task has no next step", () => {
  const done = [step("a", 0, null, new Date())];
  assert.equal(nextStep(done), null);
  assert.equal(stepProgress(done).allDone, true);
});

check("progress on a task with no steps is zero, not NaN", () => {
  const empty = stepProgress([]);
  assert.equal(empty.ratio, 0);
  assert.equal(empty.allDone, false, "nothing to do is not the same as done");
});

check("a two-minute first step is gentle and a twenty-minute one is not", () => {
  assert.equal(isGentleStart(step("a", 0, EASY_FIRST_STEP_SECONDS)), true);
  assert.equal(isGentleStart(step("a", 0, EASY_FIRST_STEP_SECONDS + 1)), false);
});

check("an unestimated first step is 'can't tell', never a warning", () => {
  // LOAD-BEARING. Returning false here would nag about every optional field
  // left blank, which is the fastest way to make someone stop opening the app.
  assert.equal(isGentleStart(step("a", 0, null)), null);
  assert.equal(isGentleStart(null), null);
});

console.log("\nhabit quotas — two bars, one streak");

const quota = (minimum: number, optimal: number | null = null): Quota => ({
  unit: "COUNT",
  minimum,
  optimal,
});

check("the tier is a function of the day's total, not of what happened first", () => {
  // LOAD-BEARING, and the whole "minimum then optimal counts only as optimal"
  // rule. Because the tier is derived from one number rather than reduced over
  // a sequence of events, there is no representable state in which a single day
  // counts twice. Do not reintroduce an event log here.
  const q = quota(1, 10);
  assert.equal(tierFor(1, q), "MINIMUM");
  assert.equal(tierFor(10, q), "OPTIMAL");
  // Did the minimum, carried on to the optimal: still exactly one OPTIMAL day.
  assert.equal(tierFor(1 + 9, q), "OPTIMAL");
  // And overshooting doesn't invent a third tier.
  assert.equal(tierFor(400, q), "OPTIMAL");
});

check("below the minimum is nothing, however close", () => {
  assert.equal(tierFor(0, quota(1)), "NONE");
  assert.equal(tierFor(9, quota(10, 20)), "NONE");
  assert.equal(tierFor(10, quota(10, 20)), "MINIMUM");
});

check("a habit with no optimal tops out at MINIMUM", () => {
  const q = quota(5, null);
  assert.equal(tierFor(5, q), "MINIMUM");
  assert.equal(tierFor(500, q), "MINIMUM", "no stretch goal means no optimal day");
});

check("a zero minimum cannot make every untouched day count", () => {
  // Otherwise an unset quota silently grants a permanent streak on every habit.
  assert.equal(tierFor(0, quota(0)), "NONE");
});

check("an optimal at or below the minimum resolves to the better tier", () => {
  // The form rejects this, but old rows may hold it, and reading it as the
  // worse of the two would demote days that genuinely cleared both bars.
  assert.equal(tierFor(5, { unit: "COUNT", minimum: 5, optimal: 3 }), "OPTIMAL");
});

check("the streak asks about the minimum and nothing else", () => {
  assert.equal(meetsMinimum("NONE"), false);
  assert.equal(meetsMinimum("MINIMUM"), true);
  assert.equal(meetsMinimum("OPTIMAL"), true);
  // The invariant the whole app relies on: DONE means the minimum was met.
  assert.equal(statusForTier("MINIMUM"), "DONE");
  assert.equal(statusForTier("OPTIMAL"), "DONE");
  assert.equal(statusForTier("NONE"), "PENDING");
});

check("a minimum-only day keeps a streak exactly as an optimal day does", () => {
  const rule = {
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: parseLocalDate("2026-07-20")!,
    endDate: null,
  };
  const today = parseLocalDate("2026-07-24")!;

  // Four days: minimum, optimal, minimum, optimal. The streak cannot tell them
  // apart, and that is the point of having a low bar at all.
  const history = new Map<string, "DONE" | "SKIPPED">([
    ["2026-07-20", "DONE"],
    ["2026-07-21", "DONE"],
    ["2026-07-22", "DONE"],
    ["2026-07-23", "DONE"],
  ]);

  assert.equal(computeStreak(rule, history, today).current, 4);
});

check("the ring is drawn against the optimal, with the minimum as a notch", () => {
  const q = quota(2, 10);
  assert.equal(quotaRatio(0, q), 0);
  assert.equal(quotaRatio(5, q), 0.5);
  assert.equal(quotaRatio(10, q), 1);
  assert.equal(quotaRatio(40, q), 1, "and never past full");
  assert.equal(minimumMarkerRatio(q), 0.2);
});

check("with no optimal the minimum is the whole ring, and has no notch", () => {
  const q = quota(4, null);
  assert.equal(quotaRatio(2, q), 0.5);
  assert.equal(quotaRatio(4, q), 1);
  assert.equal(minimumMarkerRatio(q), null);
});

check("'left to keep the streak' hits zero at the minimum, not the optimal", () => {
  const q = quota(2, 10);
  assert.equal(remainingToMinimum(0, q), 2);
  assert.equal(remainingToMinimum(2, q), 0);
  assert.equal(remainingToMinimum(9, q), 0, "still zero — the streak is safe");
});

check("logged time floors into minutes rather than rounding up", () => {
  // Rounding up would let a one-minute habit be completed by opening the timer
  // and closing it again.
  assert.equal(minutesFromSeconds(59), 0);
  assert.equal(minutesFromSeconds(60), 1);
  assert.equal(minutesFromSeconds(119), 1);
  assert.equal(minutesFromSeconds(-10), 0);
});

// ---------------------------------------------------------------- corrections

check("a hand-corrected duration is clamped, not rejected", () => {
  assert.equal(clampLoggedSeconds(300), 300);
  // Zero is a legitimate claim: "I left the timer running, this didn't happen".
  assert.equal(clampLoggedSeconds(0), 0);
  assert.equal(clampLoggedSeconds(-60), 0);
  assert.equal(clampLoggedSeconds(MAX_LOGGED_SECONDS + 1), MAX_LOGGED_SECONDS);
  assert.equal(clampLoggedSeconds(Number.NaN), 0);
  assert.equal(clampLoggedSeconds(90.6), 91);
});

check("correcting a session down takes its overtime with it", () => {
  // The case this feature exists for: 17 hours logged against a 5-minute task.
  const target = 300;
  assert.equal(adjustedOvertime("FLOW", 17 * 3600, target), 17 * 3600 - target);
  // LOAD-BEARING: overtime is a subset of elapsed, so a correction that lands
  // under the target must leave none behind. Otherwise /stats reports more
  // time past the goal than was logged at all.
  assert.equal(adjustedOvertime("FLOW", 300, target), 0);
  assert.equal(adjustedOvertime("FLOW", 60, target), 0);
  // Rest has no target to overrun, exactly as in endSession.
  assert.equal(adjustedOvertime("RECOVERY", 9999, 0), 0);
  assert.equal(adjustedOvertime("BASIC", 9999, 0), 0);
});

check("re-crediting follows the clock down when the clock earned it", () => {
  // 40 minutes logged, 40 minutes of progress: all of it came from the timer,
  // so correcting the log to 5 minutes must correct the habit too.
  assert.equal(recreditedProgress(40, 40 * 60, 5 * 60), 5);
  assert.equal(recreditedProgress(40, 40 * 60, 0), 0);
  // And still rises, like crediting does.
  assert.equal(recreditedProgress(5, 5 * 60, 40 * 60), 40);
});

check("re-crediting never takes back a day someone entered by hand", () => {
  // Progress 10 with only 2 minutes ever on the clock: 8 of those minutes were
  // claimed, not measured. Correcting the session cannot revoke the claim.
  assert.equal(recreditedProgress(10, 2 * 60, 0), 10);
  assert.equal(recreditedProgress(10, 2 * 60, 60), 10);
  // Once the clock exceeds the hand-entered floor, the clock wins again.
  assert.equal(recreditedProgress(10, 2 * 60, 30 * 60), 30);
});

// ---------------------------------------------------------------- transitions

check("break time is not logged as work", () => {
  // THE regression this guards. A pomodoro of 25m focus, 40m break, 25m focus
  // has 90 minutes on the wall clock and 50 minutes of work in it.
  const spans = [
    { kind: "FOCUS" as const, seconds: 25 * 60 },
    { kind: "SHORT_BREAK" as const, seconds: 40 * 60 },
    { kind: "FOCUS" as const, seconds: 25 * 60 },
  ];
  assert.equal(loggedElapsedSeconds(90 * 60, spans), 50 * 60);

  // A long break counts the same way; only the label differs.
  assert.equal(
    loggedElapsedSeconds(30 * 60, [{ kind: "LONG_BREAK", seconds: 15 * 60 }]),
    15 * 60,
  );
});

check("a session with no breaks logs exactly what it always did", () => {
  // LOAD-BEARING: this is what keeps every session written before the fix
  // reading the same as it always has. BASIC, FLOW and single-interval
  // pomodoros have no break interval, so subtraction is a no-op.
  assert.equal(loggedElapsedSeconds(1500, [{ kind: "FOCUS", seconds: 1500 }]), 1500);
  assert.equal(loggedElapsedSeconds(1500, []), 1500);
  // Recovery is the session, not a break inside one.
  assert.equal(
    loggedElapsedSeconds(3600, [{ kind: "RECOVERY", seconds: 3600 }]),
    3600,
  );
  assert.equal(isBreakKind("RECOVERY"), false);
  assert.equal(isBreakKind("FOCUS"), false);
  assert.equal(isBreakKind("SHORT_BREAK"), true);
  assert.equal(isBreakKind("LONG_BREAK"), true);
});

check("logged time can never go negative", () => {
  // Breaks are resolved from a different clock than the session, so rounding
  // can in principle put them over. Clamping here rather than trusting the
  // arithmetic, because a negative would flow into habit progress.
  assert.equal(loggedElapsedSeconds(60, [{ kind: "SHORT_BREAK", seconds: 300 }]), 0);
  assert.equal(loggedElapsedSeconds(0, []), 0);
  assert.equal(
    loggedElapsedSeconds(600, [{ kind: "SHORT_BREAK", seconds: -300 }]),
    600,
  );
});

check("an interval knows how far past its own target it has run", () => {
  assert.equal(intervalOverrunSeconds(300, 300), 0);
  assert.equal(intervalOverrunSeconds(2400, 300), 2100);
  assert.equal(intervalOverrunSeconds(120, 300), 0);
  // Recovery has no target, so it can never be overrunning — the same guard
  // every other function in timer-math carries.
  assert.equal(intervalOverrunSeconds(9999, 0), 0);
  assert.equal(intervalOverrunSeconds(9999, -1), 0);
});

const block = (
  id: string,
  startMinute: number,
  endMinute: number,
  extra: Partial<TransitionBlock> = {},
): TransitionBlock => ({
  id,
  title: id,
  startMinute,
  endMinute,
  cueForId: null,
  hasCue: false,
  ...extra,
});

check("a gap between two blocks is a transition with a length", () => {
  const found = transitionsForDay([
    block("a", 540, 600),
    block("b", 612, 672),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].minutes, 12);
  assert.equal(found[0].kind, "ok");
  assert.equal(found[0].beforeTitle, "a");
  assert.equal(found[0].afterTitle, "b");
});

check("two blocks planned flush together are flagged, not ignored", () => {
  // LOAD-BEARING: `mergeSpans` coalesces touching blocks, so the zero-minute
  // switch is invisible to a merged walk — and it is the one most worth
  // saying something about, because every later overrun cascades from it.
  const found = transitionsForDay([block("a", 540, 600), block("b", 600, 660)]);
  assert.equal(found.length, 1);
  assert.equal(found[0].minutes, 0);
  assert.equal(found[0].kind, "none");
});

check("a tight switch is distinguished from a workable one", () => {
  const tight = transitionsForDay([block("a", 540, 600), block("b", 604, 660)]);
  assert.equal(tight[0].kind, "tight");
  // The boundary itself is still tight; one minute past it is not.
  const edge = transitionsForDay([block("a", 540, 600), block("b", 605, 660)]);
  assert.equal(edge[0].kind, "tight");
  const roomy = transitionsForDay([block("a", 540, 600), block("b", 606, 660)]);
  assert.equal(roomy[0].kind, "ok");
});

check("free time is not a transition", () => {
  // Ninety minutes between two things needs no help from the calendar, and
  // drawing a strip across it would make the day look busier than it is.
  assert.deepEqual(
    transitionsForDay([block("a", 540, 600), block("b", 690, 750)]),
    [],
  );
  // Exactly at the ceiling still counts; one minute past it does not.
  assert.equal(
    transitionsForDay([block("a", 540, 600), block("b", 630, 690)]).length,
    1,
  );
  assert.equal(
    transitionsForDay([block("a", 540, 600), block("b", 631, 690)]).length,
    0,
  );
});

check("overlapping blocks produce no phantom transition", () => {
  // A naive pairwise walk reports a gap between the end of the first and the
  // start of the second whenever they overlap. There is no gap there at all.
  assert.deepEqual(
    transitionsForDay([block("a", 540, 620), block("b", 600, 660)]),
    [],
  );
  // And a real gap after an overlapping pair is still found.
  const found = transitionsForDay([
    block("a", 540, 620),
    block("b", 600, 660),
    block("c", 670, 700),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].minutes, 10);
});

check("a habit-stack cue is meant to touch its habit", () => {
  // `cueSpanFor` builds the pair to abut exactly, because "after I pour my tea,
  // I will meditate" only works if nothing comes between them. Warning here
  // would be the calendar objecting to the one deliberate adjacency in the day.
  assert.deepEqual(
    transitionsForDay([
      block("tea", 540, 545, { cueForId: "meditate" }),
      block("meditate", 545, 560, { hasCue: true }),
    ]),
    [],
  );
});

check("one block, or none, has nothing to switch between", () => {
  assert.deepEqual(transitionsForDay([]), []);
  assert.deepEqual(transitionsForDay([block("a", 540, 600)]), []);
});

check("the day's switching time and its tight count roll up", () => {
  const found = transitionsForDay([
    block("a", 540, 600),
    block("b", 612, 660), // 12 min — ok
    block("c", 660, 700), // flush — none
    block("d", 703, 760), // 3 min — tight
  ]);
  assert.equal(transitionMinutes(found), 15);
  assert.equal(tightCount(found), 2);
});

check("dropping a block against its neighbour is reported", () => {
  const day = [block("a", 540, 600), block("b", 700, 760)];
  assert.equal(abutsNeighbour({ startMinute: 600, endMinute: 660 }, day), true);
  assert.equal(abutsNeighbour({ startMinute: 603, endMinute: 660 }, day), true);
  assert.equal(abutsNeighbour({ startMinute: 620, endMinute: 690 }, day), false);
  // Moving a block must not see itself as the neighbour it is crowding.
  assert.equal(
    abutsNeighbour({ startMinute: 540, endMinute: 600 }, day, "a"),
    false,
  );
});

check("a break taken on purpose is not a break that got away", () => {
  // LOAD-BEARING: these look identical on a clock and mean opposite things.
  // Pressing "5 more" raises the target, so the extra lands in `extended`;
  // walking away leaves the target alone, so it lands in `overrun`. Merging
  // them makes the whole panel meaningless.
  const summary = summariseBreaks([
    // Chose five more minutes, then took exactly that.
    { plannedSeconds: 300, targetSeconds: 600, elapsedSeconds: 600, overtimeSeconds: 0 },
    // Planned five, disappeared for forty.
    { plannedSeconds: 300, targetSeconds: 300, elapsedSeconds: 2400, overtimeSeconds: 2100 },
  ]);
  assert.equal(summary.extendedSeconds, 300);
  assert.equal(summary.overrunSeconds, 2100);
  assert.equal(summary.overranCount, 1);
  assert.equal(summary.takenSeconds, 3000);
});

check("the typical break is a median, so one lost afternoon can't define it", () => {
  const rows = [300, 360, 420, 300, 3 * 3600].map((elapsedSeconds) => ({
    plannedSeconds: 300,
    targetSeconds: 300,
    elapsedSeconds,
    overtimeSeconds: Math.max(0, elapsedSeconds - 300),
  }));
  const summary = summariseBreaks(rows);
  // The mean here is over half an hour; the median describes the ordinary day.
  assert.equal(summary.medianTakenSeconds, 360);
  assert.equal(summary.medianPlannedSeconds, 300);
});

check("there is no story in a handful of breaks that behaved", () => {
  assert.equal(summariseBreaks([]).count, 0);
  assert.equal(breaksWorthReporting(summariseBreaks([])), false);

  const honest = Array.from({ length: 5 }, () => ({
    plannedSeconds: 300,
    targetSeconds: 300,
    elapsedSeconds: 310,
    overtimeSeconds: 10,
  }));
  assert.equal(breaksWorthReporting(summariseBreaks(honest)), false);

  const stretched = Array.from({ length: 5 }, () => ({
    plannedSeconds: 300,
    targetSeconds: 300,
    elapsedSeconds: 1140,
    overtimeSeconds: 840,
  }));
  assert.equal(breaksWorthReporting(summariseBreaks(stretched)), true);

  // Two bad breaks is a Tuesday, not a pattern.
  assert.equal(breaksWorthReporting(summariseBreaks(stretched.slice(0, 2))), false);
});

console.log(`\n${passed} checks passed.\n`);
