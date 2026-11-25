import { SCENES } from "@/lib/scenes";

import { SceneSvg, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.dua;

const STARS = scatter(5, 56, { x: [10, 1190], y: [10, 230] });
// The Milky Way: a soft band from low left to high right, thick with small stars.
const MILKY = scatter(61, 90, { x: [0, 1], y: [0, 1] }).map((p) => {
  const x = 60 + p.x * 1080;
  const centre = 250 - (x - 60) * 0.19;
  return { x, y: centre + (p.y - 0.5) * 70, r: p.r };
});

const MORE_STARS = scatter(71, 70, { x: [10, 1190], y: [10, 230] });
const CITY = scatter(19, 26, { x: [380, 840], y: [0, 1] })
  .concat(scatter(23, 16, { x: [900, 1200], y: [0, 1] }))
  .map((p) => ({ x: Math.round(p.x), w: 14 + Math.round(p.y * 18), h: 8 + Math.round(p.r * 16) }));

const ARCHES = [200, 400, 600, 800, 1000];
const ARCH = { half: 62, spring: 352, base: 470, rise: 78 };

/** A pointed arch opening, the shape of the arcade (and of a mihrab). */
function archPath(cx: number, half = ARCH.half, spring = ARCH.spring, base = ARCH.base, rise = ARCH.rise) {
  const r = half * 1.6;
  return `M${cx - half} ${base} L${cx - half} ${spring} A${r} ${r} 0 0 1 ${cx} ${spring - rise} A${r} ${r} 0 0 1 ${cx + half} ${spring} L${cx + half} ${base} Z`;
}

/** An eight-point star: two squares, one turned. */
function eightPoint(cx: number, cy: number, r: number) {
  const square = (turn: number) =>
    [0, 1, 2, 3]
      .map((i) => {
        const a = turn + (i * Math.PI) / 2;
        return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
      })
      .join(" L");
  return `M${square(Math.PI / 4)} Z M${square(0)} Z`;
}

/** A tree in a square planter: orange, lemon or fig by its fruit colour. */
function PlanterTree({ x, base, fruit, s = 1 }: { x: number; base: number; fruit: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${s})`}>
      <path d="M-16 0 L16 0 L13 -22 L-13 -22 Z" fill="var(--court-stone)" />
      <rect x={-2.5} y={-52} width={5} height={30} fill="var(--court-palm-trunk)" />
      <g data-fx="sway">
        <circle cx={0} cy={-66} r={22} fill="var(--court-leaf)" />
        <circle cx={-12} cy={-58} r={13} fill="var(--court-leaf)" />
        <circle cx={12} cy={-58} r={13} fill="var(--court-leaf)" />
        {[
          [-10, -66],
          [8, -72],
          [12, -58],
          [-4, -56],
          [2, -80],
        ].map(([fx, fy], i) => (
          <circle key={i} cx={fx} cy={fy} r={3.2} fill={fruit} />
        ))}
      </g>
    </g>
  );
}

/** A low rug laid for prayer, its mihrab arch woven in. */
function Rug({ x, colour = "var(--court-rug)" }: { x: number; colour?: string }) {
  return (
    <g>
      <path d={`M${x} 552 L${x + 154} 552 L${x + 134} 500 L${x + 20} 500 Z`} fill={colour} />
      <path d={`M${x + 14} 544 L${x + 140} 544 L${x + 124} 506 L${x + 30} 506 Z`} fill="none" stroke="var(--court-rug-2)" strokeWidth={2.5} />
      <path d={`M${x + 56} 530 L${x + 56} 516 A22 22 0 0 1 ${x + 77} 507 A22 22 0 0 1 ${x + 98} 516 L${x + 98} 530`} fill="none" stroke="var(--court-rug-2)" strokeWidth={2} />
      {Array.from({ length: 9 }, (_, i) => x + 10 + i * 16).map((fx) => (
        <line key={fx} x1={fx} y1={552} x2={fx - 1} y2={558} stroke="var(--court-rug-2)" strokeWidth={1.5} />
      ))}
    </g>
  );
}

function Lamp({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <circle cx={0} cy={30} r={46} fill="url(#court-glow)" data-fx="glow" />
      <line x1={0} y1={0} x2={0} y2={16} stroke="var(--court-chain)" strokeWidth={1.2} />
      <path d="M-10 16 L10 16 L14 22 L-14 22 Z" fill="var(--court-chain)" />
      <path d="M-14 22 C-16 34 -8 44 0 46 C8 44 16 34 14 22 Z" fill="var(--court-lamp-glass)" />
      <path d="M-8 26 C-9 34 -4 40 0 41 C4 40 9 34 8 26 Z" fill="var(--court-lamp)" />
      <path d="M-3 46 L3 46 L0 54 Z" fill="var(--court-chain)" />
    </g>
  );
}

/**
 * The night courtyard. An arcade of pointed arches under the night with the
 * crescent low over the wall, and sixty things that come to it, one more for
 * each day you make du'a: stars, a lamp in the arch, a fountain, a palm, a
 * rug laid for prayer, then lamps, tiles and calligraphy, a mushaf on its
 * stand, trees in planters, the city beyond the wall, until the night thins,
 * the sky pales and the first light of fajr reaches the dome.
 */
export function CourtyardScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const risen = has("crescent");
  // The night thins towards fajr: stars fade, the sky pales.
  const starsShown = has("thinning") ? 0.45 : 1;

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="court-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--court-sky-1)" />
            <stop offset="60%" stopColor="var(--court-sky-2)" />
            <stop offset="100%" stopColor="var(--court-sky-3)" />
          </linearGradient>
          <linearGradient id="court-fajr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--court-fajr)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--court-fajr)" stopOpacity="0.85" />
          </linearGradient>
          <radialGradient id="court-glow">
            <stop offset="0%" stopColor="var(--court-lamp)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--court-lamp)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="court-moon-halo">
            <stop offset="0%" stopColor="var(--court-moon)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--court-moon)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="court-arch-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--court-arch)" />
            <stop offset="100%" stopColor="var(--court-arch-floor)" />
          </linearGradient>
          <linearGradient id="court-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--court-water)" />
            <stop offset="100%" stopColor="var(--court-water-deep)" />
          </linearGradient>
          <filter id="court-blur" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
          <filter id="court-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <mask id="court-crescent-low">
            <rect width="1200" height="560" fill="white" />
            <circle cx={1006} cy={206} r={20} fill="black" />
          </mask>
          <mask id="court-crescent-high">
            <rect width="1200" height="560" fill="white" />
            <circle cx={1034} cy={88} r={30} fill="black" />
          </mask>
          <clipPath id="court-floor">
            <rect x={0} y={470} width={1200} height={90} />
          </clipPath>
        </>
      }
    >
      <rect width="1200" height="560" fill="url(#court-sky)" />
      {stage("pale", <rect x={0} y={0} width={1200} height={260} fill="var(--court-fajr)" opacity={0.12} />)}
      {stage("rose-line", <rect x={0} y={190} width={1200} height={60} fill="url(#court-fajr)" opacity={0.7} />)}
      {stage("fajr", <rect x={0} y={140} width={1200} height={130} fill="url(#court-fajr)" />)}
      {stage("thinning", <rect x={0} y={0} width={1200} height={120} fill="var(--court-sky-2)" opacity={0.18} />)}
      {stage(
        "milky-way",
        <>
          <path d="M40 320 C300 280 640 200 1180 120 L1180 190 C640 260 300 340 40 380 Z" fill="var(--court-milky)" opacity={0.18} filter="url(#court-blur)" />
          <path d="M40 336 C300 300 640 226 1180 146 L1180 168 C640 246 300 324 40 356 Z" fill="var(--court-milky)" opacity={0.14} filter="url(#court-blur)" />
          {MILKY.map((star, i) => (
            <circle key={i} cx={star.x} cy={star.y} r={0.4 + star.r * 0.9} fill="var(--court-star)" opacity={0.35 + star.r * 0.45} />
          ))}
        </>,
      )}
      {stage(
        "stars-thick",
        <g opacity={starsShown}>
          {MORE_STARS.map((star, i) => (
            <circle key={i} data-fx="twinkle" cx={star.x} cy={star.y} r={0.4 + star.r * 1.1} fill="var(--court-star)" opacity={0.4 + star.r * 0.5} style={{ animationDelay: `${(star.r * 6).toFixed(2)}s` }} />
          ))}
        </g>,
      )}
      {stage(
        "planet",
        <g data-fx="twinkle">
          <circle cx={684} cy={70} r={10} fill="url(#court-glow)" />
          <circle cx={684} cy={70} r={3.2} fill="var(--court-star)" />
        </g>,
      )}
      {stage(
        "meteor",
        <path data-fx="meteor" d="M520 50 l-80 36" stroke="var(--court-star)" strokeWidth={2} strokeLinecap="round" opacity={0.7} />,
      )}
      {stage(
        "clouds",
        <g data-fx="drift" fill="var(--court-moon)" opacity={0.22} filter="url(#court-blur)">
          <ellipse cx={940} cy={130} rx={140} ry={14} />
          <ellipse cx={560} cy={160} rx={160} ry={12} />
        </g>,
      )}
      {stage(
        "swallows",
        <g data-fx="glide" stroke="var(--court-silhouette)" strokeWidth={1.8} fill="none" strokeLinecap="round">
          <path d="M440 120 q5 -5 10 0 q5 -5 10 0" />
          <path d="M478 104 q4 -4 8 0 q4 -4 8 0" />
          <path d="M512 128 q5 -5 10 0 q5 -5 10 0" />
        </g>,
      )}
      {stage(
        "stars",
        STARS.map((star, i) => (
          <circle
            key={i}
            data-fx="twinkle"
            cx={star.x}
            cy={star.y}
            r={0.6 + star.r * 1.4}
            fill="var(--court-star)"
            opacity={(0.5 + star.r * 0.5) * starsShown}
            style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }}
          />
        )),
      )}

      {/* The crescent: low over the wall, then risen high and bright. */}
      {risen ? (
        <g data-stage="crescent">
          <title>{SCENE.stages[11].name}</title>
          <circle cx={1020} cy={96} r={120} fill="url(#court-moon-halo)" data-fx="halo" />
          <circle cx={1020} cy={96} r={32} fill="var(--court-moon)" mask="url(#court-crescent-high)" />
        </g>
      ) : (
        <circle cx={994} cy={212} r={20} fill="var(--court-moon)" mask="url(#court-crescent-low)" />
      )}

      {stage(
        "city",
        <g>
          {CITY.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={244 - b.h} width={b.w} height={b.h} fill="var(--court-silhouette)" opacity={0.75} />
              {i % 2 === 0 && <rect x={b.x + b.w / 2 - 1.5} y={248 - b.h} width={3} height={3} fill="var(--court-lamp)" />}
            </g>
          ))}
        </g>,
      )}

      {/* The dome and the minaret, behind the wall. */}
      {stage(
        "dome",
        <g fill="var(--court-silhouette)">
          <rect x={232} y={196} width={136} height={60} />
          <path d="M224 200 C224 120 376 120 376 200 Z" />
          <rect x={296} y={110} width={8} height={24} />
          <circle cx={300} cy={104} r={7} />
          {[252, 284, 316, 348].map((x) => (
            <path key={x} d={`M${x - 5} 244 L${x - 5} 226 A6 6 0 0 1 ${x + 5} 226 L${x + 5} 244 Z`} fill="var(--court-lamp)" opacity={0.5} />
          ))}
        </g>,
      )}
      {stage(
        "first-light",
        <path d="M300 128 C352 136 376 168 376 200 L340 200 C340 170 326 146 300 138 Z" fill="var(--court-fajr)" opacity={0.75} />,
      )}
      {stage(
        "minaret",
        <g fill="var(--court-silhouette)">
          <rect x={846} y={120} width={30} height={140} />
          <rect x={838} y={150} width={46} height={8} rx={2} />
          <rect x={840} y={96} width={42} height={8} rx={2} />
          <rect x={850} y={70} width={22} height={28} />
          <path d="M846 72 L861 30 L876 72 Z" />
          <circle cx={861} cy={26} r={4} />
          <rect x={856} y={180} width={10} height={18} rx={5} fill="var(--court-lamp)" opacity={0.6} />
        </g>,
      )}
      {stage(
        "minaret-lamp",
        <g>
          <circle cx={861} cy={152} r={30} fill="url(#court-glow)" data-fx="glow" />
          <rect x={855} y={140} width={12} height={10} rx={2} fill="var(--court-lamp)" />
        </g>,
      )}
      {stage(
        "minaret-light",
        <path d="M864 38 L876 72 L876 260 L871 260 L871 74 Z" fill="var(--court-fajr)" opacity={0.45} />,
      )}
      {stage(
        "owl",
        <g transform="translate(888 148)">
          <ellipse cx={0} cy={0} rx={7} ry={9} fill="var(--court-silhouette)" />
          <circle cx={-2.6} cy={-3} r={2.2} fill="var(--court-lamp)" />
          <circle cx={2.6} cy={-3} r={2.2} fill="var(--court-lamp)" />
        </g>,
      )}
      {stage(
        "domes",
        <g fill="var(--court-silhouette)">
          {[480, 720, 960, 1110].map((dx) => (
            <g key={dx}>
              <rect x={dx - 18} y={226} width={36} height={16} />
              <path d={`M${dx - 20} 228 C${dx - 20} 204 ${dx + 20} 204 ${dx + 20} 228 Z`} />
              <rect x={dx - 1} y={200} width={2} height={8} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "doves",
        <g fill="var(--court-cornice)">
          {[420, 438, 756, 1084].map((dx, i) => (
            <g key={dx} transform={`translate(${dx} 240) scale(${i % 2 ? -1 : 1} 1)`}>
              <ellipse cx={0} cy={-4} rx={6} ry={4} />
              <circle cx={5} cy={-7} r={2.6} />
            </g>
          ))}
        </g>,
      )}

      {/* The arcade. */}
      <g>
        <title>{SCENE.base}</title>
        <rect x={0} y={248} width={1200} height={222} fill="var(--court-wall)" />
        <rect x={0} y={240} width={1200} height={12} fill="var(--court-cornice)" />
        <rect x={0} y={252} width={1200} height={4} fill="var(--court-wall-shade)" opacity={0.6} />
        {ARCHES.map((cx) => (
          <g key={cx}>
            <path d={archPath(cx, ARCH.half + 8, ARCH.spring, ARCH.base, ARCH.rise + 10)} fill="var(--court-wall-shade)" opacity={0.55} />
            <path d={archPath(cx)} fill="url(#court-arch-depth)" />
          </g>
        ))}
        {[100, 300, 500, 700, 900, 1100].map((x) => (
          <rect key={x} x={x - 10} y={300} width={20} height={170} fill="var(--court-wall-shade)" opacity={0.25} />
        ))}
      </g>
      {stage(
        "tiles",
        <g fill="none" stroke="var(--court-tile)" strokeWidth={5} opacity={0.8}>
          {ARCHES.map((cx) => (
            <path key={cx} d={archPath(cx, ARCH.half + 4, ARCH.spring, ARCH.base, ARCH.rise + 5)} />
          ))}
        </g>,
      )}
      {stage(
        "calligraphy",
        <g stroke="var(--court-tile)" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.85}>
          {Array.from({ length: 20 }, (_, i) => i * 60 + 10).map((cx, i) => (
            <path key={cx} d={`M${cx} 264 q8 -6 14 0 t14 0 M${cx + 30} 266 l0 -8 M${cx + 38} 266 q4 -8 10 0${i % 2 ? ` M${cx + 6} 259 l2 -2` : ""}`} />
          ))}
        </g>,
      )}
      {stage(
        "mihrab",
        <g>
          <path d={archPath(600, 30, 398, 470, 40)} fill="var(--court-lamp)" opacity={0.25} />
          <path d={archPath(600, 30, 398, 470, 40)} fill="none" stroke="var(--court-lamp-glass)" strokeWidth={2.5} />
        </g>,
      )}
      {stage(
        "door",
        <g>
          <path d={archPath(800, 40, 380, 470, 50)} fill="var(--court-lamp)" opacity={0.45} />
          <path d="M760 470 L760 400 L740 410 L740 470 Z" fill="var(--court-palm-trunk)" />
        </g>,
      )}
      {stage(
        "niches",
        [100, 300, 500, 700, 900, 1100].map((x) => (
          <g key={x}>
            <path d={`M${x - 8} 420 L${x - 8} 404 A8 8 0 0 1 ${x + 8} 404 L${x + 8} 420 Z`} fill="var(--court-arch)" />
            <circle cx={x} cy={410} r={10} fill="url(#court-glow)" data-fx="glow" />
            <rect x={x - 2} y={410} width={4} height={8} fill="var(--court-cornice)" />
            <circle cx={x} cy={407} r={1.8} fill="var(--court-lamp)" data-fx="flicker" />
          </g>
        )),
      )}
      {stage(
        "vine",
        <g>
          <path d="M1088 470 L1088 300 M1112 470 L1112 300 M1088 340 L1112 340 M1088 380 L1112 380 M1088 420 L1112 420" stroke="var(--court-palm-trunk)" strokeWidth={2} />
          <path d="M1092 468 C1080 420 1120 390 1096 350 C1084 330 1110 316 1104 300" stroke="var(--court-leaf)" strokeWidth={2.4} fill="none" />
          {[
            [1092, 440],
            [1110, 404],
            [1094, 366],
            [1106, 326],
          ].map(([vx, vy], i) => (
            <g key={i}>
              <circle cx={vx} cy={vy} r={7} fill="var(--court-leaf)" />
              <circle cx={vx + 6} cy={vy + 6} r={3} fill="var(--court-rug)" opacity={0.85} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "lattice",
        [100, 300, 500, 700, 900, 1100].map((x) => (
          <g key={x}>
            <circle cx={x} cy={284} r={22} fill="url(#court-glow)" />
            <path d={eightPoint(x, 284, 13)} fill="var(--court-lamp)" opacity={0.85} fillRule="evenodd" />
            <path d={eightPoint(x, 284, 13)} fill="none" stroke="var(--court-cornice)" strokeWidth={1.5} />
          </g>
        )),
      )}
      {stage(
        "jasmine",
        <>
          <path d="M0 258 C60 268 90 290 140 286 C190 282 220 300 260 296 C300 292 330 268 360 262" stroke="var(--court-leaf)" strokeWidth={3} fill="none" />
          <path d="M60 266 C64 290 52 310 58 330 M220 296 C214 318 226 338 218 356" stroke="var(--court-leaf)" strokeWidth={2} fill="none" />
          {[
            [24, 262],
            [62, 270],
            [96, 284],
            [130, 287],
            [170, 284],
            [206, 292],
            [244, 297],
            [282, 290],
            [322, 272],
            [56, 308],
            [60, 330],
            [216, 330],
            [220, 352],
          ].map(([x, y], i) => (
            <g key={i}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx={x} cy={y - 3} rx={1.7} ry={3} fill="var(--court-jasmine)" transform={`rotate(${a} ${x} ${y})`} />
              ))}
            </g>
          ))}
        </>,
      )}
      {stage("lamp", <Lamp x={600} y={300} />)}
      {stage(
        "lamps",
        [200, 400, 800, 1000].map((x) => <Lamp key={x} x={x} y={300} size={0.85} />),
      )}
      {stage(
        "lanterns",
        [300, 500, 700, 900].map((x) => (
          <g key={x}>
            <line x1={x} y1={256} x2={x} y2={322} stroke="var(--court-chain)" strokeWidth={1} />
            <circle cx={x} cy={334} r={26} fill="url(#court-glow)" data-fx="glow" />
            <path d={eightPoint(x, 334, 10)} fill="var(--court-lamp)" fillRule="evenodd" />
            <circle cx={x} cy={334} r={3.5} fill="var(--court-lamp-glass)" />
          </g>
        )),
      )}
      {stage(
        "all-lamps",
        <g>
          {[40, 1160].map((x) => (
            <Lamp key={x} x={x} y={300} size={0.7} />
          ))}
          <rect x={0} y={250} width={1200} height={220} fill="var(--court-lamp)" opacity={0.05} />
        </g>,
      )}
      {stage(
        "dew",
        [
          [40, 266],
          [110, 286],
          [190, 286],
          [260, 296],
          [330, 270],
          [58, 320],
        ].map(([dx, dy], i) => <circle key={i} data-fx="twinkle" cx={dx} cy={dy} r={1.6} fill="var(--court-water-light)" style={{ animationDelay: `${i * 0.5}s` }} />),
      )}

      {/* The courtyard floor, tiled. */}
      <rect x={0} y={470} width={1200} height={90} fill="var(--court-floor)" />
      <g clipPath="url(#court-floor)" stroke="var(--court-tile-line)" strokeWidth={1.2}>
        {Array.from({ length: 30 }, (_, i) => i * 60 - 300).map((x) => (
          <g key={x}>
            <line x1={x} y1={470} x2={x + 120} y2={560} />
            <line x1={x + 120} y1={470} x2={x} y2={560} />
          </g>
        ))}
      </g>
      <rect x={0} y={470} width={1200} height={4} fill="var(--court-wall-shade)" opacity={0.5} />

      {stage(
        "roses",
        <g>
          {[24, 52, 80, 110, 140, 1130, 1160, 1188].map((rx, i) => (
            <g key={rx}>
              <ellipse cx={rx} cy={480} rx={14} ry={7} fill="var(--court-leaf)" />
              <circle cx={rx - 4} cy={476} r={3.5} fill="var(--court-rose)" />
              <circle cx={rx + 5} cy={478 - (i % 2) * 3} r={3} fill="var(--court-rose)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "myrtle",
        [300, 500, 700, 900].map((x) => (
          <g key={x}>
            <path d={`M${x - 9} 486 L${x + 9} 486 L${x + 7} 474 L${x - 7} 474 Z`} fill="var(--court-stone)" />
            <ellipse cx={x} cy={462} rx={11} ry={14} fill="var(--court-leaf)" />
          </g>
        )),
      )}
      {stage(
        "cushions",
        <g>
          <rect x={160} y={452} width={34} height={18} rx={7} fill="var(--court-rug)" />
          <rect x={202} y={454} width={34} height={16} rx={7} fill="var(--court-tile)" />
        </g>,
      )}
      {stage(
        "shoes",
        <g fill="var(--court-palm-trunk)">
          {[776, 790, 812, 826].map((sx) => (
            <ellipse key={sx} cx={sx} cy={480} rx={6} ry={2.6} />
          ))}
        </g>,
      )}
      {stage("second-rug", <Rug x={790} colour="var(--court-tile)" />)}
      {stage(
        "rug",
        <>
          <path d="M226 552 L380 552 L360 500 L246 500 Z" fill="var(--court-rug)" />
          <path d="M240 544 L366 544 L350 506 L256 506 Z" fill="none" stroke="var(--court-rug-2)" strokeWidth={2.5} />
          <path d="M282 530 L282 516 A22 22 0 0 1 303 507 A22 22 0 0 1 324 516 L324 530" fill="none" stroke="var(--court-rug-2)" strokeWidth={2} />
          {[236, 252, 268, 284, 300, 316, 332, 348, 364].map((x) => (
            <line key={x} x1={x} y1={552} x2={x - 1} y2={558} stroke="var(--court-rug-2)" strokeWidth={1.5} />
          ))}
        </>,
      )}
      {stage(
        "rill",
        <path d="M592 540 L608 540 L612 560 L588 560 Z" fill="url(#court-water)" />,
      )}
      {stage(
        "lilies",
        <g>
          <ellipse cx={600} cy={552} rx={6} ry={2} fill="var(--court-leaf)" />
          <circle cx={601} cy={550} r={2} fill="var(--court-jasmine)" />
        </g>,
      )}
      {stage(
        "benches",
        <g>
          {[422, 730].map((bx) => (
            <g key={bx}>
              <rect x={bx} y={500} width={50} height={8} rx={2} fill="var(--court-stone)" />
              <rect x={bx + 4} y={508} width={8} height={14} fill="var(--court-wall-shade)" />
              <rect x={bx + 38} y={508} width={8} height={14} fill="var(--court-wall-shade)" />
            </g>
          ))}
        </g>,
      )}
      {stage("orange", <PlanterTree x={150} base={548} fruit="var(--court-orange)" />)}
      {stage(
        "nightingale",
        <g transform="translate(138 476)">
          <ellipse cx={0} cy={0} rx={5} ry={3.4} fill="var(--court-palm-trunk)" />
          <circle cx={4} cy={-3} r={2.4} fill="var(--court-palm-trunk)" />
          <path d="M-4 0 l-6 -2 l1 4 Z" fill="var(--court-palm-trunk)" />
        </g>,
      )}
      {stage("lemon", <PlanterTree x={968} base={552} fruit="var(--court-lemon)" s={0.9} />)}
      {stage("fig", <PlanterTree x={1160} base={540} fruit="var(--court-palm-trunk)" s={0.85} />)}
      {stage(
        "palm-2",
        <g transform="translate(-990 0)">
          <g data-fx="sway">
          <path d="M1050 556 C1046 480 1028 400 1040 316 L1050 316 C1040 400 1058 480 1062 556 Z" fill="var(--court-palm-trunk)" />
          {[-150, -110, -70, -30, 10, 50, 90, 130].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const ex = 1045 + Math.cos(a - Math.PI / 2) * 110;
            const ey = 318 + Math.sin(a - Math.PI / 2) * 56 + Math.abs(deg) * 0.5;
            const cx = 1045 + Math.cos(a - Math.PI / 2) * 56;
            const cy = 300 + Math.sin(a - Math.PI / 2) * 42;
            return <path key={deg} d={`M1045 316 Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`} stroke="var(--court-palm)" strokeWidth={7} fill="none" strokeLinecap="round" />;
          })}
          </g>
        </g>,
      )}
      {stage(
        "palm",
        <g data-fx="sway">
          <path d="M1050 556 C1046 480 1028 400 1040 316 L1050 316 C1040 400 1058 480 1062 556 Z" fill="var(--court-palm-trunk)" />
          {[340, 372, 404, 436, 468, 500, 532].map((y) => (
            <path key={y} d={`M1040 ${y} q8 -4 18 0`} stroke="var(--court-palm-ring)" strokeWidth={2} fill="none" />
          ))}
          {[-150, -115, -80, -45, -10, 25, 60, 95, 130].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const ex = 1045 + Math.cos(a - Math.PI / 2) * 120;
            const ey = 318 + Math.sin(a - Math.PI / 2) * 60 + Math.abs(deg) * 0.55;
            const cx = 1045 + Math.cos(a - Math.PI / 2) * 60;
            const cy = 300 + Math.sin(a - Math.PI / 2) * 46;
            return (
              <path
                key={deg}
                d={`M1045 316 Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`}
                stroke="var(--court-palm)"
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
          <circle cx={1030} cy={332} r={6} fill="var(--court-date)" />
          <circle cx={1040} cy={338} r={6} fill="var(--court-date)" />
          <circle cx={1056} cy={334} r={6} fill="var(--court-date)" />
        </g>,
      )}
      {stage(
        "birds",
        <g fill="var(--court-silhouette)">
          {[
            [1000, 300],
            [1090, 296],
            [1070, 286],
          ].map(([bx, by], i) => (
            <g key={i} transform={`translate(${bx} ${by})`}>
              <ellipse cx={0} cy={0} rx={5} ry={3.4} />
              <circle cx={4} cy={-3} r={2.4} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "fountain",
        <>
          <ellipse cx={600} cy={522} rx={118} ry={24} fill="var(--court-stone)" />
          <ellipse cx={600} cy={516} rx={104} ry={18} fill="url(#court-water)" />
          <rect x={590} y={472} width={20} height={44} fill="var(--court-stone)" />
          <ellipse cx={600} cy={472} rx={32} ry={8} fill="var(--court-stone)" />
          <ellipse cx={600} cy={470} rx={24} ry={5} fill="url(#court-water)" />
          <path d="M486 524 Q600 552 714 524" stroke="var(--court-cornice)" strokeWidth={2} fill="none" opacity={0.5} />
        </>,
      )}
      {stage(
        "water",
        <>
          <path data-fx="flow" d="M600 466 C600 440 576 438 566 470 M600 466 C600 440 624 438 634 470 M600 466 L600 436" stroke="var(--court-water-light)" strokeWidth={2} fill="none" strokeLinecap="round" />
          <ellipse data-fx="ripple" cx={600} cy={516} rx={70} ry={10} fill="none" stroke="var(--court-water-light)" strokeWidth={1.2} />
          <ellipse data-fx="ripple" cx={600} cy={516} rx={36} ry={5} fill="none" stroke="var(--court-water-light)" strokeWidth={1.2} style={{ animationDelay: "-1.5s" }} />
          <ellipse cx={600} cy={516} rx={18} ry={3} fill="var(--court-lamp)" opacity={0.35} filter="url(#court-soft)" />
        </>,
      )}
      {stage(
        "reflections",
        [530, 566, 634, 670].map((rx, i) => (
          <ellipse key={rx} data-fx="shimmer" cx={rx} cy={514 + (i % 2) * 4} rx={6} ry={1.4} fill="var(--court-lamp)" opacity={0.7} style={{ animationDelay: `${i * -0.5}s` }} />
        )),
      )}
      {stage(
        "petals",
        [
          [548, 512],
          [580, 522],
          [622, 508],
          [656, 520],
        ].map(([px, py], i) => <ellipse key={i} cx={px} cy={py} rx={2.6} ry={1.4} fill="var(--court-rose)" />),
      )}
      {stage(
        "dawn-water",
        <ellipse data-fx="shimmer" cx={600} cy={512} rx={70} ry={6} fill="var(--court-fajr)" opacity={0.6} />,
      )}
      {stage(
        "mushaf",
        <g>
          <path d="M290 538 L310 524 L330 538 M296 540 L324 528" stroke="var(--court-palm-trunk)" strokeWidth={2.4} />
          <path d="M290 524 L310 530 L330 524 L330 516 L310 522 L290 516 Z" fill="var(--court-cornice)" />
          <line x1={310} y1={522} x2={310} y2={530} stroke="var(--court-rug)" strokeWidth={1} />
        </g>,
      )}
      {stage(
        "beads",
        <g fill="var(--court-rug-2)">
          {Array.from({ length: 11 }, (_, i) => {
            const a = (i / 11) * Math.PI * 2;
            return <circle key={i} cx={round(352 + Math.cos(a) * 9)} cy={round(538 + Math.sin(a) * 4)} r={1.8} />;
          })}
          <path d="M361 538 l6 4" stroke="var(--court-rug-2)" strokeWidth={1.4} />
        </g>,
      )}
      {stage(
        "incense",
        <g>
          <path d="M380 540 L398 540 L394 528 L384 528 Z" fill="var(--court-chain)" />
          <path data-fx="steam" d="M389 524 q-6 -10 2 -18 q6 -8 -2 -18" stroke="var(--court-cornice)" strokeWidth={1.4} fill="none" opacity={0.6} />
        </g>,
      )}
      {stage(
        "cat",
        <g transform="translate(470 552)" fill="var(--court-cat)">
          <ellipse cx={0} cy={-6} rx={14} ry={7} />
          <circle cx={10} cy={-9} r={5} />
          <path d="M7 -13 l2 -4 l2 3 Z M12 -13 l2 -3 l1 4 Z" />
        </g>,
      )}
      {stage(
        "ewer",
        <g>
          <ellipse cx={742} cy={540} rx={10} ry={12} fill="var(--court-chain)" />
          <rect x={738} y={522} width={8} height={8} fill="var(--court-chain)" />
          <path d="M752 536 Q762 528 764 520" stroke="var(--court-chain)" strokeWidth={2.4} fill="none" />
          <path d="M732 532 q-6 2 -4 10" stroke="var(--court-chain)" strokeWidth={2} fill="none" />
        </g>,
      )}
    </SceneSvg>
  );
}
