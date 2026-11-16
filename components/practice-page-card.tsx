import { cn } from "@/lib/utils";
import { groupItems, type PracticeItem, type PracticeKind } from "@/lib/practices";

import { WashiTape } from "./journal-ornaments";

/**
 * One day's gratitude or du'a page, written down: a sheet of the journal's
 * paper, taped in.
 *
 * Numbered steps ("Good thing 3", "Du'a 2") read as a numbered list in the
 * margin; named steps (Hamd, Someone, The letter) get their name as a small
 * heading, so a page reads the way it was written. A step with two answers
 * (what went well, and why) shows the second under its own small label.
 */
export function PracticePageCard({
  kind,
  dateLabel,
  templateName,
  items,
  compact = false,
  className,
}: {
  kind: PracticeKind;
  dateLabel?: string;
  templateName: string;
  items: readonly PracticeItem[];
  compact?: boolean;
  className?: string;
}) {
  // Numbered steps count up on their own; named steps don't take a number.
  const groups = groupItems(items).map((group, index, all) => {
    const isNumbered = /\d+$/.test(group.step) || !group.step;
    const number = all
      .slice(0, index + 1)
      .filter((g) => /\d+$/.test(g.step) || !g.step).length;
    return { ...group, isNumbered, number };
  });

  return (
    <figure
      className={cn(
        "border-paper-edge bg-paper text-paper-ink relative rounded-md border shadow-[0_18px_40px_-18px_rgba(20,14,6,0.55),0_2px_0_rgba(0,0,0,0.04)]",
        compact ? "px-4 pt-5 pb-4" : "px-5 pt-7 pb-6 sm:px-7",
        className,
      )}
    >
      <WashiTape
        className={cn("absolute -top-2.5 left-1/2 -translate-x-1/2", compact ? "w-16" : "w-24")}
        rotate={kind === "dua" ? "1.5deg" : "-2deg"}
      />

      {/* The ornament in the corner: a lit lantern, or the crescent. */}
      {kind === "gratitude" ? (
        <span
          aria-hidden
          data-lit="true"
          className={cn("thanks-lantern absolute", compact ? "right-4 bottom-4 h-4 w-3" : "right-6 bottom-6 h-6 w-[1.05rem]")}
        />
      ) : (
        <span
          aria-hidden
          className={cn("dua-crescent absolute size-[1em] opacity-80", compact ? "right-4 bottom-3 text-xl" : "right-6 bottom-5 text-3xl")}
        />
      )}

      <header className={cn("pr-20", compact ? "mb-2" : "mb-4")}>
        {dateLabel && (
          <p className={cn("font-display text-paper-ink", compact ? "text-base" : "text-xl")}>{dateLabel}</p>
        )}
        <p className="text-paper-ink-muted text-micro font-medium tracking-wider uppercase">{templateName}</p>
      </header>

      <ol className={cn(compact ? "space-y-1.5 pr-6" : "space-y-3 pr-7")}>
        {groups.map((group, index) => {
          const { isNumbered } = group;
          return (
            <li key={`${group.step}-${index}`} className={cn("relative", isNumbered && (compact ? "pl-6" : "pl-8"))}>
              {isNumbered ? (
                <span
                  aria-hidden
                  className={cn(
                    "font-display text-paper-ink-muted absolute top-0.5 left-0 tabular-nums",
                    compact ? "text-sm" : "text-lg",
                  )}
                >
                  {group.number}.
                </span>
              ) : (
                <p className="text-paper-ink-muted text-micro mb-0.5 font-medium tracking-wider uppercase">
                  {group.step}
                </p>
              )}
              {group.lines.map((line, lineIndex) => (
                <div key={line.key}>
                  {lineIndex > 0 && (
                    <p className="text-paper-ink-muted text-micro mt-1 italic">{line.label}</p>
                  )}
                  <p
                    className={cn(
                      "font-hand border-paper-rule/60 border-b leading-snug break-words whitespace-pre-line",
                      compact ? "line-clamp-3 text-lg" : "text-xl sm:text-2xl",
                    )}
                  >
                    {line.text}
                  </p>
                </div>
              ))}
            </li>
          );
        })}
      </ol>

      {kind === "dua" && !compact && (
        <figcaption className="font-display text-paper-ink-muted mt-5 pr-10 text-right text-base italic">Ameen.</figcaption>
      )}
    </figure>
  );
}
