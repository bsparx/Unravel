"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/dates";

/**
 * The day log half of a habit's journal: every day the habit carried time or
 * a note, newest first, each with its date as an eyebrow and its time on the
 * clock beside it. The search box narrows the list in place — a log you have
 * to page through to find one line is a log you won't re-read.
 */
export function NoteLog({
  entries,
}: {
  entries: {
    dateISO: string;
    dateLabel: string;
    note: string | null;
    loggedSeconds: number;
  }[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return entries;
    return entries.filter(
      (entry) =>
        entry.dateLabel.toLowerCase().includes(needle) ||
        (entry.note ?? "").toLowerCase().includes(needle),
    );
  }, [entries, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the log…"
          aria-label="Search this habit's log"
          className="h-10 pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border-border space-y-2 rounded-lg border border-dashed py-10 text-center">
          <p className="text-muted-foreground text-label">
            Nothing matches &ldquo;{query}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-primary hover:underline text-label transition-colors"
          >
            Show the whole log
          </button>
        </div>
      ) : (
        <>
          <ul className="border-border divide-y divide-border rounded-lg border">
            {filtered.map((entry) => (
              <li key={entry.dateISO} className="bg-card px-4 py-3">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
                    {entry.dateLabel}
                  </p>
                  {entry.loggedSeconds > 0 && (
                    <p className="text-running text-micro tabular-nums">
                      {formatDuration(entry.loggedSeconds)} logged
                    </p>
                  )}
                </div>
                {entry.note && (
                  <p className="text-body whitespace-pre-wrap">{entry.note}</p>
                )}
              </li>
            ))}
          </ul>
          {query.trim() !== "" && (
            <p className="text-muted-foreground text-micro text-right tabular-nums">
              {filtered.length} of {entries.length}
            </p>
          )}
        </>
      )}
    </div>
  );
}
