"use client";

import { useEffect, useRef, useState } from "react";
import { Sunrise, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { woopClause, type WoopFields } from "@/lib/woop";

const EDGE = "ring-1 ring-[var(--woop-glass-edge)] shadow-[0_24px_48px_-28px_rgba(60,30,110,0.55)]";

const FACE_BUTTON =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] px-3 py-1.5 text-micro font-medium text-[var(--woop-ink)] backdrop-blur-sm transition-colors hover:bg-[var(--woop-hover)] focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none active:scale-[0.97]";

/**
 * A wish, kept as a card with two faces, because a WOOP is two thoughts held
 * against each other: the wish and its best outcome on the front, under the
 * wishing sky; turn it over and the obstacle and the if-then plan are on
 * the back, under the morning they're for.
 *
 * `stacked` lays both faces out at once, for the ritual's review, where the
 * point is to see the whole plan before sealing it.
 */
export function WoopCard({
  woop,
  layout = "flip",
  compact = false,
  footer,
  className,
}: {
  woop: WoopFields;
  layout?: "flip" | "stacked";
  /** The wish alone on the front, smaller, for the drawer. */
  compact?: boolean;
  /** A line under the front face's content: when it was made, or settled. */
  footer?: React.ReactNode;
  className?: string;
}) {
  if (layout === "stacked") {
    return (
      <figure className={cn("overflow-hidden rounded-2xl text-[var(--woop-ink)]", EDGE, className)}>
        <div className="woop-sky-wish px-6 pt-6 pb-6 sm:px-7">
          <Front woop={woop} />
        </div>
        <div className="wish-dawn border-t border-[var(--woop-line)] px-6 pt-5 pb-7 sm:px-7">
          <Back woop={woop} />
        </div>
      </figure>
    );
  }

  return <FlipCard woop={woop} compact={compact} footer={footer} className={className} />;
}

function FlipCard({
  woop,
  compact,
  footer,
  className,
}: {
  woop: WoopFields;
  compact: boolean;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const toBack = useRef<HTMLButtonElement>(null);
  const toFront = useRef<HTMLButtonElement>(null);
  const turned = useRef(false);

  // The button that was pressed goes inert with its face, so focus follows
  // to the button on the face that came round, once that face is shown
  // (it stays hidden until the card is edge-on, see `.wish-face`).
  useEffect(() => {
    if (!turned.current) return;
    const timer = window.setTimeout(() => {
      (flipped ? toFront : toBack).current?.focus({ preventScroll: true });
    }, 340);
    return () => window.clearTimeout(timer);
  }, [flipped]);

  const turn = (next: boolean) => {
    turned.current = true;
    setFlipped(next);
  };

  const pad = compact ? "px-5 pt-5 pb-4" : "px-6 pt-6 pb-5 sm:px-7";

  return (
    <div className={cn("wish-flip text-[var(--woop-ink)]", className)} data-flipped={flipped}>
      <section
        data-face="front"
        inert={flipped}
        aria-label="The wish"
        className={cn("wish-face woop-sky-wish flex flex-col rounded-2xl", EDGE, pad)}
      >
        <Front woop={woop} compact={compact} room />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-6">
          <div className="min-w-0 text-micro text-[var(--woop-ink-muted)]">{footer}</div>
          <button
            ref={toBack}
            type="button"
            onClick={() => turn(true)}
            className={FACE_BUTTON}
          >
            <Sunrise className="size-3.5" aria-hidden />
            See the plan
          </button>
        </div>
      </section>

      <section
        data-face="back"
        inert={!flipped}
        aria-label="The plan"
        className={cn("wish-face wish-dawn flex flex-col rounded-2xl", EDGE, pad)}
      >
        <Back woop={woop} compact={compact} room />
        <div className="mt-auto flex justify-end pt-6">
          <button
            ref={toFront}
            type="button"
            onClick={() => turn(false)}
            className={FACE_BUTTON}
          >
            <Undo2 className="size-3.5" aria-hidden />
            Back to the wish
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Space for the card's tools, pinned top-right on the board. Floated, so the
 * text wraps round the corner they sit in and keeps the card's full width
 * below them.
 */
function ToolRoom() {
  return <span aria-hidden className="float-right ml-3 h-8 w-[4.5rem]" />;
}

function Front({ woop, compact = false, room = false }: { woop: WoopFields; compact?: boolean; room?: boolean }) {
  return (
    <div>
      {room && <ToolRoom />}
      <p className="text-micro font-semibold text-[var(--woop-wish)]">Wish</p>
      <p
        className={cn(
          "font-display mt-1 leading-tight break-words",
          compact ? "text-lg" : "text-2xl sm:text-[1.75rem]",
        )}
      >
        {woop.wish}
      </p>
      {!compact && woop.outcome && (
        <>
          <p className="mt-5 text-micro font-semibold text-[var(--woop-outcome)]">Outcome</p>
          <p className="mt-1 text-body break-words text-[var(--woop-ink-muted)] italic">{woop.outcome}</p>
        </>
      )}
    </div>
  );
}

function Back({ woop, compact = false, room = false }: { woop: WoopFields; compact?: boolean; room?: boolean }) {
  return (
    <div>
      {room && <ToolRoom />}
      <p className={cn("break-words text-[var(--woop-ink-muted)]", compact ? "text-label" : "text-body")}>
        <span className="font-semibold text-[var(--woop-obstacle)]">If</span> {woopClause(woop.obstacle)},
      </p>
      <p
        className={cn(
          "font-display mt-3 leading-snug break-words",
          compact ? "text-lg" : "text-xl sm:text-2xl",
        )}
      >
        <span className="text-[var(--woop-plan)]">then I will</span> {woopClause(woop.plan)}.
      </p>
    </div>
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
