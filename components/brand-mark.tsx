/**
 * The Unravel mark: a loop that has come undone.
 *
 * A ring with a gap at the top — the timer's circle, the day's loop — and a
 * single thread that has been pulled loose, unspooling once around the
 * outside and hooking back in. One stroke, drawn in `currentColor`, so the
 * mark wears whatever token its context does (primary on the sidebar rail,
 * foreground on the landing page).
 *
 * Geometry is deliberate and verified: the arc is the long way around
 * (large-arc 1, sweep 0), so the ring body reads as a circle with a 50° gap
 * at the top; the tail's control points keep every segment clear of the
 * ring's outside edge so the two strokes never touch at small sizes.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path
        d="M 13.46 10.56 A 6 6 0 1 0 18.54 10.56
           C 14.6 7.2 18.4 7.0 20.7 9.0
           C 23.0 11.0 24.0 14.4 23.2 17.4
           C 22.4 20.4 19.8 22.8 16.6 23.2
           C 14.2 23.5 12.0 22.1 11.4 19.9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
