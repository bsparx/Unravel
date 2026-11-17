import { cn } from "@/lib/utils";
import { GARDEN_STAGES, stagesAt } from "@/lib/garden";

/** A tiny deterministic generator, so the stars and tufts sit still between renders. */
function scatter(seed: number, count: number, area: { x: [number, number]; y: [number, number] }) {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: area.x[0] + next() * (area.x[1] - area.x[0]),
    y: area.y[0] + next() * (area.y[1] - area.y[0]),
    r: next(),
  }));
}

const STARS = scatter(7, 34, { x: [10, 1190], y: [10, 250] });
const TUFTS = scatter(11, 70, { x: [10, 1190], y: [440, 556] }).filter((t) => !(t.x > 360 && t.x < 840 && t.y > 452 && t.y < 535));
const FIREFLIES = scatter(23, 14, { x: [120, 1100], y: [330, 470] });
const NAMES = Object.fromEntries(GARDEN_STAGES.map((stage) => [stage.id, stage.name]));

function Lantern({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle data-fx="glow" cx={0} cy={-48} r={46} fill="url(#garden-glow)" />
      <rect x={-13} y={-10} width={26} height={10} rx={2} fill="var(--garden-stone)" />
      <rect x={-5} y={-38} width={10} height={28} fill="var(--garden-stone)" />
      <rect x={-15} y={-60} width={30} height={22} rx={2} fill="var(--garden-stone)" />
      <rect x={-8} y={-56} width={16} height={13} rx={1} fill="var(--garden-light)" />
      <path d="M-24 -60 L0 -76 L24 -60 Z" fill="var(--garden-stone-dark)" />
    </g>
  );
}

/**
 * The garden, drawn from the minutes sat. Original artwork: a moonlit
 * meadow that gains a pond, trees, lanterns and the rest as stages are
 * reached, never losing any. Each stage is a named group, so a screen reader
 * (and a hover) can say what's there. `fresh` ids grow in, for the moment a
 * sitting unlocks them.
 *
 * During a session the parent writes `--breath` (0 to 1) on an ancestor and
 * the ripples and lantern glow follow it; see .garden-scene in globals.css.
 */
