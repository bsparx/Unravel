import { SCENES } from "@/lib/scenes";
import { cn } from "@/lib/utils";

import { SceneSvg, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.braindump;

// ---------------------------------------------------------------- the envelope

/*
 * One balloon envelope, drawn once and reused at every size. Its mouth is at
 * the origin and it rises to its crown 184 units up: a cone that swells to
 * its widest at the belly, then a rounded dome. The gores are meridians of
 * that shape spaced by angle, so they crowd towards the edges the way they
 * would on something round.
 */
const CROWN = 184;
const BELLY = 122;
const R = 64;
const MOUTH = 12;
const GORE_COUNT = 8;

const PROFILE: [number, number][] = [
  // The cone, mouth to belly, easing into the widest point.
  ...Array.from({ length: 20 }, (_, i): [number, number] => {
    const h = (i / 20) * BELLY;
    return [h, MOUTH + (R - MOUTH) * Math.pow(Math.sin((Math.PI / 2) * (h / BELLY)), 1.25)];
  }),
  // The dome, belly to crown, by angle so the top stays round.
  ...Array.from({ length: 17 }, (_, i): [number, number] => {
    const phi = (i / 16) * (Math.PI / 2);
    return [BELLY + (CROWN - BELLY) * Math.sin(phi), R * Math.cos(phi)];
  }),
];

const meridian = (theta: number) => PROFILE.map(([h, w]) => [round(Math.sin(theta) * w), round(-h)] as const);
const toPath = (points: readonly (readonly [number, number])[]) =>
  `M${points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

const THETAS = Array.from({ length: GORE_COUNT + 1 }, (_, i) => -Math.PI / 2 + (i * Math.PI) / GORE_COUNT);
const GORES = THETAS.slice(0, -1).map((theta, i) => toPath([...meridian(theta), ...meridian(THETAS[i + 1]).reverse()]));
const OUTLINE = toPath([...meridian(-Math.PI / 2), ...meridian(Math.PI / 2).reverse()]);

type Colours = readonly string[];

const MAIN: Colours = ["var(--balloon-env-1)", "var(--balloon-env-2)", "var(--balloon-env-3)", "var(--balloon-env-2)"];
const SECOND: Colours = ["var(--balloon-two-1)", "var(--balloon-two-2)"];
const FAR: Colours[] = [
  ["var(--balloon-env-3)", "var(--balloon-env-2)"],
  ["var(--balloon-two-2)", "var(--balloon-env-1)"],
  ["var(--balloon-env-1)", "var(--balloon-two-1)"],
  ["var(--balloon-two-1)", "var(--balloon-env-2)"],
];

function Envelope({ colours, glow = false, rim = false }: { colours: Colours; glow?: boolean; rim?: boolean }) {
  return (
    <g>
      {GORES.map((d, i) => (
        <path key={i} d={d} fill={colours[i % colours.length]} />
      ))}
      <path d={OUTLINE} fill="url(#balloon-volume)" />
      {glow && <path d={OUTLINE} fill="url(#balloon-inner)" />}
      {rim && <path d={OUTLINE} fill="url(#balloon-rim)" />}
      <path d={OUTLINE} fill="none" stroke="var(--balloon-seam)" strokeWidth={1.2} />
      <path d="M-12 0 L12 0 L9 8 L-9 8 Z" fill="var(--balloon-skirt)" />
    </g>
  );
}

/** The basket with its ropes and burner; the origin is the basket's foot. */
function Basket({ detail = true, rigged = true }: { detail?: boolean; rigged?: boolean }) {
  return (
    <g>
      {rigged && (
        <g stroke="var(--balloon-rope)" strokeWidth={detail ? 1.3 : 2.5} strokeLinecap="round">
          <line x1={-9} y1={-62} x2={-15} y2={-31} />
          <line x1={9} y1={-62} x2={15} y2={-31} />
          {detail && (
            <>
              <line x1={-3} y1={-62} x2={-5} y2={-31} />
              <line x1={3} y1={-62} x2={5} y2={-31} />
            </>
          )}
        </g>
      )}
      {detail && rigged && <rect x={-7} y={-47} width={14} height={5} rx={1.5} fill="var(--balloon-rope)" />}
      <rect x={-16} y={-30} width={32} height={30} rx={4} fill="var(--balloon-basket)" />
      <rect x={-17.5} y={-32} width={35} height={6} rx={2.5} fill="var(--balloon-basket-dark)" />
      {detail && (
        <g stroke="var(--balloon-basket-dark)" strokeWidth={1.2} opacity={0.55}>
          <line x1={-16} y1={-19} x2={16} y2={-19} />
          <line x1={-16} y1={-10} x2={16} y2={-10} />
          <line x1={-8} y1={-26} x2={-8} y2={0} />
          <line x1={0} y1={-26} x2={0} y2={0} />
          <line x1={8} y1={-26} x2={8} y2={0} />
        </g>
      )}
    </g>
  );
}

function Flame() {
  return (
    <>
      <circle cx={0} cy={-60} r={26} fill="url(#balloon-burn)" data-fx="glow" />
      <g data-fx="flicker">
        <path d="M0 -72 C6 -63 7 -55 0 -47 C-7 -55 -6 -63 0 -72 Z" fill="var(--balloon-flame)" />
        <path d="M0 -64 C3 -59 3 -54 0 -50 C-3 -54 -3 -59 0 -64 Z" fill="var(--balloon-flame-core)" />
      </g>
    </>
  );
}

/** A whole balloon in the air: envelope over basket. */
function Balloon({
  colours,
  flame = false,
  rim = false,
  detail = true,
}: {
  colours: Colours;
  flame?: boolean;
  rim?: boolean;
  detail?: boolean;
}) {
  return (
    <g>
      {flame && <Flame />}
      <g transform="translate(0 -70)">
        <Envelope colours={colours} glow={flame} rim={rim} />
      </g>
      <Basket detail={detail} />
    </g>
  );
}

// ---------------------------------------------------------------- the land

/** A point on a Catmull-Rom curve through `points`, for the river. */
function spline(points: readonly (readonly [number, number, number])[], perSegment: number) {
  const out: [number, number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (k: 0 | 1 | 2) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1), at(2)]);
    }
  }
  out.push([...points[points.length - 1]]);
  return out;
}

/** The river's banks: the centre line pushed out by half its width either side. */
function riverPath(points: readonly (readonly [number, number, number])[]) {
  const line = spline(points, 6);
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  line.forEach(([x, y, w], i) => {
    const [ax, ay] = line[Math.max(0, i - 1)];
    const [bx, by] = line[Math.min(line.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    left.push([round(x + nx * w * 0.5), round(y + ny * w * 0.5)]);
    right.push([round(x - nx * w * 0.5), round(y - ny * w * 0.5)]);
  });
  return toPath([...left, ...right.reverse()]);
}

// It comes out of the hills, loops back on itself once, and widens as it nears.
const RIVER_LINE = [
  [736, 437, 3],
  [676, 442, 5],
  [620, 447, 7],
  [590, 456, 10],
  [608, 467, 13],
  [568, 478, 17],
  [488, 489, 23],
  [410, 501, 31],
  [348, 517, 42],
  [298, 537, 58],
  [252, 560, 80],
  [226, 578, 92],
] as const;
const RIVER = riverPath(RIVER_LINE);
const RIVER_GLINTS = [
  [646, 444, 12],
  [596, 468, 14],
  [470, 491, 22],
  [370, 511, 28],
  [300, 540, 36],
] as const;

const STARS = scatter(31, 54, { x: [10, 1190], y: [10, 300] });
const TUFTS = scatter(41, 36, { x: [0, 1200], y: [538, 556] });

const POPLARS: [number, number, number][] = [
  [668, 434, 0.5],
  [622, 440, 0.58],
  [538, 443, 0.66],
  [482, 452, 0.74],
  [404, 470, 0.86],
  [322, 488, 1],
];

const SHEEP: [number, number, number, boolean][] = [
  [826, 510, 1, false],
  [866, 519, 0.95, true],
  [906, 507, 0.9, false],
  [958, 521, 1.05, true],
  [1014, 511, 0.92, false],
];

const HOUSES: [number, number, number, string, string][] = [
  [168, 13, 11, "var(--balloon-house)", "var(--balloon-roof)"],
  [190, 15, 13, "var(--balloon-house-2)", "var(--balloon-roof-2)"],
  [212, 11, 9, "var(--balloon-house)", "var(--balloon-roof)"],
  [282, 14, 12, "var(--balloon-house-2)", "var(--balloon-roof)"],
  [304, 12, 10, "var(--balloon-house)", "var(--balloon-roof-2)"],
  [326, 10, 9, "var(--balloon-house-2)", "var(--balloon-roof)"],
];

const SWALLOWS: [number, number, number][] = [
  [452, 176, 0],
  [488, 162, -2],
  [470, 202, -4],
  [526, 188, -6],
  [410, 206, -8],
];

const HORIZON: [number, number, number, number][] = [
  [905, 268, 0.14, 0],
  [1050, 306, 0.11, -2],
  [176, 290, 0.15, -1],
  [462, 318, 0.1, -3],
];

function Poplar({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g data-fx="sway" style={{ animationDelay: `${round((x % 7) * -1.1)}s` }}>
        <line x1={0} y1={0} x2={0} y2={-10} stroke="var(--balloon-trunk)" strokeWidth={3} />
        <path d="M0 -6 C-11 -16 -12 -48 0 -78 C12 -48 11 -16 0 -6 Z" fill="var(--balloon-poplar)" />
        <path d="M0 -6 C-11 -16 -12 -48 0 -78 C-3 -48 -3 -18 0 -6 Z" fill="var(--balloon-poplar-lit)" opacity={0.6} />
      </g>
    </g>
  );
}

function Sheep({ x, y, s, flip }: { x: number; y: number; s: number; flip: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <g stroke="var(--balloon-sheep-face)" strokeWidth={2.2} strokeLinecap="round">
        <line x1={-6} y1={0} x2={-6} y2={-7} />
        <line x1={6} y1={0} x2={6} y2={-7} />
      </g>
      <g fill="var(--balloon-wool)">
        <ellipse cx={0} cy={-12} rx={13} ry={8} />
        <circle cx={-8} cy={-15} r={6} />
        <circle cx={0} cy={-18} r={6.5} />
        <circle cx={8} cy={-15} r={6} />
        <circle cx={-12} cy={-10} r={4.5} />
      </g>
      {/* Grazing: the head down in the grass. */}
      <ellipse cx={14} cy={-9} rx={4.2} ry={5.6} transform="rotate(-24 14 -9)" fill="var(--balloon-sheep-face)" />
      <ellipse cx={11} cy={-13} rx={2.6} ry={1.4} transform="rotate(-30 11 -13)" fill="var(--balloon-sheep-face)" />
    </g>
  );
}

function Windmill({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-12 0 L-7 -48 L7 -48 L12 0 Z" fill="var(--balloon-mill)" />
      <path d="M-12 0 L-7 -48 L-2 -48 L-4 0 Z" fill="var(--balloon-mill-shade)" />
      <path d="M-9 -48 Q0 -58 9 -48 Z" fill="var(--balloon-roof-2)" />
      <rect x={-3} y={-14} width={6} height={14} rx={3} fill="var(--balloon-mill-shade)" />
      {/* The turn is a CSS transform, so it can't share the group that places it. */}
      <g transform="translate(0 -50)">
        <g data-fx="spin">
          {[0, 90, 180, 270].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <line x1={0} y1={0} x2={0} y2={-40} stroke="var(--balloon-sail)" strokeWidth={2} />
              <rect x={1} y={-40} width={9} height={30} fill="var(--balloon-sail)" opacity={0.55} />
              <g stroke="var(--balloon-sail)" strokeWidth={0.8}>
                <line x1={1} y1={-30} x2={10} y2={-30} />
                <line x1={1} y1={-20} x2={10} y2={-20} />
              </g>
            </g>
          ))}
          <circle cx={0} cy={0} r={3} fill="var(--balloon-sail)" />
        </g>
      </g>
    </g>
  );
}

// Where the main balloon stands at each level: on the grass, then a little
// higher and further downwind for every day kept after it lifts.
function mainPose(level: number) {
  if (level < 3) return { x: level === 2 ? 588 : 566, y: 512 };
  const up = level - 3;
  return { x: 600 + up * 11, y: 468 - up * 18.5 };
}

/**
 * The balloon at first light. A meadow before sunrise with the balloon slack
 * on the grass, and fourteen things that come as the morning does: the
 * burner lit, the balloon filled and aloft, then a little higher each kept
 * day over the river, the poplars, the sheep, the fields, a windmill and a
 * village, until it's in the open sky with the sun on it. A missed day sinks
 * it a little. Lighter each day: that's the dump.
 */
export function BalloonScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const pose = mainPose(level);
  const sunlit = has("sun");
  // The highest of the balloon's own stages, for its hover name.
  const balloonStage = ["aloft", "filled", "burner"].find(has);
  const balloonName = balloonStage
    ? SCENE.stages.find((s) => s.id === balloonStage)?.name
    : "the balloon, still on the grass";
  const growing = fresh.some((id) => id === "burner" || id === "filled");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={cn("balloon-scene", className)}
      defs={
        <>
          <linearGradient id="balloon-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--balloon-sky-1)" />
            <stop offset="55%" stopColor="var(--balloon-sky-2)" />
            <stop offset="100%" stopColor="var(--balloon-sky-3)" />
          </linearGradient>
          <radialGradient id="balloon-volume" cx="0.3" cy="0.32" r="0.9">
            <stop offset="0%" stopColor="var(--balloon-light)" />
            <stop offset="45%" stopColor="var(--balloon-light)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--balloon-shade)" />
          </radialGradient>
          <radialGradient id="balloon-inner" cx="0.5" cy="1" r="0.85">
            <stop offset="0%" stopColor="var(--balloon-inner)" />
            <stop offset="100%" stopColor="var(--balloon-inner)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="balloon-rim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="45%" stopColor="var(--balloon-sun)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--balloon-sun)" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="balloon-burn">
            <stop offset="0%" stopColor="var(--balloon-flame)" stopOpacity="var(--balloon-burn-glow)" />
            <stop offset="100%" stopColor="var(--balloon-flame)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="balloon-sun-glow">
            <stop offset="0%" stopColor="var(--balloon-sun)" stopOpacity="0.85" />
            <stop offset="30%" stopColor="var(--balloon-sun)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--balloon-sun)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="balloon-river" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--balloon-river-far)" />
            <stop offset="100%" stopColor="var(--balloon-river)" />
          </linearGradient>
          <pattern
            id="balloon-slack"
            width="36"
            height="40"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(12)"
          >
            <rect x={0} y={0} width={12} height={40} fill="var(--balloon-env-1)" />
            <rect x={12} y={0} width={12} height={40} fill="var(--balloon-env-2)" />
            <rect x={24} y={0} width={12} height={40} fill="var(--balloon-env-3)" />
          </pattern>
          <filter id="balloon-soft" x="-30%" y="-150%" width="160%" height="400%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <clipPath id="balloon-mid-clip">
            <path d="M0 446 C160 428 300 424 450 436 S720 462 860 448 S1060 420 1200 432 L1200 560 L0 560 Z" />
          </clipPath>
        </>
      }
    >
      <rect width="1200" height="560" fill="url(#balloon-sky)" />

      {/* The night's last stars: only the dark sky shows them. */}
      <g style={{ opacity: "var(--balloon-stars)" }}>
        {STARS.map((star, i) => (
          <circle
            key={i}
            data-fx="twinkle"
            cx={round(star.x)}
            cy={round(star.y)}
            r={round(0.5 + star.r * 1.3)}
            fill="var(--balloon-star)"
            opacity={round(0.45 + star.r * 0.55)}
            style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }}
          />
        ))}
      </g>

      {stage(
        "sun",
        <>
          <circle cx={1010} cy={322} r={320} fill="url(#balloon-sun-glow)" data-fx="halo" />
          <g data-fx="rays" stroke="var(--balloon-sun)" strokeWidth={3} strokeLinecap="round" opacity={0.4}>
            {Array.from({ length: 9 }, (_, i) => {
              const a = Math.PI + (i / 8) * Math.PI;
              return (
                <line
                  key={i}
                  x1={round(1010 + Math.cos(a) * 52)}
                  y1={round(322 + Math.sin(a) * 52)}
                  x2={round(1010 + Math.cos(a) * 80)}
                  y2={round(322 + Math.sin(a) * 80)}
                />
              );
            })}
          </g>
          <circle cx={1010} cy={322} r={36} fill="var(--balloon-sun)" />
        </>,
      )}

      {/* High wisps, there from the start. */}
      <g data-fx="drift" fill="var(--balloon-cloud)" opacity={0.6}>
        <ellipse cx={210} cy={126} rx={70} ry={11} />
        <ellipse cx={250} cy={116} rx={40} ry={10} />
        <ellipse cx={930} cy={96} rx={84} ry={10} />
        <ellipse cx={890} cy={88} rx={44} ry={9} />
      </g>

      {stage(
        "horizon",
        HORIZON.map(([x, y, s, d]) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
            <g data-fx="bob" style={{ animationDelay: `${d}s` }}>
              <Balloon colours={FAR[HORIZON.findIndex((h) => h[0] === x) % FAR.length]} detail={false} />
            </g>
          </g>
        )),
      )}

      {/* The far hills, hazy with distance. */}
      <path
        d="M0 372 C120 344 240 336 360 350 S600 382 720 366 S960 330 1080 340 S1170 352 1200 348 L1200 560 L0 560 Z"
        fill="var(--balloon-far)"
      />
      {stage(
        "village",
        <>
          {HOUSES.map(([x, w, h, wall, roof]) => (
            <g key={x}>
              <rect x={x - w / 2} y={348 - h} width={w} height={h + 4} fill={wall} />
              <path
                d={`M${x - w / 2 - 2} ${348 - h} L${x} ${348 - h - w * 0.55} L${x + w / 2 + 2} ${348 - h} Z`}
                fill={roof}
              />
              <rect x={x - 1.5} y={348 - h + 4} width={3} height={3} fill="var(--balloon-window)" />
            </g>
          ))}
          <rect x={244} y={300} width={12} height={52} fill="var(--balloon-steeple)" />
          <path d="M242 300 L250 270 L258 300 Z" fill="var(--balloon-roof-2)" />
          <line x1={250} y1={270} x2={250} y2={262} stroke="var(--balloon-steeple)" strokeWidth={1.5} />
          <rect x={247.5} y={312} width={5} height={7} rx={2.5} fill="var(--balloon-window)" />
        </>,
      )}
      {stage(
        "cloud",
        <g data-fx="drift" filter="url(#balloon-soft)" fill="var(--balloon-cloud)" opacity={0.55}>
          <ellipse cx={120} cy={318} rx={150} ry={11} />
          <ellipse cx={410} cy={308} rx={170} ry={12} />
          <ellipse cx={700} cy={320} rx={120} ry={9} />
          <ellipse cx={900} cy={306} rx={160} ry={11} />
          <ellipse cx={1150} cy={316} rx={130} ry={10} />
        </g>,
      )}

      {/* The ridge the windmill stands on. */}
      <path
        d="M0 412 C150 396 300 392 440 404 S700 428 820 404 S960 360 1040 368 S1160 388 1200 384 L1200 560 L0 560 Z"
        fill="var(--balloon-mid-far)"
      />
      {stage("windmill", <Windmill x={992} y={368} />)}

      {/* The fields: hedgerows from the start, colour when it comes. */}
      <path
        d="M0 446 C160 428 300 424 450 436 S720 462 860 448 S1060 420 1200 432 L1200 560 L0 560 Z"
        fill="var(--balloon-mid)"
      />
      <g clipPath="url(#balloon-mid-clip)">
        {stage(
          "fields",
          Array.from({ length: 11 }, (_, i) => {
            const x = -80 + i * 128;
            return (
              <path
                key={i}
                d={`M${x} 420 L${x + 128} 420 L${x + 86} 500 L${x - 42} 500 Z`}
                fill={`var(--balloon-field-${(i % 4) + 1})`}
                opacity={0.85}
              />
            );
          }),
        )}
        <g stroke="var(--balloon-hedge)" strokeWidth={2.2} opacity={0.7}>
          {Array.from({ length: 12 }, (_, i) => {
            const x = -80 + i * 128;
            return <line key={i} x1={x} y1={420} x2={x - 42} y2={500} />;
          })}
          <path d="M0 470 C200 458 420 462 620 474 S1000 460 1200 466" fill="none" />
        </g>
      </g>

      {/* The near meadow. */}
      <path
        d="M0 486 C180 470 360 468 520 478 S820 500 980 484 S1140 470 1200 474 L1200 560 L0 560 Z"
        fill="var(--balloon-near)"
      />

      {/* The foreground grass, which the river runs through to the frame's edge. */}
      <path d="M0 530 C200 518 400 526 600 534 S1000 522 1200 532 L1200 560 L0 560 Z" fill="var(--balloon-ground)" />
      {stage(
        "river",
        <>
          <path d={RIVER} fill="url(#balloon-river)" />
          <path d={RIVER} fill="none" stroke="var(--balloon-river-edge)" strokeWidth={2} opacity={0.7} />
          {RIVER_GLINTS.map(([x, y, w], i) => (
            <line
              key={x}
              data-fx="shimmer"
              x1={x - w / 2}
              y1={y}
              x2={x + w / 2}
              y2={y - w * 0.12}
              stroke="var(--balloon-shine)"
              strokeWidth={1.6}
              strokeLinecap="round"
              opacity={0.75}
              style={{ animationDelay: `${i * -0.6}s` }}
            />
          ))}
        </>,
      )}
      {stage(
        "poplars",
        POPLARS.map(([x, y, s]) => <Poplar key={x} x={x} y={y} s={s} />),
      )}

      <g stroke="var(--balloon-grass)" strokeWidth={1.8} strokeLinecap="round">
        {TUFTS.map((t, i) =>
          // No grass in the water.
          has("river") && t.x > 200 && t.x < 340 ? null : (
            <g key={i} data-fx="sway" style={{ animationDelay: `${(t.r * -9).toFixed(2)}s` }}>
              <line x1={round(t.x)} y1={round(t.y)} x2={round(t.x - 3)} y2={round(t.y - 9 - t.r * 6)} />
              <line x1={round(t.x + 3)} y1={round(t.y)} x2={round(t.x + 5)} y2={round(t.y - 7 - t.r * 5)} />
            </g>
          ),
        )}
      </g>

      {stage(
        "sheep",
        SHEEP.map(([x, y, s, flip]) => <Sheep key={x} x={x} y={y} s={s} flip={flip} />),
      )}

      {stage(
        "second",
        <g transform="translate(292 262) scale(0.42)">
          <g data-fx="bob" style={{ animationDelay: "-2.5s" }}>
            <Balloon colours={SECOND} flame />
          </g>
        </g>,
      )}

      {stage(
        "swallows",
        SWALLOWS.map(([x, y, d]) => (
          <path
            key={x}
            data-fx="glide"
            d={`M${x - 11} ${y - 3} Q${x - 5} ${y - 7} ${x} ${y} Q${x + 5} ${y - 7} ${x + 11} ${y - 3} M${x} ${y} l-3 5 M${x} ${y} l3 5`}
            stroke="var(--balloon-bird)"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            style={{ animationDelay: `${d}s` }}
          />
        )),
      )}

      {/* The balloon: slack on the grass, filling, standing, then rising. */}
      <g
        className="balloon-rise"
        style={{
          transform: `translate(${round(pose.x)}px, ${round(pose.y)}px) scale(0.8)`,
        }}
      >
        <g data-stage={balloonStage ?? "base"} {...(growing ? { "data-grow": "" } : {})}>
          <title>{balloonName}</title>
          {level === 0 && (
            <>
              <path
                d="M14 -2 C30 -20 80 -30 150 -28 C210 -26 252 -18 258 -8 C262 -2 256 2 246 2 L14 2 Z"
                fill="url(#balloon-slack)"
              />
              <path
                d="M14 -2 C30 -20 80 -30 150 -28 C210 -26 252 -18 258 -8 C262 -2 256 2 246 2 L14 2 Z"
                fill="var(--balloon-shade)"
                opacity={0.35}
              />
              <g stroke="var(--balloon-seam)" strokeWidth={1.4} fill="none" strokeLinecap="round">
                <path d="M60 -18 C90 -10 122 -12 152 -22" />
                <path d="M118 -4 C150 -12 190 -14 226 -8" />
              </g>
              <path d="M10 -30 C18 -26 20 -12 26 -4" fill="none" stroke="var(--balloon-rope)" strokeWidth={1.4} />
              <Basket rigged={false} />
            </>
          )}
          {level === 1 && (
            <>
              <Flame />
              <g transform="translate(0 -70) rotate(58) scale(0.8 0.9)">
                <Envelope colours={MAIN} glow />
              </g>
              <Basket />
            </>
          )}
          {level === 2 && (
            <>
              <line x1={-17} y1={-8} x2={-74} y2={2} stroke="var(--balloon-rope)" strokeWidth={1.6} />
              <rect x={-78} y={-6} width={5} height={12} rx={1.5} fill="var(--balloon-basket-dark)" />
              <Balloon colours={MAIN} flame />
            </>
          )}
          {level >= 3 && (
            <g data-fx="bob">
              <Balloon colours={MAIN} flame rim={sunlit} />
            </g>
          )}
        </g>
      </g>

      {sunlit && <rect width="1200" height="560" fill="var(--balloon-sun)" opacity={0.07} pointerEvents="none" />}
    </SceneSvg>
  );
}

/**
 * The balloon on its own, flat-coloured and self-contained, for a stamp or a
 * mark: no gradients that would need a scene's defs on the page.
 */
export function BalloonGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="-70 -262 140 268" className={className} aria-hidden>
      <g transform="translate(0 -70)">
        {GORES.map((d, i) => (
          <path key={i} d={d} fill={MAIN[i % MAIN.length]} />
        ))}
        <path d={OUTLINE} fill="none" stroke="var(--balloon-seam)" strokeWidth={4} />
        <path d="M-12 0 L12 0 L9 8 L-9 8 Z" fill="var(--balloon-skirt)" />
      </g>
      <Basket detail={false} />
    </svg>
  );
}
