/**
 * The income and expense pages' query: which slice of the ledger to show,
 * read from the URL and written back to it.
 *
 * Pure (no Prisma, no server-only), so the server page and the client filter
 * bar agree on every default, and the logic check can run it. Days are ISO
 * strings ("2026-11-19") throughout, the house rule's UTC-midnight local days
 * in their plainest form.
 */

import type { CategoryColor } from "@/lib/money-palette";

export type LedgerKind = "INCOME" | "EXPENSE";

export const RANGE_PRESETS = [
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Pick dates" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "largest", label: "Largest first" },
  { value: "smallest", label: "Smallest first" },
] as const;

export type LedgerSort = (typeof SORTS)[number]["value"];

/** Rows per "Show more". */
export const PAGE_SIZE = 50;
/** The most rows one page will render. */
export const MAX_ROWS = 500;
/** Longest search the box accepts. */
export const MAX_SEARCH = 80;

export type LedgerQuery = {
  range: RangePreset;
  /** Custom bounds, inclusive. Set only when `range` is "custom". */
  from: string | null;
  to: string | null;
  categoryId: string | null;
  accountId: string | null;
  /** Matched against the note and the category name. */
  q: string;
  sort: LedgerSort;
  /** How many rows to show. */
  limit: number;
};

export const DEFAULT_QUERY: LedgerQuery = {
  range: "month",
  from: null,
  to: null,
  categoryId: null,
  accountId: null,
  q: "",
  sort: "newest",
  limit: PAGE_SIZE,
};

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** A real calendar day as YYYY-MM-DD, or null. Rejects 2026-02-31. */
export function isoDay(value: string | undefined | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

/** Ids are cuids. Anything else is noise, not a filter. */
const id = (value: string | undefined) => (value && /^[a-z0-9]{8,40}$/i.test(value) ? value : null);

/** Anything malformed falls back to its default rather than erroring. */
export function parseLedgerQuery(params: Params): LedgerQuery {
  const rangeRaw = one(params.range);
  let range: RangePreset = RANGE_PRESETS.some((preset) => preset.value === rangeRaw)
    ? (rangeRaw as RangePreset)
    : "month";

  let from = isoDay(one(params.from));
  let to = isoDay(one(params.to));
  // Either bound on its own means that one day; both, in either order, a span.
  if (from || to) {
    range = "custom";
    from ??= to;
    to ??= from;
    if (from! > to!) [from, to] = [to, from];
  } else if (range === "custom") {
    range = "month";
  }

  const sortRaw = one(params.sort);
  const sort = SORTS.some((option) => option.value === sortRaw) ? (sortRaw as LedgerSort) : "newest";

  const n = Number(one(params.n));
  const limit = Number.isInteger(n)
    ? Math.min(MAX_ROWS, Math.max(PAGE_SIZE, Math.ceil(n / PAGE_SIZE) * PAGE_SIZE))
    : PAGE_SIZE;

  return {
    range,
    from: range === "custom" ? from : null,
    to: range === "custom" ? to : null,
    categoryId: id(one(params.cat)),
    accountId: id(one(params.acct)),
    q: (one(params.q) ?? "").trim().slice(0, MAX_SEARCH),
    sort,
    limit,
  };
}

/** The query as a URL search string, defaults left out. "" when nothing is set. */
export function ledgerSearch(query: LedgerQuery): string {
  const params = new URLSearchParams();
  if (query.range === "custom" && query.from && query.to) {
    params.set("from", query.from);
    params.set("to", query.to);
  } else if (query.range !== "month" && query.range !== "custom") {
    params.set("range", query.range);
  }
  if (query.categoryId) params.set("cat", query.categoryId);
  if (query.accountId) params.set("acct", query.accountId);
  if (query.q) params.set("q", query.q);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.limit > PAGE_SIZE) params.set("n", String(query.limit));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function ledgerPath(kind: LedgerKind): string {
  return kind === "INCOME" ? "/budget/income" : "/budget/expenses";
}

/**
 * The ledger page for one calendar month: the default view for the current
 * month, a custom span for any other. What the overview links to.
 */
export function monthLedgerHref(
  kind: LedgerKind,
  monthISO: string,
  todayISO: string,
  categoryId?: string,
): string {
  const start = `${monthISO.slice(0, 7)}-01`;
  const current = start === `${todayISO.slice(0, 7)}-01`;
  return (
    ledgerPath(kind) +
    ledgerSearch({
      ...DEFAULT_QUERY,
      range: current ? "month" : "custom",
      from: current ? null : start,
      to: current ? null : endOfMonth(start),
      categoryId: categoryId ?? null,
    })
  );
}

// ---------------------------------------------------------------- calendar

const DAY_MS = 86_400_000;

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const toISO = (date: Date) => date.toISOString().slice(0, 10);

export function addDaysISO(iso: string, days: number): string {
  return toISO(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** Days from `from` to `to`, counting both. */
export function spanDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS) + 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** The first of `iso`'s month, `months` later (or earlier). */
export function monthStartISO(iso: string, months = 0): string {
  const date = toDate(iso);
  return toISO(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)));
}

