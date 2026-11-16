import { CornerDownRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DISPUTE_LENSES,
  beliefShift,
  type DisputationFields,
} from "@/lib/disputation";

import { WashiTape } from "./journal-ornaments";

/**
 * A disputation, filed: an index card on the journal's paper.
 *
 * Reads top to bottom the way the method runs: what happened, the belief it
 * set off (struck through, because it was answered), and what you're
 * carrying out of it instead. Expanded, it shows the consequences and the
 * argument itself, lens by lens.
 */
export function DisputationIndexCard({
  entry,
  expanded = true,
  className,
}: {
  entry: DisputationFields;
  /** Show C and the lenses, not only A, B and E. */
  expanded?: boolean;
  className?: string;
}) {
  const lenses = DISPUTE_LENSES.filter((lens) => entry[lens.key].trim());

  return (
    <figure
      className={cn(
        "border-paper-edge bg-paper text-paper-ink relative rounded-md border px-5 pt-6 pb-5 shadow-[0_18px_40px_-18px_rgba(20,14,6,0.55),0_2px_0_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <WashiTape className="absolute -top-2.5 left-6 w-20" rotate="-3deg" />

      <p className="text-paper-ink-muted text-sm leading-snug">{entry.adversity}</p>

      <p className="font-hand mt-2 text-2xl leading-snug decoration-[#c4605a]/70 decoration-2 line-through">
        {entry.belief}
      </p>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-paper-ink-muted text-xs font-medium">What it did</p>
            <p className="font-hand text-xl leading-snug">{entry.consequences}</p>
          </div>
          {lenses.map((lens) => (
            <div key={lens.key}>
              <p className="text-paper-ink-muted text-xs font-medium">{lens.name}</p>
              <p className="font-hand text-xl leading-snug">{entry[lens.key]}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-paper-edge mt-4 flex items-start gap-2 border-t pt-3">
        <CornerDownRight className="text-paper-ink-muted mt-1.5 size-4 shrink-0" aria-hidden />
        <p className="font-hand decoration-washi text-2xl leading-snug underline decoration-2 underline-offset-4">
          {entry.energization}
        </p>
      </div>

      {(entry.beliefBefore !== null || entry.beliefAfter !== null) && (
        <BeliefMeter
          before={entry.beliefBefore}
          after={entry.beliefAfter}
          className="mt-4"
        />
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
      <span className="text-paper-ink-muted shrink-0 text-xs">Belief</span>
      <div className="relative h-3 flex-1">
        <span className="bg-paper-edge absolute inset-x-0 top-1/2 h-px -translate-y-1/2" />
        {before !== null && after !== null && (
          <span
            className="bg-paper-ink/40 absolute top-1/2 h-px -translate-y-1/2"
            style={{
              left: pos(Math.min(before, after)),
              width: `${Math.abs(after - before) * 10}%`,
            }}
          />
        )}
        {before !== null && (
          <span
            className="border-paper-ink/60 bg-paper absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]"
            style={{ left: pos(before) }}
          />
        )}
        {after !== null && (
          <span
            className="bg-primary absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: pos(after) }}
          />
        )}
      </div>
      <span className="text-paper-ink shrink-0 font-mono text-xs tabular-nums">
        {before ?? "?"}
        <span className="text-paper-ink-muted mx-1">to</span>
        {after ?? "?"}
        {shift !== null && shift < 0 && (
          <span className="text-primary ml-1.5">{shift}</span>
        )}
      </span>
    </div>
  );
}
