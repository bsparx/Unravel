"use client";

import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatDateWithWeekday, toISODate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { describeCycle, renewalLabel } from "@/lib/subscriptions";
import type { SubscriptionView } from "@/lib/subscriptions-data";
import { cn } from "@/lib/utils";

import { SubscriptionDialog, type SubscriptionDraft } from "./subscription-dialog";

/**
 * The page body. Three groups, read top to bottom in the order they matter:
 * what renews inside its reminder window, everything else that's active
 * (soonest first), and the cancelled ones folded away at the bottom.
 */
export function SubscriptionList({
  rows,
  todayISO,
  headline,
}: {
  rows: SubscriptionView[];
  todayISO: string;
  headline: string;
}) {
  const [draft, setDraft] = useState<SubscriptionDraft | null>(null);
  const today = new Date(`${todayISO}T00:00:00Z`);

  const soon = rows.filter((row) => row.renewingSoon);
  const later = rows.filter((row) => !row.cancelled && !row.renewingSoon);
  const cancelled = rows.filter((row) => row.cancelled);

  const openNew = () =>
    setDraft({
      name: "",
      amountCents: 0,
      cycle: "MONTHLY",
      nextISO: todayISO,
      anchorISO: todayISO,
      accountEmail: "",
      remindDaysBefore: 7,
      note: "",
      cancelled: false,
    });

  const openEdit = (row: SubscriptionView) =>
    setDraft({
      id: row.id,
      name: row.name,
      amountCents: row.amountCents,
      cycle: row.cycle,
      nextISO: toISODate(row.next),
      anchorISO: toISODate(row.renewsOn),
      accountEmail: row.accountEmail ?? "",
      remindDaysBefore: row.remindDaysBefore,
      note: row.note ?? "",
      cancelled: row.cancelled,
    });

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display">Subscriptions</h1>
          <p className="text-muted-foreground mt-1 max-w-[65ch] text-label">
            {headline}
          </p>
        </div>
        <Button onClick={openNew} className="active:scale-[0.98]">
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No subscriptions yet"
          description="Add what you pay for on a cycle. Your Day page will warn you before each one renews."
          action={
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4" aria-hidden />
              Add a subscription
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {soon.length > 0 && (
            <section
              aria-labelledby="renewing-soon"
              className="border-border border-l-destructive bg-card rounded-lg border border-l-4"
            >
              <h2
                id="renewing-soon"
                className="text-title text-destructive flex items-center gap-2 border-b px-4 py-3"
              >
                <CalendarClock className="size-4" aria-hidden />
                Renewing soon
              </h2>
              <ul className="divide-y">
                {soon.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    when={renewalLabel(row.next, today)}
                    urgent={row.daysUntil <= 1}
                    onEdit={openEdit}
                  />
                ))}
              </ul>
            </section>
          )}

          {later.length > 0 && (
            <section
              aria-labelledby="active-subs"
              className="border-border bg-card rounded-lg border"
            >
              <h2 id="active-subs" className="text-title border-b px-4 py-3">
                {soon.length > 0 ? "Later" : "Active"}
              </h2>
              <ul className="divide-y">
                {later.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    when={formatDateWithWeekday(row.next)}
                    onEdit={openEdit}
                  />
                ))}
              </ul>
            </section>
          )}

          {cancelled.length > 0 && (
            <details className="group border-border rounded-lg border">
              <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-3 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none">
                Cancelled ({cancelled.length})
              </summary>
              <ul className="divide-y border-t">
                {cancelled.map((row) => (
                  <Row key={row.id} row={row} when="Cancelled" onEdit={openEdit} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {draft && (
        <SubscriptionDialog
          key={draft.id ?? "new"}
          draft={draft}
          onClose={() => setDraft(null)}
        />
      )}
    </>
  );
}

function Row({
  row,
  when,
  urgent = false,
  onEdit,
}: {
  row: SubscriptionView;
  /** The right-hand date line: relative when soon, a date otherwise. */
  when: string;
  urgent?: boolean;
  onEdit: (row: SubscriptionView) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onEdit(row)}
        className="hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center gap-4 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "text-title block truncate",
              row.cancelled && "text-muted-foreground line-through",
            )}
          >
            {row.name}
          </span>
          <span className="text-muted-foreground block truncate text-micro">
            {row.accountEmail ?? "No account email"}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block font-mono text-title tabular-nums",
              row.cancelled && "text-muted-foreground line-through",
            )}
          >
            {formatMoney(row.amountCents)}
          </span>
          <span
            className={cn(
              "block text-micro",
              urgent ? "text-destructive font-medium" : "text-muted-foreground",
            )}
          >
            {row.cancelled ? when : `${describeCycle(row.cycle)} · ${when}`}
          </span>
        </span>
      </button>
    </li>
  );
}