export function GardenScene({
  minutes,
  fresh = [],
  className,
  label = true,
}: {
  minutes: number;
  fresh?: readonly string[];
  className?: string;
  /** False when the garden is a backdrop (the session), so it stays silent. */
  label?: boolean;
}) {
  const reached = new Set(stagesAt(minutes).map((stage) => stage.id));
  const has = (id: string) => reached.has(id);
  const grow = (id: string) => (fresh.includes(id) ? { "data-grow": "" } : {});
  const names = stagesAt(minutes).map((stage) => stage.name.toLowerCase());
  const fullMoon = has("full-moon");

  return (
    <svg
      viewBox="0 0 1200 560"
      preserveAspectRatio="xMidYMax slice"
      className={cn("garden-scene block size-full", className)}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label ? `Your garden: ${names.join(", ")}.` : undefined}
    >
      <defs>
        <linearGradient id="garden-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--garden-sky-1)" />
          <stop offset="60%" stopColor="var(--garden-sky-2)" />
          <stop offset="100%" stopColor="var(--garden-sky-3)" />
        </linearGradient>
        <radialGradient id="garden-halo">
          <stop offset="0%" stopColor="var(--garden-moon)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--garden-moon)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="garden-glow">
          <stop offset="0%" stopColor="var(--garden-light)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--garden-light)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="garden-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--garden-water-1)" />
          <stop offset="100%" stopColor="var(--garden-water-2)" />
        </linearGradient>
      </defs>

      {/* Sky, stars, moon. Always there. */}
      <rect width="1200" height="560" fill="url(#garden-sky)" />
      {STARS.map((star, i) => (
        <circle
          key={i}
          data-fx="twinkle"
          cx={star.x}
          cy={star.y}
          r={0.8 + star.r * 1.4}
          fill="var(--garden-star)"
          style={{ animationDelay: `${(star.r * 4).toFixed(2)}s` }}
          opacity={0.85}
        />
      ))}
      <g>
        <circle data-fx="halo" cx={800} cy={108} r={fullMoon ? 230 : 150} fill="url(#garden-halo)" />
        <circle cx={800} cy={108} r={fullMoon ? 52 : 38} fill="var(--garden-moon)" />
        <circle cx={788} cy={100} r={fullMoon ? 9 : 6} fill="var(--garden-moon-shade)" opacity={0.35} />
        <circle cx={812} cy={118} r={fullMoon ? 6 : 4} fill="var(--garden-moon-shade)" opacity={0.3} />
      </g>
      {has("meteors") && (
        <g {...grow("meteors")}>
          <title>{NAMES.meteors}</title>
          <path data-fx="meteor" d="M420 60 l-60 30" stroke="var(--garden-star)" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
          <path data-fx="meteor" d="M1080 40 l-50 25" stroke="var(--garden-star)" strokeWidth={1.5} strokeLinecap="round" opacity={0.5} style={{ animationDelay: "4.5s" }} />
        </g>
      )}

      {/* Hills and the meadow. */}
      <path d="M0 330 C150 282 300 300 420 318 S700 272 860 300 S1100 290 1200 312 L1200 560 L0 560 Z" fill="var(--garden-hill-far)" />
      {has("pavilion") && (
        <g {...grow("pavilion")}>
          <title>{NAMES.pavilion}</title>
          <circle data-fx="glow" cx={132} cy={300} r={26} fill="url(#garden-glow)" />
          <rect x={102} y={312} width={60} height={5} rx={1} fill="var(--garden-stone-dark)" />
          <rect x={108} y={292} width={4} height={20} fill="var(--garden-stone-dark)" />
          <rect x={152} y={292} width={4} height={20} fill="var(--garden-stone-dark)" />
          <circle cx={132} cy={302} r={3} fill="var(--garden-light)" />
          <path d="M92 294 Q132 266 172 294 Z" fill="var(--garden-stone-dark)" />
        </g>
      )}
      <path d="M0 392 C200 352 380 372 520 386 S820 360 1000 376 S1150 382 1200 372 L1200 560 L0 560 Z" fill="var(--garden-hill)" />
      {has("cherry") && (
        <g {...grow("cherry")} data-fx="sway">
          <title>{NAMES.cherry}</title>
          <path d="M696 400 L700 352 L704 400 Z" fill="var(--garden-bark)" />
          <circle cx={700} cy={340} r={30} fill="var(--garden-blossom)" />
          <circle cx={678} cy={354} r={20} fill="var(--garden-blossom)" opacity={0.9} />
          <circle cx={722} cy={352} r={22} fill="var(--garden-blossom)" opacity={0.9} />
        </g>
      )}
      <path d="M0 432 C240 418 420 426 600 428 S960 418 1200 434 L1200 560 L0 560 Z" fill="var(--garden-ground)" />
      <g>
        <title>{NAMES.meadow}</title>
        {TUFTS.map((t, i) => (
          <path
            key={i}
            d={`M${t.x} ${t.y} q2 -${12 + t.r * 14} 5 0 m-3 0 q5 -${10 + t.r * 10} 10 -3 m-12 3 q-3 -${8 + t.r * 8} -7 -2`}
            stroke="var(--garden-leaf)"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            opacity={0.55 + t.r * 0.4}
          />
        ))}
        {/* A few stones and a low shrub, so the meadow is a place from the first minute. */}
        {[
          [130, 512, 16, 7],
          [1010, 528, 20, 8],
          [1080, 502, 12, 5],
        ].map(([x, y, rx, ry]) => (
          <ellipse key={x} cx={x} cy={y} rx={rx} ry={ry} fill="var(--garden-stone-dark)" opacity={0.8} />
        ))}
        <ellipse cx={1130} cy={452} rx={42} ry={18} fill="var(--garden-leaf-tree)" opacity={0.9} />
        <ellipse cx={1162} cy={456} rx={28} ry={13} fill="var(--garden-leaf-tree)" />
      </g>

      {has("willow") && (
        <g {...grow("willow")} data-fx="sway">
          <title>{NAMES.willow}</title>
          <path d="M1046 446 C1044 400 1040 360 1052 322 L1060 322 C1054 360 1058 400 1058 446 Z" fill="var(--garden-bark)" />
          <ellipse cx={1055} cy={318} rx={66} ry={28} fill="var(--garden-leaf-tree)" />
          {[-60, -45, -30, -15, 0, 15, 30, 45, 60].map((dx) => (
            <path
              key={dx}
              d={`M${1055 + dx} ${318 + Math.abs(dx) / 6} q${dx / 4} 50 ${dx / 6} ${92 - Math.abs(dx) / 2}`}
              stroke="var(--garden-leaf-tree)"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>
      )}

      {has("maple") && (
        <g {...grow("maple")} data-fx="sway">
          <title>{NAMES.maple}</title>
          <path d="M244 446 L248 372 L256 372 L260 446 Z" fill="var(--garden-bark)" />
          <circle cx={252} cy={354} r={46} fill="var(--garden-leaf-tree)" />
          <circle cx={222} cy={378} r={30} fill="var(--garden-leaf-tree)" />
          <circle cx={284} cy={380} r={32} fill="var(--garden-leaf-tree)" />
        </g>
      )}

      {/* The pond and what's in and on it. */}
      {has("pond") && (
        <g {...grow("pond")}>
          <title>{NAMES.pond}</title>
          <ellipse cx={600} cy={494} rx={232} ry={44} fill="url(#garden-water)" />
          <ellipse cx={600} cy={494} rx={232} ry={44} fill="none" stroke="var(--garden-water-rim)" strokeWidth={3} />
          <ellipse data-fx="ripple" cx={600} cy={496} rx={120} ry={16} fill="none" stroke="var(--garden-ripple)" strokeWidth={1.5} />
          <ellipse data-fx="ripple" cx={600} cy={496} rx={56} ry={7} fill="none" stroke="var(--garden-ripple)" strokeWidth={1.5} />
        </g>
      )}
      {has("moonpath") && (
        <g {...grow("moonpath")} opacity={0.55}>
          <title>{NAMES.moonpath}</title>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={784 - (6 - i) * 4} y={466 + i * 8} width={20 + (6 - i) * 8} height={2.5} rx={1.2} fill="var(--garden-moon)" />
          ))}
        </g>
      )}
      {has("koi") && (
        <g {...grow("koi")}>
          <title>{NAMES.koi}</title>
          {[
            { x: 560, y: 498, d: "0s" },
            { x: 650, y: 486, d: "-6s" },
          ].map((fish) => (
            <g key={fish.x} data-fx="swim" style={{ animationDelay: fish.d }}>
              <ellipse cx={fish.x} cy={fish.y} rx={10} ry={4} fill="var(--garden-koi)" />
              <path d={`M${fish.x - 9} ${fish.y} l-7 -4 l0 8 z`} fill="var(--garden-koi)" />
            </g>
          ))}
        </g>
      )}
      {has("lilies") && (
        <g {...grow("lilies")}>
          <title>{NAMES.lilies}</title>
          {[
            [690, 505, 15],
            [722, 488, 10],
            [520, 510, 12],
            [470, 486, 9],
          ].map(([x, y, r]) => (
            <g key={x}>
              <ellipse cx={x} cy={y} rx={r} ry={r / 3} fill="var(--garden-lily)" />
              <circle cx={x + 2} cy={y - 2} r={r / 4} fill="var(--garden-flower)" />
            </g>
          ))}
        </g>
      )}
      {has("bridge") && (
        <g {...grow("bridge")}>
          <title>{NAMES.bridge}</title>
          <path d="M392 494 Q468 436 544 494" stroke="var(--garden-wood)" strokeWidth={8} fill="none" strokeLinecap="round" />
          <path d="M398 480 Q468 424 538 480" stroke="var(--garden-wood)" strokeWidth={2.5} fill="none" />
          {/* Posts from deck to rail, at points along both curves. */}
          {[0.15, 0.35, 0.65, 0.85].map((t) => {
            const bow = t * (1 - t);
            return (
              <line
                key={t}
                x1={392 + 152 * t}
                y1={494 - 116 * bow}
                x2={398 + 140 * t}
                y2={480 - 112 * bow}
                stroke="var(--garden-wood)"
                strokeWidth={2}
              />
            );
          })}
        </g>
      )}
      {has("heron") && (
        <g {...grow("heron")}>
          <title>{NAMES.heron}</title>
          <line x1={850} y1={500} x2={846} y2={474} stroke="var(--garden-heron)" strokeWidth={2} />
          <line x1={858} y1={500} x2={854} y2={474} stroke="var(--garden-heron)" strokeWidth={2} />
          <ellipse cx={852} cy={466} rx={16} ry={9} fill="var(--garden-heron)" />
          <path d="M862 462 Q874 440 866 428" stroke="var(--garden-heron)" strokeWidth={4} fill="none" strokeLinecap="round" />
          <circle cx={866} cy={426} r={5} fill="var(--garden-heron)" />
          <path d="M870 425 l12 2 l-12 2 z" fill="var(--garden-heron)" />
        </g>
      )}

      {/* Lanterns and the path. */}
      {has("lantern") && (
        <g {...grow("lantern")}>
          <title>{NAMES.lantern}</title>
          <Lantern x={944} y={466} />
        </g>
      )}
      {has("lantern-2") && (
        <g {...grow("lantern-2")}>
          <title>{NAMES["lantern-2"]}</title>
          <Lantern x={340} y={458} scale={0.72} />
        </g>
      )}
      {has("path") && (
        <g {...grow("path")}>
          <title>{NAMES.path}</title>
          {[
            [196, 548, 24, 8],
            [252, 536, 22, 7],
            [302, 524, 19, 6],
            [344, 513, 17, 5.5],
          ].map(([x, y, rx, ry]) => (
            <ellipse key={x} cx={x} cy={y} rx={rx} ry={ry} fill="var(--garden-stone)" opacity={0.85} />
          ))}
        </g>
      )}

      {has("flowers") && (
        <g {...grow("flowers")}>
          <title>{NAMES.flowers}</title>
          {[
            [140, 470],
            [330, 540],
            [900, 528],
            [1090, 470],
            [960, 452],
            [70, 520],
          ].map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y} x2={x} y2={y - 10} stroke="var(--garden-leaf)" strokeWidth={1.5} />
              <circle cx={x} cy={y - 12} r={4} fill={i % 2 ? "var(--garden-flower-2)" : "var(--garden-flower)"} />
              <circle cx={x + 9} cy={y - 6} r={3.2} fill="var(--garden-flower)" />
              <line x1={x + 9} y1={y} x2={x + 9} y2={y - 4} stroke="var(--garden-leaf)" strokeWidth={1.5} />
            </g>
          ))}
        </g>
      )}

      {has("fireflies") && (
        <g {...grow("fireflies")}>
          <title>{NAMES.fireflies}</title>
          {FIREFLIES.map((fly, i) => (
            <circle
              key={i}
              data-fx="firefly"
              cx={fly.x}
              cy={fly.y}
              r={2.4}
              fill="var(--garden-light)"
              style={{ animationDelay: `${(-fly.r * 7).toFixed(2)}s` }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
