/**
 * What a recovery session looks like: nothing.
 *
 * This is rendered *instead of* `TimerArc`, not as a variant of it. `TimerArc`
 * draws a target being consumed, and recovery has no target — passing it a
 * mode flag would have meant a component that contradicts its own contract.
 *
 * There is no dasharray, no dashoffset, no transition, no tick marks and no
 * overtime ring. Nothing on this face moves except the digits in the middle.
 * A ring that drained would turn rest into a countdown, which is the exact
 * failure this mode exists to prevent.
 *
 * It keeps the same 260px footprint as the arc so switching modes doesn't make
 * the page jump.
 */

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 108;
const STROKE = 18;

export function RecoveryFace({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative isolate" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-rest-track"
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
