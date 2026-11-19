import type { GuideKey } from "@/lib/practice-guides";
import { cn } from "@/lib/utils";

/**
 * A small looping picture of each practice, for the guide. Drawn in the
 * theme's tokens so it reads in light and dark; it moves only when the
 * reader hasn't asked for reduced motion (see `.guide-art` in globals.css),
 * and holds a meaningful still frame otherwise. Decorative: the steps beside
 * it carry the meaning.
 */
export function GuideArt({
  guide,
  className,
}: {
  guide: GuideKey;
  className?: string;
}) {
  const Art = ART[guide];
  return (
    <svg
      viewBox="0 0 200 140"
      aria-hidden
      focusable="false"
      className={cn("guide-art h-auto w-full overflow-visible", className)}
      data-guide={guide}
    >
      <Art />
    </svg>
  );
}

const INK = "var(--woop-ink)";

/** Thoughts drift out of a head onto a page; two are circled. */
function DumpArt() {
  const scribble = (y: number) => `M0 ${y} q4 -3 8 0 t8 0 t8 0 t8 0`;
  return (
    <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      {/* The head, in profile. */}
      <path
        d="M30 112 v-14 q-14 -6 -14 -26 q0 -28 28 -30 q26 -1 28 24 l6 10 l-6 2 v8 q0 8 -10 8 h-6 v18"
        strokeWidth={2}
        opacity={0.55}
      />
      {/* Thoughts, leaving. */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(56 ${52 + i * 9})`}>
          <path
            className="ga-drift"
            style={{ animationDelay: `${i * 0.9}s` }}
            d={scribble(0)}
            stroke={i % 2 ? "var(--dump-air-b)" : "var(--dump-air-a)"}
            strokeWidth={2}
          />
        </g>
      ))}
      {/* The page. */}
      <rect
        x={118}
        y={22}
        width={66}
        height={96}
        rx={6}
        fill="var(--woop-glass)"
        stroke={INK}
        strokeOpacity={0.35}
        strokeWidth={1.5}
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          className="ga-write"
          style={{ animationDelay: `${0.6 + i * 0.45}s` }}
          d={`M128 ${38 + i * 13} h${i % 3 === 1 ? 30 : i % 3 === 2 ? 38 : 44}`}
          strokeWidth={2}
          opacity={0.7}
          pathLength={1}
        />
      ))}
      {/* Two circled: they're tasks. */}
      {[1, 4].map((i, n) => (
        <ellipse
          key={i}
          className="ga-circle"
          style={{ animationDelay: `${3.6 + n * 0.6}s` }}
          cx={i === 1 ? 143 : 147}
          cy={38 + i * 13}
          rx={i === 1 ? 20 : 26}
          ry={6}
          stroke="var(--dump-air-a)"
          strokeWidth={1.6}
          pathLength={1}
        />
      ))}
    </g>
  );
}

/** The orb breathes on a box: in, hold, out, hold, while a dot walks the square. */
function BreathArt() {
  return (
    <g>
      <rect
        x={52}
        y={22}
        width={96}
        height={96}
        rx={10}
        fill="none"
        stroke={INK}
        strokeOpacity={0.25}
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
      <circle
        className="ga-breathe"
        cx={100}
        cy={70}
        r={34}
        fill="var(--garden-moon, #fff7ea)"
        opacity={0.85}
      />
      <circle
        className="ga-breathe"
        cx={100}
        cy={70}
        r={34}
        fill="none"
        stroke={INK}
        strokeOpacity={0.35}
        strokeWidth={1.2}
      />
      <circle className="ga-box-dot" r={5} fill={INK} />
      <g
        fill={INK}
        fontSize={9}
        fontFamily="var(--font-sans)"
        opacity={0.7}
        textAnchor="middle"
      >
        <text x={100} y={14}>
          in · 4
        </text>
        <text x={162} y={73} textAnchor="start">
          hold
        </text>
        <text x={100} y={134}>
          out · 4
        </text>
        <text x={38} y={73} textAnchor="end">
          hold
        </text>
      </g>
    </g>
  );
}

/** A storm cloud, B; the disputations, D, strike it; it parts into sun, E. */
function AbcdeArt() {
  return (
    <g>
      {/* Sun behind, rising as the cloud goes. */}
      <g className="ga-sun">
        <circle cx={128} cy={58} r={20} fill="#ffcf66" />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={128 + Math.cos(a) * 26}
              y1={58 + Math.sin(a) * 26}
              x2={128 + Math.cos(a) * 34}
              y2={58 + Math.sin(a) * 34}
              stroke="#f2a93b"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        })}
        <text
          x={128}
          y={62}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="#8a4b00"
          fontFamily="var(--font-sans)"
        >
          E
        </text>
      </g>
      {/* The belief, as weather. */}
      <g className="ga-cloud">
        <path
          d="M80 92 h70 a18 18 0 0 0 0 -36 a24 24 0 0 0 -44 -10 a20 20 0 0 0 -26 46 z"
          fill="var(--abcde-belief)"
          opacity={0.85}
        />
        <text
          x={112}
          y={80}
          textAnchor="middle"
          fontSize={15}
          fontWeight={600}
          fill="var(--woop-on-ink)"
          fontFamily="var(--font-sans)"
        >
          B
        </text>
        <g
          stroke="var(--abcde-belief)"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.6}
        >
          <line x1={96} y1={100} x2={92} y2={112} />
          <line x1={112} y1={100} x2={108} y2={114} />
          <line x1={128} y1={100} x2={124} y2={110} />
        </g>
      </g>
      {/* Three arguments, flying in. */}
      {[0, 1, 2].map((i) => (
        <g
          key={i}
          className="ga-arrow"
          style={{ animationDelay: `${0.8 + i * 0.7}s` }}
        >
          <g transform={`translate(18 ${44 + i * 22})`}>
            <line
              x1={0}
              y1={0}
              x2={30}
              y2={0}
              stroke="var(--abcde-disputation)"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <path d="M30 -5 l8 5 l-8 5 z" fill="var(--abcde-disputation)" />
            <text
              x={-8}
              y={4}
              fontSize={10}
              fontWeight={600}
              fill="var(--abcde-disputation)"
              fontFamily="var(--font-sans)"
              textAnchor="middle"
            >
              D
            </text>
          </g>
        </g>
      ))}
    </g>
  );
}

/** A string of three lanterns, lit one by one. */
function GratitudeArt() {
  const xs = [48, 100, 152];
  return (
    <g>
      <path
        d="M10 30 Q100 66 190 30"
        fill="none"
        stroke={INK}
        strokeOpacity={0.35}
        strokeWidth={1.5}
      />
      {xs.map((x, i) => {
        const y =
          30 + 36 * 4 * ((x - 10) / 180) * (1 - (x - 10) / 180) * 0.5 + 6;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <line
              x1={0}
              y1={-6}
              x2={0}
              y2={4}
              stroke={INK}
              strokeOpacity={0.4}
              strokeWidth={1.2}
            />
            <circle
              className="ga-glow"
              style={{ animationDelay: `${i * 1.1}s` }}
              cx={0}
              cy={26}
              r={26}
              fill="var(--thanks-lantern)"
              opacity={0}
            />
            <rect
              x={-11}
              y={4}
              width={22}
              height={6}
              rx={2}
              fill={INK}
              opacity={0.55}
            />
            <path
              className="ga-lantern"
              style={{ animationDelay: `${i * 1.1}s` }}
              d="M-13 12 Q-16 26 -10 40 H10 Q16 26 13 12 Z"
              fill="var(--thanks-lantern)"
              stroke={INK}
              strokeOpacity={0.3}
            />
            <rect
              x={-8}
              y={40}
              width={16}
              height={4}
              rx={2}
              fill={INK}
              opacity={0.55}
            />
          </g>
        );
      })}
    </g>
  );
}

/** From a small arch, du'a widens in circles: self, family, ummah. */
function DuaArt() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          className="ga-ring"
          style={{ animationDelay: `${i * 1.4}s` }}
          cx={100}
          cy={100}
          r={22}
          fill="none"
          stroke="var(--dua-accent)"
          strokeWidth={1.6}
        />
      ))}
      {/* The arch. */}
      <path
        d="M84 126 V96 Q84 74 100 66 Q116 74 116 96 V126 Z"
        fill="var(--woop-glass)"
        stroke="var(--dua-accent)"
        strokeWidth={1.8}
      />
      <path
        d="M92 126 V100 Q92 88 100 82 Q108 88 108 100 V126 Z"
        fill="var(--dua-accent)"
        opacity={0.25}
      />
      {/* Light, rising. */}
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={i}
          className="ga-rise"
          style={{ animationDelay: `${i * 0.8}s` }}
          cx={92 + i * 5.5}
          cy={70}
          r={1.8}
          fill="var(--dua-accent)"
        />
      ))}
      <g
        fill={INK}
        fontSize={8}
        fontFamily="var(--font-sans)"
        opacity={0.6}
        textAnchor="middle"
      >
        <text x={100} y={44}>
          self
        </text>
        <text x={100} y={22}>
          family
        </text>
        <text x={100} y={6}>
          ummah
        </text>
      </g>
    </g>
  );
}

/** A wish as a starred summit; the path meets a boulder (the obstacle) and bends around it (the if-then). */
function WoopArt() {
  const path =
    "M18 128 C40 116 56 110 72 110 C92 110 96 98 92 86 C88 72 124 58 150 34";
  return (
    <g>
      {/* The wish. */}
      <path
        className="ga-twinkle"
        d="M168 8 l3.2 7 7.6 .8 -5.7 5 1.7 7.4 -6.8 -3.9 -6.8 3.9 1.7 -7.4 -5.7 -5 7.6 -.8 z"
        fill="var(--woop-wish)"
      />
      {/* The mountain and its summit flag. */}
      <path
        d="M0 136 L72 74 L104 92 L150 34 L200 136 Z"
        fill="var(--woop-wish)"
        opacity={0.14}
      />
      <line
        x1={150}
        y1={34}
        x2={150}
        y2={14}
        stroke="var(--woop-ink)"
        strokeWidth={1.6}
      />
      <path
        className="ga-flag"
        d="M150 14 l16 5 -16 5 z"
        fill="var(--woop-outcome)"
      />
      {/* The way up, around the boulder. */}
      <path
        d={path}
        fill="none"
        stroke="var(--woop-ink)"
        strokeOpacity={0.35}
        strokeWidth={1.6}
        strokeDasharray="3 4"
      />
      <line
        x1={18}
        y1={128}
        x2={150}
        y2={34}
        stroke="var(--woop-ink)"
        strokeOpacity={0.12}
        strokeWidth={1.2}
      />
      <ellipse cx={70} cy={91} rx={14} ry={10} fill="var(--woop-obstacle)" />
      <path
        d="M61 87 q7 -5 14 -1"
        fill="none"
        stroke="var(--woop-on-ink)"
        strokeOpacity={0.5}
        strokeWidth={1.2}
      />
      <circle className="ga-climb" r={4.5} fill="var(--woop-plan)" />
      <g
        fill="var(--woop-ink)"
        fontSize={8}
        fontFamily="var(--font-sans)"
        opacity={0.7}
      >
        <text x={162} y={36}>
          wish
        </text>
        <text x={52} y={82} textAnchor="end">
          obstacle
        </text>
        <text x={100} y={102}>
          if… then
        </text>
      </g>
    </g>
  );
}

const ART: Record<GuideKey, () => React.JSX.Element> = {
  braindump: DumpArt,
  meditate: BreathArt,
  wishes: WoopArt,
  disputations: AbcdeArt,
  gratitude: GratitudeArt,
  dua: DuaArt,
};
