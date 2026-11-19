import { SCENES } from "@/lib/scenes";

import { SceneSvg, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.recitation;

const STARS = scatter(29, 48, { x: [10, 1190], y: [10, 220] });

/** Where the sun comes up: low, a little right of centre, behind the far dunes. */
const SUN = { x: 720, y: 318 };

const FAR_DUNES =
  "M0 352 C120 318 240 306 360 326 C470 344 560 300 700 300 C820 300 900 336 1010 322 C1100 310 1160 318 1200 326 L1200 560 L0 560 Z";
const MID_DUNES =
  "M0 400 C140 368 270 362 390 386 C470 402 540 404 620 396 C720 386 820 360 940 370 C1040 378 1120 392 1200 384 L1200 560 L0 560 Z";

/**
 * A date palm: a gently curving trunk with its rings, and a crown of fronds
 * in two greens, the far ones darker. `lean` tips the crown sideways.
 */
function Palm({ x, base, top, lean = 0, scale = 1 }: { x: number; base: number; top: number; lean?: number; scale?: number }) {
  const crownX = x + lean;
  const midX = x + lean * 0.35;
  const w = 7 * scale;
  const trunk = `M${x - w} ${base} Q${round(midX - w * 0.8)} ${round((base + top) / 2)} ${round(crownX - w * 0.55)} ${top} L${round(crownX + w * 0.55)} ${top} Q${round(midX + w * 0.8)} ${round((base + top) / 2)} ${x + w} ${base} Z`;
  const rings = Array.from({ length: Math.floor((base - top) / (16 * scale)) }, (_, i) => {
    const t = (i + 1) / (Math.floor((base - top) / (16 * scale)) + 1);
    const y = round(base - (base - top) * t);
    const cx = round(x + lean * t * t * 0.9);
    return `M${round(cx - w * 0.9)} ${y} q${round(w * 0.9)} ${round(-3 * scale)} ${round(w * 1.8)} 0`;
  });
  // A frond is a curved leaf, filled: its two edges bow out either side of
  // the midrib, widest a little past the middle, and meet at the tip.
  const frond = (deg: number, length: number, width: number) => {
    const a = (deg * Math.PI) / 180 - Math.PI / 2;
    const ex = crownX + Math.cos(a) * length * scale;
    const ey = top + Math.sin(a) * length * 0.42 * scale + Math.abs(deg) * 0.62 * scale;
    const cx = crownX + Math.cos(a) * length * 0.5 * scale;
    const cy = top - 20 * scale + Math.sin(a) * length * 0.3 * scale;
    const len = Math.hypot(ex - crownX, ey - top) || 1;
    const px = (-(ey - top) / len) * width * scale;
    const py = ((ex - crownX) / len) * width * scale;
    return {
      leaf: `M${crownX} ${top} Q${round(cx + px)} ${round(cy + py)} ${round(ex)} ${round(ey)} Q${round(cx - px)} ${round(cy - py)} ${crownX} ${top} Z`,
      rib: `M${crownX} ${top} Q${round(cx)} ${round(cy)} ${round(ex)} ${round(ey)}`,
    };
  };
  return (
    <g data-fx="sway">
      <path d={trunk} fill="var(--oasis-palm-trunk)" />
      <path d={rings.join(" ")} stroke="var(--oasis-palm-ring)" strokeWidth={1.6 * scale} fill="none" />
      {[-140, -95, -50, 0, 50, 95, 140].map((deg) => (
        <path key={`b${deg}`} d={frond(deg, 112, 11).leaf} fill="var(--oasis-palm-2)" />
      ))}
      {[-160, -120, -78, -30, 25, 72, 118, 160].map((deg) => {
        const { leaf, rib } = frond(deg, 98, 9);
        return (
          <g key={`f${deg}`}>
            <path d={leaf} fill="var(--oasis-palm)" />
            <path d={rib} stroke="var(--oasis-palm-2)" strokeWidth={1.1 * scale} fill="none" opacity={0.7} />
          </g>
        );
      })}
      <circle cx={crownX} cy={top} r={5 * scale} fill="var(--oasis-palm-trunk)" />
    </g>
  );
}

/** A cluster of dates hanging under a palm's crown. */
function Dates({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const berries: [number, number][] = [
    [-6, 4],
    [0, 6],
    [6, 4],
    [-3, 11],
    [3, 11],
    [0, 16],
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 -6 L0 2" stroke="var(--oasis-palm-trunk)" strokeWidth={2} />
      {berries.map(([dx, dy], i) => (
        <ellipse key={i} cx={dx} cy={dy} rx={3.4} ry={4.4} fill="var(--oasis-date)" />
      ))}
    </g>
  );
}

/** A camel walking right, feet on y = 0. */
function Camel({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="var(--oasis-silhouette)">
      <path d="M-24 -22 C-25 -34 -12 -44 -2 -36 C4 -44 15 -41 18 -31 L23 -30 C28 -36 33 -47 40 -47 L46 -45 L47 -41 L42 -40 C38 -33 34 -24 28 -20 C24 -17 18 -17 14 -18 L-18 -18 C-22 -18 -24 -20 -24 -22 Z" />
      {[-20, -12, 10, 18].map((lx) => (
        <rect key={lx} x={lx} y={-19} width={3} height={19} rx={1} />
      ))}
      <path d="M-24 -24 C-28 -22 -29 -16 -27 -12" stroke="var(--oasis-silhouette)" strokeWidth={2} fill="none" />
    </g>
  );
}

/** Someone walking ahead of the camels, robed. */
function Walker({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="var(--oasis-silhouette)">
      <path d="M-5 0 L5 0 L3 -18 C5 -20 4 -25 0 -26 C-4 -25 -5 -20 -3 -18 Z" />
      <circle cx={0} cy={-29} r={3.6} />
      <path d="M4 -16 L12 -22" stroke="var(--oasis-silhouette)" strokeWidth={1.4} />
    </g>
  );
}

/** A dove at the water's edge, facing `dir`. */
function Dove({ x, y, dir = 1 }: { x: number; y: number; dir?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${dir} 1)`} fill="var(--oasis-bird)">
      <ellipse cx={0} cy={-6} rx={8} ry={5} />
      <circle cx={7} cy={-11} r={3.4} />
      <path d="M10 -11 L13.5 -10 L10 -9.5 Z" fill="var(--oasis-date)" />
      <path d="M-7 -6 L-14 -9 L-13 -3 Z" />
      <path d="M-1 -1 L-1 1 M2 -1 L2 1" stroke="var(--oasis-bird)" strokeWidth={1.2} />
    </g>
  );
}

/** A small desert flower: five petals round a bright eye. */
function Flower({ x, y, colour, size = 1 }: { x: number; y: number; colour: string; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path d="M0 0 L0 12" stroke="var(--oasis-reed)" strokeWidth={1.4} />
      <path d="M0 8 q-5 -2 -7 -6 M0 10 q5 -2 7 -5" stroke="var(--oasis-reed)" strokeWidth={1.2} fill="none" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-3.4} rx={2.2} ry={3.6} fill={colour} transform={`rotate(${a})`} />
      ))}
      <circle r={1.6} fill="var(--oasis-flower-eye)" />
    </g>
  );
}

/**
 * The oasis at dawn. Dunes before first light with a dry hollow between them,
 * and fourteen things that come to it, one more for each day the whole set
 * is recited: a spring, then the pool it fills, palms, reeds, a lantern,
 * birds at the water, a tent and a caravan, a small mosque, and at the last
 * the sun clearing the dunes and the oasis in full light.
 */
export function OasisScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const morning = has("sunrise");
  const grove = has("grove");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="oasis-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--oasis-sky-1)" />
            <stop offset="55%" stopColor="var(--oasis-sky-2)" />
            <stop offset="100%" stopColor="var(--oasis-sky-3)" />
          </linearGradient>
          <radialGradient id="oasis-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--oasis-glow)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--oasis-glow)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="oasis-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--oasis-sun-core)" />
            <stop offset="70%" stopColor="var(--oasis-sun)" />
            <stop offset="100%" stopColor="var(--oasis-sun)" stopOpacity="0.9" />
          </radialGradient>
          <linearGradient id="oasis-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--oasis-water)" />
            <stop offset="100%" stopColor="var(--oasis-water-deep)" />
          </linearGradient>
          <linearGradient id="oasis-dune-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--oasis-sun)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--oasis-sun)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="oasis-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--oasis-light)" stopOpacity="0.28" />
            <stop offset="60%" stopColor="var(--oasis-light)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--oasis-light)" stopOpacity="0" />
          </linearGradient>
          {/* Shade just below each crest, fading down: no hard edges. */}
          <linearGradient id="oasis-far-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--oasis-dune-far-shade)" stopOpacity="0.9" />
            <stop offset="22%" stopColor="var(--oasis-dune-far-shade)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="oasis-mid-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--oasis-dune-mid-shade)" stopOpacity="0.85" />
            <stop offset="24%" stopColor="var(--oasis-dune-mid-shade)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="oasis-lamp" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--oasis-lantern)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--oasis-lantern)" stopOpacity="0" />
          </radialGradient>
          <filter id="oasis-blur" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="oasis-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <clipPath id="oasis-pool">
            <ellipse cx={600} cy={484} rx={226} ry={32} />
          </clipPath>
        </>
      }
    >
      <rect width="1200" height="560" fill="url(#oasis-sky)" />

      {/* The last stars: they thin once the sun is up. */}
      <g style={{ opacity: morning ? "calc(var(--oasis-stars) * 0.3)" : "var(--oasis-stars)" }}>
        {STARS.map((star, i) => (
          <circle
            key={i}
            data-fx="twinkle"
            cx={star.x}
            cy={star.y}
            r={0.5 + star.r * 1.2}
            fill="var(--oasis-star)"
            opacity={0.45 + star.r * 0.5}
            style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }}
          />
        ))}
      </g>

      {/* First light along the horizon, there from the start. */}
      <ellipse cx={SUN.x} cy={SUN.y + 10} rx={560} ry={150} fill="url(#oasis-glow)" />

      {stage(
        "sunrise",
        <>
          <g data-fx="rays" style={{ opacity: "var(--oasis-rays)" }}>
            {[-70, -48, -26, -6, 14, 34, 56, 78].map((deg) => {
              const a = ((deg - 90) * Math.PI) / 180;
              const spread = 0.035;
              const far = 520;
              return (
                <path
                  key={deg}
                  d={`M${SUN.x} ${SUN.y} L${round(SUN.x + Math.cos(a - spread) * far)} ${round(SUN.y + Math.sin(a - spread) * far)} L${round(SUN.x + Math.cos(a + spread) * far)} ${round(SUN.y + Math.sin(a + spread) * far)} Z`}
                  fill="var(--oasis-sun)"
                />
              );
            })}
          </g>
          <circle cx={SUN.x} cy={SUN.y} r={110} fill="url(#oasis-glow)" filter="url(#oasis-blur)" />
          <circle cx={SUN.x} cy={SUN.y} r={46} fill="url(#oasis-sun)" />
        </>,
      )}

      {/* The far dunes, with the caravan along their ridge. */}
      <path d={FAR_DUNES} fill="var(--oasis-dune-far)" />
      <path d={FAR_DUNES} fill="url(#oasis-far-shade)" transform="translate(0 10)" />
      {morning && (
        <path
          d="M0 352 C120 318 240 306 360 326 C470 344 560 300 700 300 C820 300 900 336 1010 322 C1100 310 1160 318 1200 326 L1200 346 C1160 338 1100 330 1010 342 C900 356 820 320 700 320 C560 320 470 364 360 346 C240 326 120 338 0 372 Z"
          fill="url(#oasis-dune-rim)"
        />
      )}
      {stage(
        "caravan",
        <g>
          <Walker x={566} y={305} scale={0.62} />
          <Camel x={604} y={302} scale={0.58} />
          <Camel x={652} y={300} scale={0.6} />
          <Camel x={700} y={300} scale={0.56} />
          <path d="M572 293 L590 286 M622 288 L636 286 M668 286 L684 285" stroke="var(--oasis-silhouette)" strokeWidth={0.9} />
        </g>,
      )}

      {/* The middle dunes, the mosque and the tent on them. */}
      <path d={MID_DUNES} fill="var(--oasis-dune-mid)" />
      <path d={MID_DUNES} fill="url(#oasis-mid-shade)" transform="translate(0 8)" />
      {stage(
        "mosque",
        <g>
          <rect x={118} y={350} width={104} height={50} fill="var(--oasis-adobe)" />
          <rect x={118} y={350} width={104} height={6} fill="var(--oasis-adobe-shade)" opacity={0.6} />
          {[124, 140, 156, 172, 188, 204].map((x) => (
            <path key={x} d={`M${x} 350 L${x + 6} 342 L${x + 12} 350 Z`} fill="var(--oasis-adobe)" />
          ))}
          <path d="M140 350 C140 318 200 318 200 350 Z" fill="var(--oasis-adobe)" />
          <path d="M170 322 L170 312" stroke="var(--oasis-adobe-shade)" strokeWidth={2} />
          <path d="M166 306 A6 6 0 1 0 174 312 A5 5 0 1 1 166 306 Z" fill="var(--oasis-lantern)" />
          <rect x={222} y={300} width={22} height={100} fill="var(--oasis-adobe)" />
          <rect x={218} y={322} width={30} height={5} rx={1} fill="var(--oasis-adobe-shade)" />
          <path d="M222 300 L233 284 L244 300 Z" fill="var(--oasis-adobe)" />
          <rect x={229} y={336} width={8} height={14} rx={4} fill="var(--oasis-lantern)" opacity={0.75} />
          <path d="M162 400 L162 382 A8 8 0 0 1 178 382 L178 400 Z" fill="var(--oasis-adobe-door)" />
          {[132, 196].map((x) => (
            <path key={x} d={`M${x} 382 L${x} 372 A5 5 0 0 1 ${x + 10} 372 L${x + 10} 382 Z`} fill="var(--oasis-lantern)" opacity={0.7} />
          ))}
        </g>,
      )}
      {stage(
        "tent",
        <g>
          <path d="M984 430 L992 400 L1030 390 L1078 390 L1112 400 L1120 430 Z" fill="var(--oasis-tent)" />
          {[402, 412, 422].map((y) => (
            <path key={y} d={`M${990 - (y - 400) * 0.1} ${y} L${1114 + (y - 400) * 0.1} ${y}`} stroke="var(--oasis-tent-stripe)" strokeWidth={2} opacity={0.8} />
          ))}
          <path d="M1036 430 L1040 404 L1064 404 L1068 430 Z" fill="var(--oasis-tent-shade)" />
          <path d="M984 430 L962 436 M1120 430 L1142 436 M992 400 L970 426 M1112 400 L1134 426" stroke="var(--oasis-tent-shade)" strokeWidth={1.2} />
          <circle cx={1052} cy={420} r={10} fill="url(#oasis-lamp)" />
        </g>,
      )}

      {/* The near sand, wind-rippled. */}
      <path
        d="M0 448 C160 430 300 436 420 446 C520 454 680 454 780 446 C900 436 1040 428 1200 442 L1200 560 L0 560 Z"
        fill="var(--oasis-sand)"
      />
      <g stroke="var(--oasis-sand-shade)" strokeWidth={1.4} fill="none" opacity={0.55}>
        <path d="M30 500 C80 492 130 496 180 490 M60 530 C120 522 170 528 230 520 M960 498 C1010 490 1070 494 1130 486 M900 534 C970 526 1040 530 1110 522" />
      </g>

      {/* The hollow where the water will be: the base, dry and cracked. */}
      <g>
        <title>{SCENE.base}</title>
        <ellipse cx={600} cy={484} rx={252} ry={42} fill="var(--oasis-hollow)" />
        <ellipse cx={600} cy={490} rx={210} ry={28} fill="var(--oasis-hollow-deep)" opacity={0.5} />
        <path
          d="M480 486 L520 480 L548 490 M580 476 L604 488 L640 482 M660 494 L700 486 L728 492 M532 500 L560 506 M640 504 L676 508"
          stroke="var(--oasis-hollow-crack)"
          strokeWidth={1.4}
          fill="none"
          opacity={has("pool") ? 0 : 0.8}
        />
      </g>
      {stage(
        "pool",
        <>
          <ellipse cx={600} cy={484} rx={226} ry={32} fill="url(#oasis-water)" />
          <g clipPath="url(#oasis-pool)">
            <ellipse cx={600} cy={462} rx={226} ry={12} fill="var(--oasis-sky-3)" opacity={0.35} />
            {/* The sun's path on the water: a few broken streaks, not a blob. */}
            {morning && (
              <g data-fx="shimmer" fill="var(--oasis-sun-core)" opacity={0.75}>
                <ellipse cx={SUN.x} cy={470} rx={26} ry={1.8} />
                <ellipse cx={SUN.x + 4} cy={478} rx={18} ry={1.6} />
                <ellipse cx={SUN.x - 2} cy={486} rx={12} ry={1.4} />
                <ellipse cx={SUN.x + 2} cy={494} rx={7} ry={1.2} />
              </g>
            )}
          </g>
          <ellipse data-fx="ripple" cx={600} cy={486} rx={150} ry={18} fill="none" stroke="var(--oasis-water-light)" strokeWidth={1.1} />
          <ellipse cx={600} cy={484} rx={226} ry={32} fill="none" stroke="var(--oasis-sand-light)" strokeWidth={2} opacity={0.5} />
        </>,
      )}
      {stage(
        "spring",
        <>
          {!has("pool") && <ellipse cx={600} cy={488} rx={44} ry={8} fill="url(#oasis-water)" />}
          <ellipse data-fx="ripple" cx={600} cy={488} rx={22} ry={4} fill="none" stroke="var(--oasis-water-light)" strokeWidth={1.2} />
          <ellipse data-fx="ripple" cx={600} cy={488} rx={12} ry={2.4} fill="none" stroke="var(--oasis-water-light)" strokeWidth={1.2} style={{ animationDelay: "-1.4s" }} />
          <circle data-fx="shimmer" cx={600} cy={487} r={2.2} fill="var(--oasis-water-light)" />
          {/* Stones round the spring, under water once the pool fills. */}
          {!has("pool") &&
            [
              [552, 494],
              [566, 499],
              [636, 496],
              [648, 491],
            ].map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx={5} ry={3} fill="var(--oasis-stone)" />)}
        </>,
      )}

      {/* The grove first, so the first palm stands in front of it. */}
      {stage(
        "grove",
        <>
          <Palm x={330} base={452} top={350} lean={-10} scale={0.7} />
          <Palm x={948} base={458} top={326} lean={14} scale={0.85} />
          <Palm x={872} base={466} top={290} lean={-18} scale={1} />
        </>,
      )}
      {stage("palm", <Palm x={430} base={474} top={292} lean={22} scale={1.05} />)}
      {stage(
        "dates",
        <>
          <Dates x={444} y={306} scale={1.1} />
          <Dates x={462} y={302} scale={1} />
          {grove && (
            <>
              <Dates x={848} y={302} />
              <Dates x={866} y={306} scale={0.9} />
              <Dates x={956} y={338} scale={0.8} />
            </>
          )}
        </>,
      )}
      {stage(
        "reeds",
        [
          [384, 480],
          [404, 492],
          [800, 478],
          [820, 490],
        ].map(([x, y]) => (
          <g key={x} data-fx="sway">
            {[-8, -3, 2, 7].map((dx, i) => (
              <path
                key={dx}
                d={`M${x + dx} ${y} q${dx * 0.6} -22 ${dx * 1.4} ${-38 - i * 4}`}
                stroke="var(--oasis-reed)"
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
              />
            ))}
            {/* Bulrush heads at the tips of the outer two stems. */}
            <ellipse cx={round(x - 8 * 2.4)} cy={y - 40} rx={2.2} ry={5} fill="var(--oasis-palm-trunk)" />
            <ellipse cx={round(x + 7 * 2.4)} cy={y - 52} rx={2.2} ry={5} fill="var(--oasis-palm-trunk)" />
          </g>
        )),
      )}
      {stage(
        "lantern",
        <g>
          <ellipse cx={792} cy={500} rx={30} ry={6} fill="var(--oasis-lantern)" opacity={0.3} filter="url(#oasis-soft)" />
          <path d="M806 524 L806 440 M806 442 L790 442" stroke="var(--oasis-lantern-metal)" strokeWidth={3} strokeLinecap="round" />
          <circle cx={790} cy={466} r={34} fill="url(#oasis-lamp)" data-fx="glow" />
          <path d="M790 442 L790 450" stroke="var(--oasis-lantern-metal)" strokeWidth={1.2} />
          <path d="M782 450 L798 450 L800 455 L780 455 Z" fill="var(--oasis-lantern-metal)" />
          <path d="M780 455 C778 466 784 474 790 476 C796 474 802 466 800 455 Z" fill="var(--oasis-lantern-glass)" />
          <path d="M785 459 C784 466 787 470 790 471 C793 470 796 466 795 459 Z" fill="var(--oasis-lantern)" data-fx="flicker" />
        </g>,
      )}
      {stage(
        "birds",
        <>
          {/* On the bank, at the water's edge. */}
          <Dove x={468} y={530} />
          <Dove x={494} y={533} dir={-1} />
          <Dove x={722} y={531} />
          <g data-fx="glide" stroke="var(--oasis-bird)" strokeWidth={2} fill="none" strokeLinecap="round">
            <path d="M960 170 q7 -7 14 0 q7 -7 14 0" />
            <path d="M998 150 q6 -6 12 0 q6 -6 12 0" />
            <path d="M932 196 q5 -5 10 0 q5 -5 10 0" />
          </g>
        </>,
      )}
      {stage(
        "flowers",
        [
          [362, 520, "--oasis-flower-1"],
          [378, 532, "--oasis-flower-2"],
          [420, 526, "--oasis-flower-3"],
          [452, 538, "--oasis-flower-1"],
          [520, 540, "--oasis-flower-2"],
          [588, 544, "--oasis-flower-3"],
          [664, 542, "--oasis-flower-1"],
          [736, 536, "--oasis-flower-2"],
          [778, 528, "--oasis-flower-3"],
          [826, 522, "--oasis-flower-1"],
          [846, 534, "--oasis-flower-2"],
        ].map(([x, y, colour]) => (
          <Flower key={`${x}`} x={Number(x)} y={Number(y)} colour={`var(${colour})`} size={0.9} />
        )),
      )}
      {stage(
        "light",
        <>
          <rect width="1200" height="560" fill="url(#oasis-light)" />
          <ellipse data-fx="shimmer" cx={SUN.x} cy={482} rx={70} ry={5} fill="var(--oasis-sun-core)" opacity={0.35} filter="url(#oasis-soft)" />
        </>,
      )}
    </SceneSvg>
  );
}
