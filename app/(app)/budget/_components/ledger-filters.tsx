"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_COLORS } from "@/lib/money-palette";

import { useLedgerNav } from "./ledger-shell";
import {
  DEFAULT_QUERY,
  isoDay,
  ledgerPath,
  ledgerSearch,
  MAX_SEARCH,
  PAGE_SIZE,
  RANGE_PRESETS,
  SORTS,
  type LedgerKind,
  type LedgerQuery,
  type RangePreset,
  type Span,
} from "../_lib/ledger";
import type { AccountOption, BudgetCategory } from "../_lib/queries";

/** The query with `patch` applied, back on page one: a new slice starts at its top. */
function useApply(kind: LedgerKind, query: LedgerQuery) {
  const nav = useLedgerNav();
  return (patch: Partial<LedgerQuery>) =>
    nav?.go(ledgerPath(kind) + ledgerSearch({ ...query, limit: PAGE_SIZE, ...patch }));
}

/**
 * One row of filters above everything they narrow: when, which category,
 * which account, and a word from the note. Each change is a new URL, so a
 * slice can be bookmarked or shared, and Back walks through them.
 */
export function LedgerFilters({
  kind,
  query,
  span,
  categories,
  accounts,
}: {
  kind: LedgerKind;
  query: LedgerQuery;
  /** The days on show, so "Pick dates" starts from them. */
  span: Span | null;
  categories: BudgetCategory[];
  accounts: AccountOption[];
}) {
  const apply = useApply(kind, query);
  const [text, setText] = useState(query.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The search waits for a pause in typing. It reads the query as it is by
  // then, not as it was at the first keystroke.
  const latest = useRef({ query, apply });
  useEffect(() => {
    latest.current = { query, apply };
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value.trim().slice(0, MAX_SEARCH);
      if (q !== latest.current.query.q) latest.current.apply({ q });
    }, 350);
  };

  const pickRange = (range: RangePreset) => {
    if (range === "custom") {
      apply({ range, from: span?.from ?? null, to: span?.to ?? null });
    } else {
      apply({ range, from: null, to: null });
    }
  };

  const pickDate = (side: "from" | "to", value: string) => {
    const day = isoDay(value);
    if (!day) return;
    const from = side === "from" ? day : (query.from ?? day);
    const to = side === "to" ? day : (query.to ?? day);
    apply({ range: "custom", from: from <= to ? from : to, to: from <= to ? to : from });
  };

  const liveAccounts = accounts.filter((account) => !account.archived || account.id === query.accountId);
  const filtered =
    query.range !== DEFAULT_QUERY.range || query.categoryId !== null || query.accountId !== null || query.q !== "";
  const noun = kind === "INCOME" ? "income" : "expenses";

  return (
    <div role="search" aria-label={`Filter ${noun}`} className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <div className="relative col-span-2 sm:w-64">
        <Search aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={text}
          onChange={(event) => search(event.target.value)}
          maxLength={MAX_SEARCH}
          placeholder="Search entries"
          aria-label={`Search ${noun}`}
          className="min-h-11 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            onClick={() => search("")}
            aria-label="Clear the search"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <Select value={query.range} onValueChange={(value) => pickRange(value as RangePreset)}>
        <SelectTrigger aria-label="Dates" className="text-label w-full sm:w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={query.categoryId ?? "all"}
        onValueChange={(value) => apply({ categoryId: value === "all" ? null : value })}
      >
        <SelectTrigger aria-label="Category" className="text-label w-full sm:w-auto sm:max-w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[category.color] ?? "var(--muted-foreground)" }}
              />
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {liveAccounts.length > 1 && (
        <Select
          value={query.accountId ?? "all"}
          onValueChange={(value) => apply({ accountId: value === "all" ? null : value })}
        >
          <SelectTrigger aria-label="Account" className="text-label w-full sm:w-auto sm:max-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {liveAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {query.range === "custom" && (
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Input
            type="date"
            aria-label="From"
            value={query.from ?? ""}
            onChange={(event) => pickDate("from", event.target.value)}
            className="min-h-11 sm:w-40"
          />
          <Input
            type="date"
            aria-label="To"
            value={query.to ?? ""}
            onChange={(event) => pickDate("to", event.target.value)}
            className="min-h-11 sm:w-40"
          />
        </div>
      )}

      {filtered && (
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground col-span-2 justify-self-start"
          onClick={() => {
            clearTimeout(timer.current);
            setText("");
            apply({ ...DEFAULT_QUERY, sort: query.sort });
          }}
        >
          <X className="size-4" aria-hidden />
          Clear filters
        </Button>
      )}
    </div>
  );
}

/** How the rows are ordered. Sits on the list, the one thing it changes. */
export function SortSelect({ kind, query }: { kind: LedgerKind; query: LedgerQuery }) {
  const apply = useApply(kind, query);
  return (
    <Select value={query.sort} onValueChange={(value) => apply({ sort: value as LedgerQuery["sort"] })}>
      <SelectTrigger aria-label="Order" className="min-h-9 py-1 text-label">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SORTS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The next page of rows, without losing the place. */
export function ShowMore({ kind, query, shown }: { kind: LedgerKind; query: LedgerQuery; shown: number }) {
  const nav = useLedgerNav();
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={nav?.pending}
      onClick={() => nav?.go(ledgerPath(kind) + ledgerSearch({ ...query, limit: shown + PAGE_SIZE }))}
    >
      Show {PAGE_SIZE} more
    </Button>
  );
}
