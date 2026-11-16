import { cn } from "@/lib/utils";
import { WOOP_STEPS, woopClause, type WoopFields } from "@/lib/woop";

import { WashiTape } from "./journal-ornaments";

/**
 * A WOOP, written down: an index card on the journal's paper, taped in.
 *
 * The four answers sit on ruled lines with their letters in the margin, and
 * the if-then — the part you actually carry into the work — gets its own
 * underlined line at the foot of the card. The same card closes the ritual
 * and fills the habit log, so the plan you sealed is the plan you find.
 */
export function WoopIndexCard({
  woop,
  className,
  compact = false,
}: {
  woop: WoopFields;
  className?: string;
  /** Smaller type and padding, for lists. */
  compact?: boolean;
}) {
  return (
    <figure
      className={cn(
        "border-paper-edge bg-paper text-paper-ink relative rotate-[-0.6deg] rounded-md border shadow-[0_18px_40px_-18px_rgba(20,14,6,0.55),0_2px_0_rgba(0,0,0,0.04)]",
        compact ? "px-4 pt-5 pb-3" : "px-5 pt-7 pb-5",
        className,
      )}
    >
      <WashiTape
        className={cn("absolute -top-2.5 left-1/2 -translate-x-1/2", compact ? "w-16" : "w-24")}
        rotate="-2deg"
      />
      {/* The card's red margin rule, like a real index card. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-0 bottom-0 w-px bg-[#d9827b]/60",
          compact ? "left-9" : "left-11",
        )}
      />

      <dl className={cn("space-y-1.5", compact ? "pl-6" : "pl-7")}>
        {WOOP_STEPS.map((step) => (
          <div key={step.key} className="relative">
            <dt
              className={cn(
                "font-display text-paper-ink-muted absolute top-0.5 font-medium",
                compact ? "-left-6 text-base" : "-left-8 text-xl",
              )}
              title={step.name}
            >
              {step.letter}
              <span className="sr-only">, {step.name}: </span>
            </dt>
            <dd
              className={cn(
                "font-hand border-paper-rule/60 border-b leading-snug",
                compact ? "text-lg" : "text-xl sm:text-2xl",
              )}
            >
              {woop[step.key]}
            </dd>
          </div>
        ))}
      </dl>

      <figcaption
        className={cn(
          "font-display text-paper-ink mt-3 italic",
          compact ? "pl-6 text-sm" : "pl-7 text-base sm:text-lg",
        )}
      >
        If {woopClause(woop.obstacle)},{" "}
        <span className="decoration-washi underline decoration-2 underline-offset-4">
          then I will {woopClause(woop.plan)}.
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * The wax seal: stamped when a wish is sealed, and again when it's achieved.
 * Positioned by the caller (it's absolute), animated by `.woop-seal`.
 */
export function WaxSeal({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "woop-seal absolute grid size-20 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d8615b,var(--woop-seal)_55%,#7d2421)] text-[#fbe3d6] shadow-[0_6px_16px_rgba(80,10,10,0.45),inset_0_-3px_6px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      <span className="grid size-[3.6rem] place-items-center rounded-full border border-[#fbe3d6]/40">
        <span className="font-display text-2xl leading-none italic">W</span>
      </span>
    </span>
  );
}
