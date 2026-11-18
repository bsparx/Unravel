import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { firstLine, pageGroups, type PracticeItem } from "@/lib/practices";

/**
 * A day's gratitude, kept the way it was written: under a string of lit
 * lanterns, one for each good thing, on the warm dusk of the ritual's last
 * sky. The things themselves are the large type; a second answer (the why,
 * the senses) sits under its thing, smaller, so the page reads in one pass.
 */
export function GratitudePage({
  dateLabel,
  templateName,
  items,
  className,
}: {
  dateLabel?: string;
  templateName: string;
  items: readonly PracticeItem[];
  className?: string;
}) {
  const groups = pageGroups(items);

  return (
    <figure
      className={cn(
        "thanks-sky-lit relative overflow-hidden rounded-2xl px-6 pb-8 text-[var(--woop-ink)] ring-1 ring-[var(--woop-glass-edge)] shadow-[0_24px_48px_-28px_rgba(90,40,30,0.5)] sm:px-9",
        className,
      )}
    >
      {/* Room on the right for the card's tools, which are always shown on
          a phone and only on hover from md up. */}
      <LanternString count={groups.length} className="-mx-2 mr-14 md:mr-0" />

      <header className="mt-4 mb-6">
        {dateLabel && <p className="font-display text-2xl leading-tight">{dateLabel}</p>}
        <p className={cn("text-[var(--woop-ink-muted)]", dateLabel ? "mt-1 text-micro" : "text-label")}>{templateName}</p>
      </header>

      <ol className="space-y-6">
        {groups.map((group, index) => (
          <li key={`${group.step}-${index}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
            <span
              aria-hidden
              className="font-display pt-0.5 text-lg leading-7 text-[var(--thanks-accent)] tabular-nums"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              {!group.numbered && (
                <p className="mb-1 text-micro font-medium text-[var(--woop-ink-muted)]">{group.step}</p>
              )}
              {group.lines.map((line, lineIndex) =>
                lineIndex === 0 ? (
                  <p
                    key={line.key}
                    className="font-display text-xl leading-snug break-words whitespace-pre-line sm:text-[1.375rem]"
                  >
                    {line.text}
                  </p>
                ) : (
                  <div key={line.key} className="mt-2.5">
                    <p className="text-micro font-medium text-[var(--woop-ink)] opacity-80">{line.label}</p>
                    <p className="text-label break-words whitespace-pre-line text-[var(--woop-ink-muted)]">{line.text}</p>
                  </div>
                ),
              )}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/**
 * The lanterns on their cord. Each hangs from the point where the sagging
 * cord passes over it, and they kindle one after another.
 */
function LanternString({ count, className }: { count: number; className?: string }) {
  const n = Math.max(count, 1);
  return (
    <div aria-hidden className={cn("relative h-[3.75rem]", className)}>
      <span className="lantern-cord absolute inset-x-0 top-0 h-7" />
      {Array.from({ length: n }, (_, i) => {
        const x = (i + 1) / (n + 1);
        // Where the half ellipse's bottom edge sits at x, as a share of its height.
        const drop = Math.sqrt(1 - (2 * x - 1) ** 2);
        return (
          <span
            key={i}
            data-lit="true"
            className="thanks-lantern absolute -ml-[0.525rem] h-6 w-[1.05rem]"
            style={{
              left: `${x * 100}%`,
              top: `calc(${drop.toFixed(3)} * 1.75rem + 3px)`,
              animationDelay: `${i * 140}ms, ${700 + i * 140}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * A past evening, folded: the date, its lanterns, and the first good thing.
 * The panel opens the whole page under it.
 */
export function GratitudeEvening({
  dateLabel,
  items,
  expanded,
  onToggle,
}: {
  dateLabel: string;
  items: readonly PracticeItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const count = pageGroups(items).length;
  const preview = firstLine(items);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        "group/evening border-border/70 focus-visible:ring-ring grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-2xl border px-4 py-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.995] sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:px-5",
        expanded ? "bg-card" : "bg-card/40 hover:bg-card/80",
      )}
    >
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="font-display text-body leading-tight">{dateLabel}</span>
        <span className="flex items-end gap-1.5" aria-label={`${count} ${count === 1 ? "good thing" : "good things"}`}>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} data-lit="true" data-still className="thanks-lantern h-3 w-2" />
          ))}
        </span>
      </span>
      <span className="text-muted-foreground col-start-1 row-start-2 mt-2 line-clamp-2 text-label sm:col-start-2 sm:row-start-1 sm:mt-0 sm:line-clamp-1">
        {preview}
      </span>
      <ChevronDown
        aria-hidden
        className={cn(
          "text-muted-foreground group-hover/evening:text-foreground col-start-2 row-start-1 size-4 transition-transform duration-200 sm:col-start-3",
          expanded && "rotate-180",
        )}
      />
    </button>
  );
}
