/**
 * The frog — the home screen's signature element.
 *
 * Eat-the-frog made visible: the day's one important task is a frog on a
 * lilypad, waiting to be eaten. Drawn in the house stroke style (one stroke,
 * round caps, like BrandMark): the body is ink in stroke-foreground and the
 * lilypad is the only filled surface, in the primary token at low opacity, so
 * the frog wears whatever theme it sits in — paper, dark, or eggplant — with
 * no new colours.
 *
 * Two moods: "eaten" is false while the frog waits (open eyes, small smile)
 * and true once the day's task is done (closed, satisfied eyes and a fuller
 * smile). Purely decorative — the copy next to it carries the meaning — so it
 * is aria-hidden, and it never animates on its own: the caller mounts it with
 * animate-rise, which the global reduced-motion opt-out already neutralises.
 */
export function Frog({
  className,
  eaten = false,
}: {
  className?: string;
  /** True once today's task is complete: closed eyes, satisfied smile. */
  eaten?: boolean;
}) {
  return (
    <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden>
      {/* The lilypad: the frog's one piece of ground. */}
      <ellipse
        cx="32"
        cy="38.5"
        rx="21"
        ry="6.5"
        className="fill-primary/15 stroke-primary"
        strokeWidth="2"
      />

      {/* The body: one stroke, like the brand mark. */}
      <path
        d="M 19 31 Q 16 15 32 15 Q 48 15 45 31 Q 43 37 32 38 Q 21 37 19 31 Z"
        className="stroke-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {eaten ? (
        <>
          {/* Closed, satisfied eyes. */}
          <path
            d="M 22 12.5 Q 24.5 15.5 27 12.5"
            className="stroke-foreground"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M 37 12.5 Q 39.5 15.5 42 12.5"
            className="stroke-foreground"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* A fuller smile than the waiting frog's. */}
          <path
            d="M 25.5 24.5 Q 32 30.5 38.5 24.5"
            className="stroke-foreground"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          {/* Open eyes with pupils. */}
          <path
            d="M 24.5 6.5 a 4.5 4.5 0 1 0 0.01 0 Z"
            className="stroke-foreground"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M 39.5 6.5 a 4.5 4.5 0 1 0 0.01 0 Z"
            className="stroke-foreground"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M 24.5 10 a 1.8 1.8 0 1 0 0.01 0 Z"
            className="fill-foreground"
          />
          <path
            d="M 39.5 10 a 1.8 1.8 0 1 0 0.01 0 Z"
            className="fill-foreground"
          />
          <path
            d="M 28 25.5 Q 32 28 36 25.5"
            className="stroke-foreground"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
