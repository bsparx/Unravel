import { SCENES } from "@/lib/scenes";

import { SceneSvg, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.dua;

const STARS = scatter(5, 56, { x: [10, 1190], y: [10, 230] });
// The Milky Way: a soft band from low left to high right, thick with small stars.
const MILKY = scatter(61, 90, { x: [0, 1], y: [0, 1] }).map((p) => {
  const x = 60 + p.x * 1080;
  const centre = 250 - (x - 60) * 0.19;
  return { x, y: centre + (p.y - 0.5) * 70, r: p.r };
});

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
 * crescent low over the wall, and fourteen things that come to it: stars, a
 * lamp in the arch, a fountain, a palm, a rug laid for prayer, and on to the
 * Milky Way and the first pale light of fajr, one for each day of the last
 * two weeks you made du'a.
 */
export function CourtyardScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const risen = has("crescent");

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
      {stage("fajr", <rect x={0} y={140} width={1200} height={130} fill="url(#court-fajr)" />)}
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
        "stars",
        STARS.map((star, i) => (
          <circle
            key={i}
            data-fx="twinkle"
            cx={star.x}
            cy={star.y}
            r={0.6 + star.r * 1.4}
            fill="var(--court-star)"
            opacity={0.5 + star.r * 0.5}
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
    </SceneSvg>
  );
}