export function endOfMonth(iso: string): string {
  const date = toDate(iso);
  return toISO(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

/** The same day `months` away, pulled back to the month's end if it has no such day. */
export function shiftMonthsISO(iso: string, months: number): string {
  const date = toDate(iso);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const target = new Date(Date.UTC(year, month, 1));
  const day = Math.min(date.getUTCDate(), daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  return toISO(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day)));
}

/** How many calendar months a preset covers, counting this one. */
const PRESET_MONTHS: Partial<Record<RangePreset, number>> = {
  month: 1,
  "last-month": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

export type Span = { from: string; to: string };

/**
 * The days a query covers, both ends inclusive. Month presets cover whole
 * calendar months, this one included to its last day, so an entry logged
 * ahead (the rent on the 30th) is in "this month". "All time" is open: null,
 * for the caller to close with the first and last day it actually has.
 */
export function resolveSpan(query: LedgerQuery, todayISO: string): Span | null {
  if (query.range === "all") return null;
  if (query.range === "custom" && query.from && query.to) return { from: query.from, to: query.to };
  if (query.range === "year") {
    const year = todayISO.slice(0, 4);
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  if (query.range === "last-month") {
    const from = monthStartISO(todayISO, -1);
    return { from, to: endOfMonth(from) };
  }
  const months = PRESET_MONTHS[query.range] ?? 1;
  return { from: monthStartISO(todayISO, 1 - months), to: endOfMonth(todayISO) };
}

/**
 * What to hold the span against: the same stretch, one period earlier. A span
 * still running is cut at today first, so the first nineteen days of November
 * meet the first nineteen of October rather than all of it. Null for all time,
 * or for a span that hasn't started.
 */
export function previousSpan(query: LedgerQuery, span: Span, todayISO: string): Span | null {
  if (query.range === "all" || span.from > todayISO) return null;
  const to = span.to > todayISO ? todayISO : span.to;
  const months =
    query.range === "year" ? 12 : query.range === "custom" ? null : (PRESET_MONTHS[query.range] ?? 1);
  if (months === null) {
    const length = spanDays(span.from, to);
    return { from: addDaysISO(span.from, -length), to: addDaysISO(span.from, -1) };
  }
  return { from: shiftMonthsISO(span.from, -months), to: shiftMonthsISO(to, -months) };
}

// ---------------------------------------------------------------- labels

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
const DAY_MONTH = formatter({ day: "numeric", month: "short" });
const DAY_MONTH_YEAR = formatter({ day: "numeric", month: "short", year: "numeric" });
const WEEKDAY_DAY_MONTH = formatter({ weekday: "short", day: "numeric", month: "short" });
const MONTH_SHORT = formatter({ month: "short" });
const MONTH_LONG = formatter({ month: "long" });
const MONTH_YEAR = formatter({ month: "short", year: "numeric" });
const MONTH_LONG_YEAR = formatter({ month: "long", year: "numeric" });

const isMonthStart = (iso: string) => iso.endsWith("-01");
const isMonthEnd = (iso: string) => endOfMonth(iso) === iso;

/**
 * A span in words: "November 2026", "Sep – Nov 2026", "1 – 19 Nov",
 * "15 Sep – 19 Nov 2025". The year is left off when it's this year.
 */
export function formatSpan(span: Span, todayISO: string): string {
  const { from, to } = span;
  const thisYear = todayISO.slice(0, 4);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const tail = sameYear && from.slice(0, 4) === thisYear ? "" : ` ${to.slice(0, 4)}`;

  if (isMonthStart(from) && isMonthEnd(to)) {
    if (from.slice(5, 7) === "01" && to.slice(5, 7) === "12" && sameYear) return from.slice(0, 4);
    if (sameMonth) return `${MONTH_LONG.format(toDate(from))}${tail}`;
    return sameYear
      ? `${MONTH_SHORT.format(toDate(from))} – ${MONTH_SHORT.format(toDate(to))}${tail}`
      : `${MONTH_YEAR.format(toDate(from))} – ${MONTH_YEAR.format(toDate(to))}`;
  }
  if (from === to) return tail ? DAY_MONTH_YEAR.format(toDate(from)) : DAY_MONTH.format(toDate(from));
  if (sameMonth) return `${Number(from.slice(8))} – ${DAY_MONTH.format(toDate(to))}${tail}`;
  return sameYear
    ? `${DAY_MONTH.format(toDate(from))} – ${DAY_MONTH.format(toDate(to))}${tail}`
    : `${DAY_MONTH_YEAR.format(toDate(from))} – ${DAY_MONTH_YEAR.format(toDate(to))}`;
}

export function formatMonthLong(iso: string): string {
  return MONTH_LONG_YEAR.format(toDate(iso));
}

// ---------------------------------------------------------------- buckets

export type BucketUnit = "day" | "week" | "month";

export type Bucket = {
  /** First day of the bucket. */
  start: string;
  /** Last day of the bucket, inclusive. */
  end: string;
  /** Under the bar: "19", "3 Nov", "Nov". */
  tick: string;
  /** In the tooltip: "Thu 19 Nov", "3 – 9 Nov", "November 2026". */
  label: string;
};

/** Day bars up to about six weeks, week bars up to about four months, then months. */
export function bucketUnit(span: Span): BucketUnit {
  const days = spanDays(span.from, span.to);
  return days <= 45 ? "day" : days <= 125 ? "week" : "month";
}

/** The span cut into bars, oldest first. Weeks run from the span's first day. */
export function makeBuckets(span: Span, unit: BucketUnit): Bucket[] {
  const buckets: Bucket[] = [];
  const oneMonth = span.from.slice(0, 7) === span.to.slice(0, 7);
  const manyYears = span.from.slice(0, 4) !== span.to.slice(0, 4);

  if (unit === "month") {
    for (let start = monthStartISO(span.from); start <= span.to; start = monthStartISO(start, 1)) {
      const date = toDate(start);
      buckets.push({
        start,
        end: endOfMonth(start),
        tick: manyYears ? MONTH_YEAR.format(date) : MONTH_SHORT.format(date),
        label: MONTH_LONG_YEAR.format(date),
      });
    }
    return buckets;
  }

  const step = unit === "day" ? 1 : 7;
  for (let start = span.from; start <= span.to; start = addDaysISO(start, step)) {
    const last = addDaysISO(start, step - 1);
    const end = last > span.to ? span.to : last;
    const date = toDate(start);
    buckets.push({
      start,
      end,
      tick: unit === "day" && oneMonth ? String(date.getUTCDate()) : DAY_MONTH.format(date),
      label:
        unit === "day"
          ? WEEKDAY_DAY_MONTH.format(date)
          : start === end
            ? DAY_MONTH.format(date)
            : formatSpan({ from: start, to: end }, `${span.to.slice(0, 4)}-01-01`),
    });
  }
  return buckets;
}

/** Which bucket a day falls in, or -1 outside the span. */
export function bucketIndex(buckets: Bucket[], iso: string): number {
  if (buckets.length === 0 || iso < buckets[0].start || iso > buckets[buckets.length - 1].end) return -1;
  // Buckets are contiguous and sorted, so a binary search would do; a few
  // hundred at most makes the plain scan the clearer choice.
  return buckets.findIndex((bucket) => iso >= bucket.start && iso <= bucket.end);
}

// ---------------------------------------------------------------- categories

export type CategoryBar = {
  id: string;
  name: string;
  /** The category's own colour, for the dot beside its name. Null for "Everything else". */
  color: CategoryColor | null;
  cents: number;
  /** Where a tap goes: the entries in this category. */
  href: string;
};

/**
 * The biggest few by name, the tail folded into one "Everything else" bar,
 * so the chart never asks the eye to sort through a dozen slivers.
 */
export function foldCategories<
  T extends { category: { id: string; name: string; color: CategoryColor }; totalCents: number },
>(
  rows: T[],
  keep: number,
  hrefFor: (categoryId: string | null) => string,
): CategoryBar[] {
  const sorted = [...rows].filter((row) => row.totalCents > 0).sort((a, b) => b.totalCents - a.totalCents);
  const named = sorted.slice(0, sorted.length > keep + 1 ? keep : keep + 1);
  const rest = sorted.slice(named.length).reduce((sum, row) => sum + row.totalCents, 0);
  return [
    ...named.map((row) => ({
      id: row.category.id,
      name: row.category.name,
      color: row.category.color,
      cents: row.totalCents,
      href: hrefFor(row.category.id),
    })),
    ...(rest > 0 ? [{ id: "rest", name: "Everything else", color: null, cents: rest, href: hrefFor(null) }] : []),
  ];
}
