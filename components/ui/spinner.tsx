import { cn } from "@/lib/utils";

/**
 * Work in flight, for labelled buttons and inline swaps.
 *
 * A faint track with one arc on it: the ring turns while the arc breathes
 * between a short comet and half the circle. It draws in `currentColor`, so it
 * is right on the plum fill, the dark blue-to-violet gradient, and a ghost
 * button alike. Decorative — the button carries `aria-busy`, which is what
 * assistive tech hears.
 *
 * Under reduced motion the base dasharray stays: a still three-tenths arc on
 * its track, which still reads as "working".
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn(
        "animate-spinner-spin size-4 shrink-0 motion-reduce:animate-none",
        className,
      )}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.2"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="30 70"
        className="animate-spinner-dash motion-reduce:animate-none"
      />
    </svg>
  );
}

/**
 * An orbit ring for controls too small to hold a spinner — the 21px checkbox,
 * a step's box, the round water button. It floats a few pixels outside the
 * control — close enough to read as its halo, far enough that the arc never
 * merges with a ticked box's own fill — and sends one arc around the
 * perimeter, so the control itself stays exactly as the person left it (a
 * ticked box stays ticked while it waits).
 *
 * The parent must be `relative` and roughly square. `active` only fades it: in
 * after a 150ms grace, out at once. An action that answers inside the grace
 * never shows the ring at all, which is the point — a flash reads as a glitch.
 */
export function PendingRing({
  active,
  shape = "box",
  className,
}: {
  active: boolean;
  shape?: "box" | "circle";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className={cn(
        "pointer-events-none absolute -inset-[5px] size-[calc(100%+10px)] transition-opacity",
        active ? "opacity-100 delay-150 duration-200" : "opacity-0 duration-150",
        className,
      )}
      style={{
        filter:
          "drop-shadow(0 0 2px color-mix(in oklch, var(--primary) 45%, transparent))",
      }}
    >
      {shape === "circle" ? (
        <>
          <circle
            cx="50"
            cy="50"
            r="46"
            strokeWidth="5"
            className="stroke-primary/20"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="26 74"
            className="stroke-primary animate-ring-orbit"
            style={{ animationPlayState: active ? "running" : "paused" }}
          />
        </>
      ) : (
        <>
          <rect
            x="3"
            y="3"
            width="94"
            height="94"
            rx="34"
            strokeWidth="5"
            className="stroke-primary/20"
          />
          <rect
            x="3"
            y="3"
            width="94"
            height="94"
            rx="34"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="26 74"
            className="stroke-primary animate-ring-orbit"
            style={{ animationPlayState: active ? "running" : "paused" }}
          />
        </>
      )}
    </svg>
  );
}
