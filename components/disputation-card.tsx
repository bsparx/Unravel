import { ArrowDown, ArrowRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DISPUTE_LENSES,
  beliefShift,
  type DisputationFields,
} from "@/lib/disputation";

/**
 * A disputation, kept as the turn it made: the storm on one side, with the
 * belief struck through because it was answered, and the cleared sky on the
 * other, with what you carry out of it instead. Side by side when the card
 * is wide enough (a container query, so the ritual's narrow review stacks
 * too), storm over clear otherwise.
 *
 * Opened, the rest of the weather runs down a line underneath: what
 * happened, what the belief did, and the argument back, lens by lens.
 */
export function DisputationTurn({
  entry,
  dateLabel,
  expanded = true,
  onToggle,
  toolRoom = false,
  className,
}: {
  entry: DisputationFields;
  dateLabel?: string;
  /** Show the argument (A, C and the lenses), not only the turn. */
  expanded?: boolean;
  /** With this, the card carries its own "Show the argument" switch. */
  onToggle?: () => void;
  /** Keep the corner clear for the card's tools, pinned top-right on the board. */
  toolRoom?: boolean;
  className?: string;
}) {
  const lenses = DISPUTE_LENSES.filter((lens) => entry[lens.key].trim());
  const rated = entry.beliefBefore !== null || entry.beliefAfter !== null;
  const steps = [
    { key: "adversity", name: "What happened", text: entry.adversity, colour: "var(--abcde-adversity)" },
    { key: "consequences", name: "What it did", text: entry.consequences, colour: "var(--abcde-consequences)" },
    ...lenses.map((lens) => ({
      key: lens.key,
      name: lens.name,
      text: entry[lens.key],
      colour: "var(--abcde-disputation)",
    })),
  ].filter((step) => step.text.trim());

  return (
    <figure
      className={cn(
        "@container overflow-hidden rounded-2xl bg-[var(--woop-solid)] text-[var(--woop-ink)] ring-1 ring-[var(--woop-glass-edge)] shadow-[0_24px_48px_-28px_rgba(30,40,80,0.55)]",
        className,
      )}
    >
      <div className="grid @lg:grid-cols-2">
        <div className="abcde-sky-belief px-5 pt-5 pb-8 @lg:pr-9 @lg:pb-6">
          {/* Room for the card's tools, which sit over this corner on a
              narrow card and over the clear half's on a wide one. Floated, so the
              text wraps round them. */}
          {toolRoom && <span aria-hidden className="float-right ml-3 h-8 w-[4.5rem] @lg:hidden" />}
          <p className="text-micro font-semibold text-[var(--abcde-belief)]">The thought</p>
          <p className="font-display mt-1.5 text-lg leading-snug break-words text-[var(--woop-ink-muted)] line-through sm:text-xl decoration-[color-mix(in_oklab,var(--abcde-belief)_60%,transparent)] decoration-1">
            {entry.belief}
          </p>
        </div>

        <div className="abcde-sky-energization relative px-5 pt-8 pb-6 @lg:pt-5 @lg:pl-9">
          {/* The turn itself, sitting on the seam. */}
          <span
            aria-hidden
            className="absolute -top-4 left-5 grid size-8 place-items-center rounded-full bg-[var(--woop-solid)] text-[var(--abcde-energization)] ring-1 ring-[var(--woop-glass-edge)] @lg:top-1/2 @lg:-left-4 @lg:-translate-y-1/2"
          >
            <ArrowDown className="size-4 @lg:hidden" />
            <ArrowRight className="hidden size-4 @lg:block" />
          </span>
          {toolRoom && <span aria-hidden className="float-right ml-3 hidden h-8 w-[4.5rem] @lg:block" />}
          <p className="text-micro font-semibold text-[var(--abcde-energization)]">What I carry instead</p>
          <p className="font-display mt-1.5 text-xl leading-snug break-words">{entry.energization}</p>
        </div>
      </div>

      {(dateLabel || rated || onToggle) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-[var(--woop-line)] px-5 py-3">
          {dateLabel && <span className="text-micro text-[var(--woop-ink-muted)]">{dateLabel}</span>}
          {rated && (
            <BeliefMeter
              before={entry.beliefBefore}
              after={entry.beliefAfter}
              className="min-w-48 flex-1 sm:max-w-72"
            />
          )}
          {onToggle && steps.length > 0 && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-1 text-micro font-medium text-[var(--woop-ink-muted)] transition-colors hover:text-[var(--woop-ink)] focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none"
            >
              {expanded ? "Hide the argument" : "Show the argument"}
              <ChevronDown className={cn("size-3 transition-transform duration-200", expanded && "rotate-180")} aria-hidden />
            </button>
          )}
        </div>
      )}

      {expanded && steps.length > 0 && (
        <ol
          className={cn(
            "relative space-y-5 border-t border-[var(--woop-line)] px-5 pt-5 pb-6",
            // The line the weather runs down, through every dot.
            "before:absolute before:top-7 before:bottom-8 before:left-[calc(1.6625rem-0.5px)] before:w-px before:bg-[var(--woop-line)]",
            onToggle && "animate-in fade-in slide-in-from-top-1 duration-200",
          )}
        >
          {steps.map((step) => (
            <li key={step.key} className="relative pl-7">
              <span
                aria-hidden
                className="absolute top-1 left-[0.1rem] size-2.5 rounded-full ring-4 ring-[var(--woop-solid)]"
                style={{ background: step.colour }}
              />
              <p className="text-micro font-semibold" style={{ color: step.colour }}>
                {step.name}
              </p>
              <p className="mt-0.5 text-body break-words whitespace-pre-line">{step.text}</p>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

/**
 * How strongly the belief was held, before and after, on a 0-10 hairline.
 *
 * Two dots, not a filled bar: a hollow ring where it started, a solid dot
 * where it ended, and the stretch between them is the distance the
 * disputation moved it.
 */
export function BeliefMeter({
  before,
  after,
  className,
}: {
  before: number | null;
  after: number | null;
  className?: string;
}) {
  const shift = beliefShift({ beliefBefore: before, beliefAfter: after });
  const pos = (value: number) => `${value * 10}%`;
  const label =
    before !== null && after !== null
      ? `Belief went from ${before} to ${after} out of 10`
      : before !== null
        ? `Belief held at ${before} out of 10 when written`
        : `Belief at ${after} out of 10 afterwards`;

  return (
    <div className={cn("flex items-center gap-3", className)} role="img" aria-label={label}>
      <span className="shrink-0 text-micro text-[var(--woop-ink-muted)]">Belief</span>
      <div className="relative h-3 flex-1">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--woop-line)]" />
        {before !== null && after !== null && (
          <span
            className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--woop-ink-muted)] opacity-60"
            style={{
              left: pos(Math.min(before, after)),
              width: `${Math.abs(after - before) * 10}%`,
            }}
          />
        )}
        {before !== null && (
          <span
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[var(--woop-ink-muted)] bg-[var(--woop-solid)]"
            style={{ left: pos(before) }}
          />
        )}
        {after !== null && (
          <span
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--abcde-energization)]"
            style={{ left: pos(after) }}
          />
        )}
      </div>
      <span className="shrink-0 font-mono text-micro tabular-nums">
        {before ?? "?"}
        <span className="mx-1 text-[var(--woop-ink-muted)]">to</span>
        {after ?? "?"}
        {shift !== null && shift < 0 && <span className="ml-1.5 text-[var(--abcde-energization)]">{shift}</span>}
      </span>
    </div>
  );
}
