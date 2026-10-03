import { hueStyle } from "@/components/identity-sigil";
import { formatMinuteLength } from "@/lib/block-math";
import { shortName } from "@/lib/identity-look";
import type { CalendarBlock } from "@/lib/time-blocks";
import { cn } from "@/lib/utils";

type Row = { key: string; label: string; minutes: number; slot?: number; tone?: "rest" | "buffer" | "other" };

/**
 * Where the week goes: planned time by the self it's for, with recovery and
 * buffer kept visible beside the work. A plan, not a log — the stats page is
 * where actual sessions live. Plain markup, so it costs nothing to hydrate.
 */
export function WeekInsights({
  blocks,
  identities,
  rangeLabel,
}: {
  blocks: CalendarBlock[];
  identities: { id: string; name: string; colorSlot: number }[];
  rangeLabel: string;
}) {
  const byIdentity = new Map<string, number>();
  let other = 0;
  let rest = 0;
  let buffer = 0;
  for (const block of blocks) {
    const minutes = block.endMinute - block.startMinute;
    if (block.kind === "DAYDREAM") continue;
    if (block.kind === "RECOVERY") rest += minutes;
    else if (block.kind === "BUFFER") buffer += minutes;
    else if (block.identity) byIdentity.set(block.identity.id, (byIdentity.get(block.identity.id) ?? 0) + minutes);
    else other += minutes;
  }

  const rows: Row[] = [
    ...identities.map((identity) => ({
      key: identity.id,
      label: shortName(identity.name),
      minutes: byIdentity.get(identity.id) ?? 0,
      slot: identity.colorSlot,
    })),
    { key: "other", label: "Other work", minutes: other, tone: "other" as const },
    { key: "rest", label: "Recovery", minutes: rest, tone: "rest" as const },
    { key: "buffer", label: "Buffer", minutes: buffer, tone: "buffer" as const },
  ];
  const total = rows.reduce((sum, row) => sum + row.minutes, 0);
  if (total === 0) return null;
  const shown = rows.filter((row) => row.minutes > 0);
  const share = (minutes: number) => Math.round((minutes / total) * 100);

  const fill = (row: Row) =>
    row.tone === "rest"
      ? "bg-rest"
      : row.tone === "buffer"
        ? "border border-dashed border-muted-foreground"
        : row.tone === "other"
          ? "bg-arc-tick"
          : "bg-[var(--hue)]";

  return (
    <section aria-labelledby="week-insights-title" className="border-border bg-card mt-6 rounded-[20px] border p-5 sm:p-6">
      <h2 id="week-insights-title" className="font-heading text-lg font-semibold">
        Where the week goes
      </h2>
      <p className="text-muted-foreground text-label">
        {formatMinuteLength(total)} planned for {rangeLabel}, with {formatMinuteLength(rest)} of recovery
      </p>

      <div className="mt-4 flex h-6 gap-0.5" aria-hidden>
        {shown.map((row, index) => (
          <div
            key={row.key}
            style={{ ...(row.slot ? hueStyle(row.slot) : {}), flex: `${row.minutes} 1 0` }}
            className={cn("min-w-1", fill(row), index === shown.length - 1 && "rounded-r")}
            title={`${row.label}: ${formatMinuteLength(row.minutes)}`}
          />
        ))}
      </div>

      <ul className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-2 text-label">
        {rows.map((row) => (
          <li key={row.key} style={row.slot ? hueStyle(row.slot) : undefined} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-3 rounded-[3px]", fill(row))} />
            {row.label}
            <strong className="text-foreground font-semibold tabular-nums">
              {formatMinuteLength(row.minutes)}
              <span className="text-muted-foreground font-normal"> ({share(row.minutes)}%)</span>
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
