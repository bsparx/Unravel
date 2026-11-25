import { SCENES } from "@/lib/scenes";

import { SceneSvg, riverPath, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.prayer;

const STARS = scatter(37, 60, { x: [10, 1190], y: [10, 230] });
const SNOW = scatter(53, 70, { x: [0, 1200], y: [0, 520] });
const DRIFTS = scatter(29, 40, { x: [0, 1200], y: [440, 552] });

const PEAKS =
  "M0 300 L80 222 L150 262 L240 160 L330 250 L420 192 L520 270 L600 206 L700 280 L780 170 L880 250 L960 192 L1060 262 L1140 204 L1200 236 L1200 560 L0 560 Z";
/** The tips of the range, for snowcaps and the dawn's light: x, y, half-width. */
const TIPS: [number, number, number][] = [
  [80, 222, 22],
  [240, 160, 34],
  [420, 192, 28],
  [600, 206, 26],
  [780, 170, 34],
  [960, 192, 28],
  [1140, 204, 24],
];

const STREAM = riverPath([
  [790, 352, 5],
  [740, 378, 8],
  [680, 404, 12],
  [630, 432, 16],
  [590, 462, 20],
  [560, 500, 28],
  [540, 540, 36],
  [530, 580, 44],
] as const);

const TRODDEN = "M1000 560 C900 520 760 482 640 462 S440 446 360 432";

const HILL_HOUSES: [number, number][] = [
  [720, 402],
  [800, 392],
  [880, 380],
  [960, 366],
  [1040, 356],
];
const RIDGE_HOUSES: [number, number][] = [
  [900, 336],
  [970, 326],
  [1040, 318],
  [1110, 312],
  [1168, 308],
];

/** A cottage under snow; `lit` warms its window. */
function Cottage({ x, base, w = 34, h = 22, lit = false }: { x: number; base: number; w?: number; h?: number; lit?: boolean }) {
  return (
    <g>
      <rect x={x - w / 2} y={base - h} width={w} height={h} fill="var(--town-wall)" />
      <rect x={x - w / 2} y={base - h} width={w * 0.25} height={h} fill="var(--town-wall-shade)" opacity={0.6} />
      <path d={`M${x - w / 2 - 5} ${base - h + 2} L${x} ${base - h - w * 0.42} L${x + w / 2 + 5} ${base - h + 2} Z`} fill="var(--town-wood)" />
      <path d={`M${x - w / 2 - 6} ${base - h} L${x} ${base - h - w * 0.46} L${x + w / 2 + 6} ${base - h} L${x + w / 2 + 2} ${base - h + 3} L${x} ${base - h - w * 0.38} L${x - w / 2 - 2} ${base - h + 3} Z`} fill="var(--town-snowcap)" />
      <rect x={x + w * 0.12} y={base - h * 0.7} width={w * 0.22} height={h * 0.32} rx={1} fill={lit ? "var(--town-lit)" : "var(--town-window)"} />
      <rect x={x - w * 0.3} y={base - h * 0.55} width={w * 0.18} height={h * 0.55} fill="var(--town-wood)" />
    </g>
  );
}

function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-3} y={-8} width={6} height={10} fill="var(--town-wood)" />
      <path d="M0 -96 L22 -54 L11 -54 L28 -22 L14 -22 L34 4 L-34 4 L-14 -22 L-28 -22 L-11 -54 L-22 -54 Z" fill="var(--town-pine)" />
      <path d="M0 -96 L10 -78 L-10 -78 Z M-14 -54 L-4 -60 L6 -54 L14 -50 L-18 -50 Z M-20 -22 L-6 -28 L8 -22 L22 -18 L-24 -18 Z" fill="var(--town-snowcap)" />
    </g>
  );
}

function Person({ x, y, s = 1, tone = 1 }: { x: number; y: number; s?: number; tone?: 1 | 2 | 3 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-6 0 L6 0 L5 -17 C5 -22 -5 -22 -5 -17 Z" fill={`var(--town-cloth-${tone})`} />
      <circle cx={0} cy={-24} r={4.4} fill="var(--town-skin)" />
      <path d="M-5 -26 Q0 -32 5 -26" fill={`var(--town-cloth-${tone})`} />
    </g>
  );
}

