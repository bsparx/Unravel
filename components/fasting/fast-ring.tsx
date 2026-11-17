import { cn } from "@/lib/utils";

const SIZE = 232;
const STROKE = 12;
const R = (SIZE - STROKE) / 2 - 6;
const C = 2 * Math.PI * R;

/**
 * The fast as a clock face: one lap is the goal. Past the goal a second,
 * softer lap starts over the first in the dawn colour, so a long fast reads
 * as "and then some" rather than a full ring that stops meaning anything.
 */
export function FastRing({
  ratio,
  reached,
  children,
  className,
}: {
  /** Elapsed over goal; 0 for no fast. */
  ratio: number;
  reached: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const first = Math.min(Math.max(ratio, 0), 1);
  const second = ratio > 1 ? Math.min(ratio - 1, 1) : 0;
  const gradient = "fast-ring-gradient";

  return (
    <div className={cn("relative grid size-[min(232px,70vw)] shrink-0 place-items-center", className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--fast-ring)" }} />
            <stop offset="100%" style={{ stopColor: reached ? "var(--fast-reached)" : "var(--fast-ring-end)" }} />
          </linearGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--fast-track)" strokeWidth={STROKE} />
        {/* Hour ticks, every three. */}
        {Array.from({ length: 8 }).map((_, index) => {
          const angle = (index / 8) * 2 * Math.PI;
          const inner = R - STROKE / 2 - 7;
          const outer = R - STROKE / 2 - 3;
          return (
            <line
              key={index}
              x1={SIZE / 2 + inner * Math.cos(angle)}
              y1={SIZE / 2 + inner * Math.sin(angle)}
              x2={SIZE / 2 + outer * Math.cos(angle)}
              y2={SIZE / 2 + outer * Math.sin(angle)}
              stroke="var(--woop-ink-muted)"
              strokeOpacity={0.4}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}
        <circle
          className="fast-ring-arc"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - first)}
          style={reached ? { filter: "drop-shadow(0 0 6px var(--fast-reached))" } : undefined}
        />
        {second > 0 && (
          <circle
            className="fast-ring-arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--fast-reached)"
            strokeOpacity={0.55}
            strokeWidth={STROKE / 2}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - second)}
          />
        )}
      </svg>
      {/* The goal sits at twelve o'clock. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--woop-solid)]",
          reached ? "bg-[var(--fast-reached)]" : "bg-[var(--fast-ring)]",
        )}
        style={{ top: `${((SIZE / 2 - R) / SIZE) * 100}%` }}
      />
      <div className="relative flex flex-col items-center text-center">{children}</div>
    </div>
  );
}