function Lamp({ x, y, post = true }: { x: number; y: number; post?: boolean }) {
  return (
    <g>
      {post && <line x1={x} y1={y} x2={x} y2={y - 30} stroke="var(--town-wood)" strokeWidth={2.4} />}
      <circle cx={x} cy={y - 34} r={20} fill="url(#town-glow)" data-fx="glow" />
      <rect x={x - 4} y={y - 40} width={8} height={10} rx={2} fill="var(--town-lamp)" />
      <path d={`M${x - 6} ${y - 40} L${x} ${y - 45} L${x + 6} ${y - 40} Z`} fill="var(--town-wood)" />
    </g>
  );
}

/** An eight-point star, for the lattice in the dome. */
function eightPoint(cx: number, cy: number, r: number) {
  const square = (turn: number) =>
    [0, 1, 2, 3]
      .map((i) => {
        const a = turn + (i * Math.PI) / 2;
        return `${round(cx + r * Math.cos(a))} ${round(cy + r * Math.sin(a))}`;
      })
      .join(" L");
  return `M${square(Math.PI / 4)} Z M${square(0)} Z`;
}

/**
 * The lamplit town (the five daily prayers). "Prayer is light" (Sahih Muslim
 * 223): a dark valley in the snow with the masjid unlit, and sixty things
 * that come to it, one for each day all five prayers are prayed: a lamp at
 * the masjid door, a trodden path, a window, then cottages and houses up the
 * hill, the minaret's lamp, families walking to prayer, until every window
 * is lit, the night thins, and Fajr breaks over the peaks.
 */
export function TownScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const starsShown = has("stars-fade") ? 0.4 : 1;
  const allLit = has("all-windows");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="town-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--town-sky-1)" />
            <stop offset="60%" stopColor="var(--town-sky-2)" />
            <stop offset="100%" stopColor="var(--town-sky-3)" />
          </linearGradient>
          <linearGradient id="town-fajr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--town-fajr)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--town-fajr)" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="town-aurora" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--town-aurora-1)" stopOpacity="0" />
            <stop offset="40%" stopColor="var(--town-aurora-1)" stopOpacity="0.55" />
            <stop offset="75%" stopColor="var(--town-aurora-2)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--town-aurora-2)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="town-glow">
            <stop offset="0%" stopColor="var(--town-lamp)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--town-lamp)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="town-warm" cx="0.4" cy="0.75" r="0.6">
            <stop offset="0%" stopColor="var(--town-lamp)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--town-lamp)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="town-ice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--town-ice)" />
            <stop offset="100%" stopColor="var(--town-ice-edge)" />
          </linearGradient>
          <filter id="town-blur" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="town-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </>
      }
    >
      {/* The sky: stars, the moon, the northern lights, and the dawn coming. */}
      <rect width="1200" height="560" fill="url(#town-sky)" />
      {stage("sky-pale", <rect width="1200" height="300" fill="var(--town-sky-3)" opacity={0.3} />)}
      {stage("fajr", <rect x={0} y={150} width={1200} height={150} fill="url(#town-fajr)" />)}
      {stage(
        "stars",
        <g style={{ opacity: `calc(var(--town-stars) * ${starsShown})` }}>
          {STARS.map((star, i) => (
            <circle key={i} data-fx="twinkle" cx={round(star.x)} cy={round(star.y)} r={round(0.5 + star.r * 1.3)} fill="var(--town-star)" opacity={round(0.45 + star.r * 0.5)} style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }} />
          ))}
        </g>,
      )}
      {stage("stars-fade", <rect width="1200" height="140" fill="var(--town-sky-2)" opacity={0.15} />)}
      {stage(
        "aurora",
        <g data-fx="drift" filter="url(#town-blur)">
          <path d="M100 120 C300 60 520 150 740 80 S1040 110 1160 60 L1160 110 C1040 160 900 120 740 140 S300 120 100 170 Z" fill="url(#town-aurora)" />
        </g>,
      )}
      {stage(
        "moon",
        <g>
          <circle cx={1010} cy={92} r={70} fill="var(--town-moon)" opacity={0.12} filter="url(#town-blur)" />
          <circle cx={1010} cy={92} r={22} fill="var(--town-moon)" />
          <circle cx={1002} cy={86} r={4} fill="var(--town-peak)" opacity={0.18} />
        </g>,
      )}

      {/* The range, its snow, and the first light on it. */}
      <path d={PEAKS} fill="var(--town-peak)" />
      <path d="M240 160 L330 250 L290 260 Z M780 170 L880 250 L830 262 Z M420 192 L520 270 L480 274 Z M960 192 L1060 262 L1020 266 Z" fill="var(--town-peak-shade)" />
      {TIPS.map(([x, y, w]) => (
        <path key={x} d={`M${x} ${y} L${x + w} ${y + w * 0.9} L${x + w * 0.4} ${y + w * 0.7} L${x} ${y + w * 1.1} L${x - w * 0.4} ${y + w * 0.7} L${x - w} ${y + w * 0.9} Z`} fill="var(--town-snowcap)" />
      ))}
      {stage(
        "peak-glow",
        <g fill="var(--town-rose)" opacity={0.6}>
          {TIPS.map(([x, y, w]) => (
            <path key={x} d={`M${x} ${y} L${x + w} ${y + w * 0.9} L${x + w * 0.4} ${y + w * 0.7} Z`} />
          ))}
        </g>,
      )}

      {/* Across the valley. */}
      <path d="M0 332 C200 302 400 312 600 322 S1000 302 1200 312 L1200 560 L0 560 Z" fill="var(--town-far-hill)" />
      {stage(
        "far-village",
        <g>
          {[90, 130, 170, 214, 256, 298].map((vx, i) => (
            <g key={vx}>
              <rect x={vx - 7} y={322 - (i % 2) * 4} width={14} height={8} fill="var(--town-snow-deep)" />
              <rect x={vx - 1.5} y={325 - (i % 2) * 4} width={3} height={3} fill="var(--town-lit)" />
            </g>
          ))}
        </g>,
      )}

      {/* The near slope the town climbs. */}
      <path d="M0 400 C200 380 380 372 560 372 S860 352 1000 332 S1140 320 1200 318 L1200 560 L0 560 Z" fill="var(--town-snow-shade)" />
      <path d="M0 430 C260 420 520 430 760 442 S1060 430 1200 420 L1200 560 L0 560 Z" fill="var(--town-snow)" />
      <g>
        <title>{SCENE.base}</title>
        {DRIFTS.map((d, i) => (
          <ellipse key={i} cx={round(d.x)} cy={round(d.y)} rx={round(12 + d.r * 22)} ry={round(2 + d.r * 2)} fill="var(--town-snow-shade)" opacity={0.6} />
        ))}
      </g>
      {stage(
        "snow-rose",
        <path d="M0 430 C260 420 520 430 760 442 S1060 430 1200 420 L1200 560 L0 560 Z" fill="var(--town-rose)" opacity={0.14} />,
      )}
      {stage("blue-light", <rect y={300} width="1200" height="260" fill="var(--town-blue)" opacity={0.1} />)}

      {/* Up the hill: the high hut, the ridge, the houses. */}
      {stage("hut", <Cottage x={1100} base={296} w={24} h={16} lit />)}
      {stage(
        "hut-path",
        [
          [1060, 316],
          [1080, 306],
        ].map(([lx, ly], i) => (
          <g key={i}>
            <circle cx={lx} cy={ly - 4} r={8} fill="url(#town-glow)" data-fx="glow" />
            <circle cx={lx} cy={ly - 4} r={1.8} fill="var(--town-lamp)" />
          </g>
        )),
      )}
      {stage(
        "ridge-houses",
        RIDGE_HOUSES.map(([hx, hy]) => <Cottage key={hx} x={hx} base={hy} w={26} h={16} lit={allLit} />),
      )}
      {stage(
        "ridge-windows",
        RIDGE_HOUSES.map(([hx, hy]) => <rect key={hx} x={hx + 3} y={hy - 11} width={6} height={5} rx={1} fill="var(--town-lit)" />),
      )}
      {stage(
        "houses",
        HILL_HOUSES.map(([hx, hy]) => <Cottage key={hx} x={hx} base={hy} w={30} h={20} lit={allLit} />),
      )}
      {stage(
        "windows",
        HILL_HOUSES.slice(0, 3).map(([hx, hy]) => (
          <g key={hx}>
            <circle cx={hx + 7} cy={hy - 11} r={10} fill="url(#town-glow)" />
            <rect x={hx + 3.6} y={hy - 14} width={6.6} height={6.4} rx={1} fill="var(--town-lit)" />
          </g>
        )),
      )}
      {stage(
        "all-windows",
        <g>
          {HILL_HOUSES.concat(RIDGE_HOUSES).map(([hx, hy]) => (
            <circle key={hx} cx={hx + 6} cy={hy - 11} r={12} fill="url(#town-glow)" />
          ))}
        </g>,
      )}

      {/* The masjid and its minaret. */}
      {stage(
        "minaret",
        <g>
          <rect x={462} y={258} width={16} height={166} fill="var(--town-wall)" />
          <rect x={462} y={258} width={5} height={166} fill="var(--town-wall-shade)" opacity={0.6} />
          <rect x={456} y={300} width={28} height={6} rx={2} fill="var(--town-wall-shade)" />
          <rect x={456} y={296} width={28} height={4} fill="var(--town-snowcap)" />
          <path d="M460 258 L470 226 L480 258 Z" fill="var(--town-dome)" />
          <path d="M464 252 L470 232 L476 252 Z" fill="var(--town-snowcap)" opacity={0.5} />
          <circle cx={470} cy={222} r={3} fill="var(--town-dome)" />
        </g>,
      )}
      {stage(
        "minaret-lamp",
        <g>
          <circle cx={470} cy={284} r={28} fill="url(#town-glow)" data-fx="glow" />
          <rect x={465} y={276} width={10} height={14} rx={4} fill="var(--town-lit)" />
        </g>,
      )}
      {stage("minaret-light", <path d="M474 232 L480 258 L478 424 L474 424 Z" fill="var(--town-rose)" opacity={0.55} />)}
      <g>
        {/* The masjid, dark until its first light. */}
        <rect x={280} y={368} width={160} height={56} fill="var(--town-wall)" />
        <rect x={280} y={368} width={40} height={56} fill="var(--town-wall-shade)" opacity={0.55} />
        <rect x={274} y={362} width={172} height={8} rx={2} fill="var(--town-snowcap)" />
        <path d="M318 368 C318 316 402 316 402 368 Z" fill="var(--town-dome)" />
        <path d="M330 340 C346 320 374 320 390 340 C372 332 348 332 330 340 Z" fill="var(--town-snowcap)" />
        <line x1={360} y1={322} x2={360} y2={308} stroke="var(--town-dome)" strokeWidth={2} />
        <path d="M356 306 A4 4 0 1 0 364 310 A3.2 3.2 0 1 1 356 306 Z" fill="var(--town-lit)" />
        {[300, 420].map((wx) => (
          <path key={wx} d={`M${wx - 7} 404 L${wx - 7} 390 A7 7 0 0 1 ${wx + 7} 390 L${wx + 7} 404 Z`} fill="var(--town-window)" />
        ))}
        <path d="M350 424 L350 402 A10 10 0 0 1 370 402 L370 424 Z" fill="var(--town-wood)" />
      </g>
      {stage(
        "dome",
        <g>
          <path d="M318 368 C318 316 402 316 402 368 Z" fill="var(--town-lit)" opacity={0.28} />
          <circle cx={360} cy={346} r={50} fill="url(#town-glow)" opacity={0.6} />
        </g>,
      )}
      {stage(
        "dome-lattice",
        <g>
          {[336, 360, 384].map((sx) => (
            <path key={sx} d={eightPoint(sx, 354, 6)} fill="var(--town-lit)" fillRule="evenodd" opacity={0.85} />
          ))}
        </g>,
      )}
      {stage(
        "masjid-window",
        [300, 420].map((wx) => (
          <g key={wx}>
            <circle cx={wx} cy={396} r={16} fill="url(#town-glow)" data-fx="glow" />
            <path d={`M${wx - 7} 404 L${wx - 7} 390 A7 7 0 0 1 ${wx + 7} 390 L${wx + 7} 404 Z`} fill="var(--town-lit)" />
          </g>
        )),
      )}
      {stage(
        "arch-lanterns",
        [326, 394].map((ax) => (
          <g key={ax}>
            <line x1={ax} y1={372} x2={ax} y2={382} stroke="var(--town-wood)" strokeWidth={1} />
            <circle cx={ax} cy={388} r={11} fill="url(#town-glow)" data-fx="glow" />
            <rect x={ax - 3} y={383} width={6} height={9} rx={2} fill="var(--town-lamp)" />
          </g>
        )),
      )}
      {stage(
        "door-open",
        <g>
          <circle cx={360} cy={414} r={34} fill="url(#town-glow)" data-fx="glow" />
          <path d="M350 424 L350 402 A10 10 0 0 1 370 402 L370 424 Z" fill="var(--town-lit)" />
        </g>,
      )}
      {stage(
        "rows",
        <g fill="var(--town-wood)" opacity={0.75}>
          {[354, 360, 366].map((rx) => (
            <circle key={rx} cx={rx} cy={416} r={2.4} />
          ))}
          {[296, 304, 416, 424].map((rx) => (
            <circle key={rx} cx={rx} cy={400} r={2} />
          ))}
        </g>,
      )}
      {stage(
        "icicles",
        <g fill="var(--town-ice)">
          {Array.from({ length: 16 }, (_, i) => 280 + i * 10).map((ix, i) => (
            <path key={ix} d={`M${ix} 370 L${ix + 3} 370 L${ix + 1.5} ${376 + (i % 3) * 3} Z`} />
          ))}
        </g>,
      )}
      {stage("door-lamp", <Lamp x={384} y={424} post={false} />)}
      {stage(
        "courtyard",
        <path d="M262 440 L500 440 L520 460 L246 460 Z" fill="var(--town-snow)" opacity={0.9} />,
      )}
      <rect x={262} y={424} width={238} height={14} fill="var(--town-wall-shade)" />
      <rect x={258} y={420} width={246} height={5} rx={2} fill="var(--town-snowcap)" />
      <rect x={350} y={424} width={20} height={14} fill="var(--town-snow-shade)" />
      {stage(
        "courtyard-lamps",
        [270, 494].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={414} r={14} fill="url(#town-glow)" data-fx="glow" />
            <rect x={cx - 3} y={410} width={6} height={9} rx={1.5} fill="var(--town-lamp)" />
          </g>
        )),
      )}
      {stage(
        "boots",
        <g fill="var(--town-wood)">
          {[338, 346, 376, 384].map((bx) => (
            <rect key={bx} x={bx} y={430} width={6} height={5} rx={1.5} />
          ))}
        </g>,
      )}

      {/* The stream, frozen, and the bridge over it. */}
      <path d={STREAM} fill="url(#town-ice)" />
      <path d={STREAM} fill="none" stroke="var(--town-snowcap)" strokeWidth={1.4} opacity={0.6} />
      {stage(
        "ice-light",
        [
          [700, 396],
          [636, 432],
          [580, 478],
          [548, 520],
        ].map(([ix, iy], i) => <ellipse key={i} data-fx="shimmer" cx={ix} cy={iy} rx={9} ry={1.8} fill="var(--town-lamp)" opacity={0.7} style={{ animationDelay: `${i * -0.6}s` }} />),
      )}
      {stage(
        "stream-gold",
        [
          [710, 390],
          [600, 456],
          [552, 530],
        ].map(([ix, iy], i) => <ellipse key={i} data-fx="shimmer" cx={ix} cy={iy} rx={14} ry={2} fill="var(--town-fajr)" opacity={0.8} style={{ animationDelay: `${i * -0.5}s` }} />),
      )}

      {/* The path, and the way along it. */}
      {stage("path", <path d={TRODDEN} stroke="var(--town-path)" strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.9} />)}
      {stage(
        "footprints",
        <g fill="var(--town-snow-deep)">
          {Array.from({ length: 18 }, (_, i) => {
            const t = (i + 0.5) / 18;
            const x = round(1000 - 640 * t);
            const y = round(560 - 128 * t + Math.sin(t * Math.PI) * 18);
            return <ellipse key={i} cx={x + (i % 2 ? 3 : -3)} cy={y} rx={2.2} ry={1.2} />;
          })}
        </g>,
      )}
      {stage(
        "bridge",
        <g>
          <path d="M580 470 Q612 446 646 464" stroke="var(--town-wood)" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M584 458 Q612 436 642 452" stroke="var(--town-wood)" strokeWidth={2} fill="none" />
          <path d="M582 466 Q612 442 644 460" stroke="var(--town-snowcap)" strokeWidth={2.4} fill="none" />
        </g>,
      )}
      {stage(
        "bridge-lanterns",
        [584, 642].map((bx) => (
          <g key={bx}>
            <circle cx={bx} cy={446} r={12} fill="url(#town-glow)" data-fx="glow" />
            <rect x={bx - 3} y={442} width={6} height={8} rx={1.5} fill="var(--town-lamp)" />
          </g>
        )),
      )}
      {stage("post-lantern", <Lamp x={700} y={476} />)}
      {stage(
        "path-lamps",
        <g>
          <Lamp x={880} y={520} />
          <Lamp x={520} y={456} />
          <Lamp x={444} y={446} />
        </g>,
      )}

      {/* Life along the lane. */}
      {stage(
        "well",
        <g>
          <ellipse cx={184} cy={478} rx={20} ry={6} fill="var(--town-snow-deep)" />
          <rect x={166} y={462} width={36} height={16} fill="var(--town-wall-shade)" />
          <line x1={170} y1={462} x2={170} y2={440} stroke="var(--town-wood)" strokeWidth={2.4} />
          <line x1={198} y1={462} x2={198} y2={440} stroke="var(--town-wood)" strokeWidth={2.4} />
          <path d="M162 442 L184 428 L206 442 Z" fill="var(--town-snowcap)" />
        </g>,
      )}
      {stage("cottage", <Cottage x={780} base={470} w={52} h={32} lit={has("cottage-light")} />)}
      {stage(
        "cottage-light",
        <circle cx={790} cy={452} r={20} fill="url(#town-glow)" data-fx="glow" />,
      )}
      {stage(
        "smoke",
        <g fill="var(--town-smoke)" filter="url(#town-soft)">
          {[0, 1, 2].map((i) => (
            <ellipse key={i} data-fx="smoke" cx={796 + i * 7} cy={424 - i * 11} rx={4 + i * 3} ry={3 + i * 2} style={{ animationDelay: `${i * -1.6}s` }} />
          ))}
        </g>,
      )}
      {stage(
        "chimneys",
        <g fill="var(--town-smoke)" filter="url(#town-soft)">
          {HILL_HOUSES.concat(RIDGE_HOUSES).map(([hx, hy], k) =>
            [0, 1].map((i) => (
              <ellipse key={`${k}-${i}`} data-fx="smoke" cx={hx - 4 + i * 5} cy={hy - 30 - i * 9} rx={3 + i * 2} ry={2 + i * 1.5} style={{ animationDelay: `${(k + i) * -1.1}s` }} />
            )),
          )}
        </g>,
      )}
      {stage(
        "lane-lanterns",
        <g>
          <path d="M806 434 Q920 462 1040 432" stroke="var(--town-wood)" strokeWidth={1} fill="none" />
          {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((t) => {
            const x = round(806 + 234 * t);
            const y = round(434 + 28 * 4 * t * (1 - t) - 2 * t);
            return (
              <g key={t}>
                <circle cx={x} cy={y + 4} r={8} fill="url(#town-glow)" data-fx="glow" />
                <circle cx={x} cy={y + 4} r={2.4} fill="var(--town-lamp)" />
              </g>
            );
          })}
        </g>,
      )}
      {stage(
        "bakery",
        <g>
          <Cottage x={1060} base={458} w={56} h={34} lit />
          <circle cx={1072} cy={440} r={22} fill="url(#town-glow)" data-fx="glow" />
          <rect x={1040} y={448} width={30} height={4} fill="var(--town-wood)" />
        </g>,
      )}
      {stage(
        "teahouse",
        <g>
          <Cottage x={1150} base={470} w={46} h={28} lit />
          <path data-fx="steam" d="M1156 448 q-4 -6 2 -10 q4 -4 0 -8" stroke="var(--town-smoke)" strokeWidth={1.4} fill="none" />
        </g>,
      )}
      {stage(
        "snowman",
        <g>
          <circle cx={846} cy={512} r={12} fill="var(--town-snowcap)" />
          <circle cx={846} cy={494} r={8} fill="var(--town-snowcap)" />
          <path d="M846 494 l6 2 l-6 1 Z" fill="var(--town-fox)" />
          <path d="M838 488 L854 488 L852 482 L840 482 Z" fill="var(--town-cloth-2)" />
        </g>,
      )}
      {stage(
        "sled",
        <g>
          <rect x={724} y={484} width={30} height={5} rx={2} fill="var(--town-cloth-2)" />
          <path d="M720 492 Q740 496 760 490" stroke="var(--town-wood)" strokeWidth={2} fill="none" />
        </g>,
      )}
      {stage(
        "sledge",
        <g>
          <path d="M930 532 Q960 538 994 530" stroke="var(--town-wood)" strokeWidth={2.4} fill="none" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => <circle key={`${r}-${c}`} cx={940 + c * 12 + (r % 2) * 6} cy={524 - r * 7} r={4} fill="var(--town-wood)" />),
          )}
        </g>,
      )}
      {stage(
        "deer",
        <g fill="var(--town-deer)">
          {[
            [150, 412, 1],
            [182, 418, -1],
          ].map(([dx, dy, f], i) => (
            <g key={i} transform={`translate(${dx} ${dy}) scale(${f * 0.85} 0.85)`}>
              <ellipse cx={0} cy={-12} rx={12} ry={6} />
              <path d="M9 -15 L15 -26 L19 -24 L13 -12 Z" />
              <path d="M15 -27 l-3 -7 M17 -27 l3 -6" stroke="var(--town-deer)" strokeWidth={1.4} />
              {[-8, -4, 5, 9].map((lx) => (
                <rect key={lx} x={lx} y={-8} width={2} height={9} />
              ))}
            </g>
          ))}
        </g>,
      )}
      {stage(
        "fox",
        <g transform="translate(250 520)" fill="var(--town-fox)">
          <ellipse cx={0} cy={-8} rx={12} ry={5.5} />
          <path d="M10 -12 L19 -10 L12 -4 Z" />
          <path d="M11 -12 l1 -6 l3 4 Z" />
          <path d="M-11 -8 q-14 -2 -18 6 q8 0 16 -2 Z" />
          <path d="M-29 -2 l-3 0 l2 -3 Z" fill="var(--town-snowcap)" />
        </g>,
      )}
      {stage(
        "birds",
        [
          [786, 434],
          [1050, 420],
          [300, 362],
        ].map(([bx, by], i) => (
          <g key={i} transform={`translate(${bx} ${by})`} fill="var(--town-wood)">
            <ellipse cx={0} cy={0} rx={4.4} ry={3.2} />
            <circle cx={3.6} cy={-2.6} r={2.2} />
          </g>
        )),
      )}

      {/* People going to pray. */}
      {stage(
        "walker",
        <g>
          <Person x={820} y={514} tone={1} />
        </g>,
      )}
      {stage(
        "families",
        <g>
          <Person x={668} y={474} tone={2} />
          <Person x={684} y={478} s={0.7} tone={3} />
          <Person x={560} y={458} tone={3} />
        </g>,
      )}
      {stage(
        "crowd",
        <g>
          {[318, 332, 396, 410, 424].map((cx, i) => (
            <Person key={cx} x={cx} y={446} s={0.8} tone={((i % 3) + 1) as 1 | 2 | 3} />
          ))}
        </g>,
      )}

      {/* The pines, and the owl in them. */}
      {stage(
        "pines",
        <g>
          <Pine x={40} y={470} s={1.1} />
          <Pine x={96} y={490} s={0.9} />
          <Pine x={1186} y={520} s={1.2} />
          <Pine x={1130} y={548} s={0.9} />
        </g>,
      )}
      {stage(
        "owl",
        <g transform="translate(48 424)">
          <ellipse cx={0} cy={0} rx={7} ry={9} fill="var(--town-owl)" />
          <circle cx={-2.6} cy={-3} r={2.2} fill="var(--town-lit)" />
          <circle cx={2.6} cy={-3} r={2.2} fill="var(--town-lit)" />
        </g>,
      )}

      {/* Snow falling, and the warmth over everything. */}
      {stage(
        "snowfall",
        <g fill="var(--town-snowcap)">
          {SNOW.map((f, i) => (
            <circle key={i} data-fx="snow" cx={round(f.x)} cy={round(f.y)} r={round(1 + f.r * 1.6)} opacity={0.85} style={{ animationDelay: `${(f.r * -9).toFixed(2)}s` }} />
          ))}
        </g>,
      )}
      {stage("glow", <rect width="1200" height="560" fill="url(#town-warm)" pointerEvents="none" />)}
    </SceneSvg>
  );
}
