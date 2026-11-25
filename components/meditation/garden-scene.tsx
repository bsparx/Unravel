import { SCENES } from "@/lib/scenes";
import { SceneSvg, round, scatter, stager, type SceneProps } from "@/components/scenes/scene-frame";
import { cn } from "@/lib/utils";

const SCENE = SCENES.meditate;

const STARS = scatter(7, 60, { x: [10, 1190], y: [10, 260] });
const BRIGHT = scatter(31, 6, { x: [80, 1120], y: [30, 200] });
const TUFTS = scatter(11, 80, { x: [10, 1190], y: [446, 552] }).filter(
  (t) => !(t.x > 360 && t.x < 840 && t.y > 452 && t.y < 535),
);
const FIREFLIES = scatter(23, 16, { x: [140, 1080], y: [320, 470] });
const POND_FLIES = scatter(83, 12, { x: [400, 820], y: [430, 520] });
const WILLOW_FLIES = scatter(97, 10, { x: [990, 1120], y: [340, 440] });
const MILKY = scatter(61, 110, { x: [0, 1], y: [0, 1] }).map((p) => {
  const x = p.x * 1200;
  return { x: round(x), y: round(40 + x * 0.12 + (p.y - 0.5) * 60), r: p.r };
});

/** The far hill's ridge, and a line of pines along it. */
const farY = (x: number) => round(292 + 16 * Math.sin(x / 170) + 9 * Math.sin(x / 61 + 1));
const FAR_HILL = `M0 ${farY(0)} ${Array.from({ length: 61 }, (_, i) => `L${i * 20} ${farY(i * 20).toFixed(1)}`).join(" ")} L1200 560 L0 560 Z`;
// Spaced out along the ridge in loose clumps, so it reads as a far wood
// rather than a fringe.
const PINES = scatter(41, 44, { x: [0, 1200], y: [0, 1] })
  .sort((a, b) => a.x - b.x)
  .filter((p, i, all) => i === 0 || p.x - all[i - 1].x > 9)
  .map((p) => ({ x: round(p.x), y: farY(p.x) + 4, h: 12 + p.r * 20 }));

/** Foreground grass blades along the bottom edge, nearest the viewer. */
const BLADES = scatter(53, 90, { x: [0, 1200], y: [0, 1] });

function Lantern({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle data-fx="glow" cx={0} cy={-48} r={58} fill="url(#garden-glow)" />
      <rect x={-14} y={-10} width={28} height={10} rx={2} fill="var(--garden-stone)" />
      <rect x={-5} y={-38} width={10} height={28} fill="var(--garden-stone)" />
      <rect x={-16} y={-60} width={32} height={22} rx={2} fill="var(--garden-stone)" />
      <rect x={-8} y={-56} width={16} height={13} rx={1} fill="var(--garden-light)" />
      <path d="M-26 -60 L0 -77 L26 -60 Z" fill="var(--garden-stone-dark)" />
      <rect x={-3} y={-82} width={6} height={6} rx={1} fill="var(--garden-stone-dark)" />
    </g>
  );
}

/** A canopy: shadowed clusters with moonlit ones on the moon's side (upper right). */
function Canopy({ blobs }: { blobs: [number, number, number][] }) {
  return (
    <>
      {blobs.map(([x, y, r], i) => (
        <circle key={`s${i}`} cx={x} cy={y} r={r} fill="var(--garden-leaf-tree)" />
      ))}
      {blobs.map(([x, y, r], i) => (
        <circle key={`l${i}`} cx={x + r * 0.28} cy={y - r * 0.3} r={r * 0.62} fill="var(--garden-leaf-lit)" opacity={0.55} />
      ))}
    </>
  );
}

/**
 * The moonlit garden. A meadow under the moon, and sixty things that come
 * into it, one more for each day you sit and one fewer for each day you
 * don't: a pond and its reeds, a maple, lanterns, a willow, bamboo and a
 * teahouse, koi, lotus and floating lights, until the garden is silver under
 * the full moon. Hills fade into mist behind, the canopies catch the moon on one
 * side, the moon lies in the pond once there is one, and the full moon comes
 * when the garden is whole.
 *
 * During a session the parent writes `--breath` (0 to 1) on an ancestor and
 * the ripples and lantern glow follow it; see .garden-scene in globals.css.
 */
export function GardenScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const fullMoon = has("full-moon");
  const moonR = fullMoon ? 50 : 36;

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={cn("garden-scene", className)}
      defs={
        <>
          <linearGradient id="garden-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--garden-sky-1)" />
            <stop offset="58%" stopColor="var(--garden-sky-2)" />
            <stop offset="100%" stopColor="var(--garden-sky-3)" />
          </linearGradient>
          <radialGradient id="garden-halo">
            <stop offset="0%" stopColor="var(--garden-moon)" stopOpacity="0.5" />
            <stop offset="45%" stopColor="var(--garden-moon)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--garden-moon)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="garden-glow">
            <stop offset="0%" stopColor="var(--garden-light)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--garden-light)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="garden-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--garden-water-1)" />
            <stop offset="100%" stopColor="var(--garden-water-2)" />
          </linearGradient>
          <linearGradient id="garden-hill-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--garden-hill-far)" />
            <stop offset="100%" stopColor="var(--garden-hill)" />
          </linearGradient>
          <radialGradient id="garden-vignette" cx="50%" cy="45%" r="75%">
            <stop offset="60%" stopColor="var(--garden-vignette)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--garden-vignette)" stopOpacity="0.55" />
          </radialGradient>
          <filter id="garden-mist" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="garden-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </>
      }
    >
      {/* Sky, stars, the moon. Always there. */}
      <rect width="1200" height="560" fill="url(#garden-sky)" />
      {STARS.map((star, i) => (
        <circle
          key={i}
          data-fx="twinkle"
          cx={star.x}
          cy={star.y}
          r={0.5 + star.r * 1.3}
          fill="var(--garden-star)"
          style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }}
          opacity={0.45 + star.r * 0.5}
        />
      ))}
      {BRIGHT.map((star, i) => (
        <g key={i} data-fx="twinkle" style={{ animationDelay: `${(star.r * 3).toFixed(2)}s` }} opacity={0.9}>
          <path
            d={`M${star.x} ${star.y - 6} L${star.x + 1.2} ${star.y - 1.2} L${star.x + 6} ${star.y} L${star.x + 1.2} ${star.y + 1.2} L${star.x} ${star.y + 6} L${star.x - 1.2} ${star.y + 1.2} L${star.x - 6} ${star.y} L${star.x - 1.2} ${star.y - 1.2} Z`}
            fill="var(--garden-star)"
          />
        </g>
      ))}
      {stage(
        "milky-way",
        <g>
          <path d="M0 40 C300 70 700 120 1200 190 L1200 236 C700 166 300 116 0 86 Z" fill="var(--garden-star)" opacity={0.08} filter="url(#garden-mist)" />
          {MILKY.map((star, i) => (
            <circle key={i} cx={star.x} cy={star.y} r={0.4 + star.r * 0.8} fill="var(--garden-star)" opacity={0.3 + star.r * 0.4} />
          ))}
        </g>,
      )}
      <g>
        <circle data-fx="halo" cx={820} cy={110} r={fullMoon ? 250 : 170} fill="url(#garden-halo)" />
        <circle cx={820} cy={110} r={moonR} fill="var(--garden-moon)" />
        <circle cx={806} cy={100} r={moonR * 0.18} fill="var(--garden-moon-shade)" opacity={0.35} />
        <circle cx={834} cy={122} r={moonR * 0.12} fill="var(--garden-moon-shade)" opacity={0.3} />
        <circle cx={826} cy={94} r={moonR * 0.08} fill="var(--garden-moon-shade)" opacity={0.25} />
      </g>
      {stage(
        "meteor",
        <g>
          <path data-fx="meteor" d="M420 60 l-70 34" stroke="var(--garden-star)" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
          <path data-fx="meteor" d="M1080 40 l-56 27" stroke="var(--garden-star)" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} style={{ animationDelay: "4.5s" }} />
        </g>,
      )}
      {stage(
        "halo",
        <circle cx={820} cy={110} r={fullMoon ? 92 : 78} fill="none" stroke="var(--garden-moon)" strokeWidth={2} opacity={0.35} />,
      )}
      {stage(
        "clouds",
        <g data-fx="drift" fill="var(--garden-moon)" opacity={0.28} filter="url(#garden-mist)">
          <ellipse cx={700} cy={150} rx={120} ry={10} />
          <ellipse cx={960} cy={84} rx={110} ry={9} />
        </g>,
      )}

      {/* The far hill and its pines, softened by distance. */}
      <path d={FAR_HILL} fill="var(--garden-hill-far)" />
      <g fill="var(--garden-treeline)">
        {PINES.map((p, i) => (
          <path key={i} d={`M${p.x} ${p.y - p.h} L${p.x + p.h * 0.22} ${p.y - p.h * 0.45} L${p.x + p.h * 0.14} ${p.y - p.h * 0.45} L${p.x + p.h * 0.3} ${p.y} L${p.x - p.h * 0.3} ${p.y} L${p.x - p.h * 0.14} ${p.y - p.h * 0.45} L${p.x - p.h * 0.22} ${p.y - p.h * 0.45} Z`} />
        ))}
      </g>
      {stage(
        "deer",
        <g fill="var(--garden-treeline)">
          {[
            [930, 304, 1],
            [962, 308, -1],
          ].map(([dx, dy, f], i) => (
            <g key={i} transform={`translate(${dx} ${dy}) scale(${f * 0.7} 0.7)`}>
              <ellipse cx={0} cy={-12} rx={12} ry={6} />
              <path d="M9 -15 L15 -26 L19 -24 L13 -12 Z" />
              <path d="M15 -27 l-3 -7 M17 -27 l3 -6" stroke="var(--garden-treeline)" strokeWidth={1.4} />
              {[-8, -4, 5, 9].map((lx) => (
                <rect key={lx} x={lx} y={-8} width={2} height={9} />
              ))}
            </g>
          ))}
        </g>,
      )}
      {stage(
        "steps",
        <g fill="var(--garden-stone)" opacity={0.7}>
          {[
            [262, 282],
            [272, 296],
            [284, 310],
            [298, 324],
            [312, 338],
            [326, 352],
          ].map(([sx, sy]) => (
            <rect key={sx} x={sx - 9} y={sy} width={18} height={4} rx={1.5} />
          ))}
        </g>,
      )}
      {stage(
        "hill-lanterns",
        <g>
          {[
            [258, 278],
            [292, 318],
            [330, 350],
            [170, 290],
          ].map(([lx, ly], i) => (
            <g key={i}>
              <circle cx={lx} cy={ly} r={9} fill="url(#garden-glow)" data-fx="glow" style={{ animationDelay: `${i * -1.1}s` }} />
              <circle cx={lx} cy={ly} r={2} fill="var(--garden-light)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "pavilion",
        <>
          <circle data-fx="glow" cx={226} cy={262} r={34} fill="url(#garden-glow)" />
          <rect x={196} y={276} width={60} height={5} rx={1} fill="var(--garden-stone-dark)" />
          <rect x={202} y={256} width={4} height={20} fill="var(--garden-stone-dark)" />
          <rect x={246} y={256} width={4} height={20} fill="var(--garden-stone-dark)" />
          <circle cx={226} cy={266} r={3.5} fill="var(--garden-light)" />
          <path d="M184 258 Q226 228 268 258 Z" fill="var(--garden-stone-dark)" />
          <path d="M218 236 L226 224 L234 236 Z" fill="var(--garden-stone-dark)" />
        </>,
      )}
      {stage(
        "bell",
        <g>
          <line x1={226} y1={244} x2={226} y2={250} stroke="var(--garden-stone-dark)" strokeWidth={1} />
          <path d="M221 258 Q226 246 231 258 Z" fill="var(--garden-light)" opacity={0.9} />
        </g>,
      )}
      {stage(
        "incense",
        <g stroke="var(--garden-mist)" strokeWidth={1.6} fill="none" opacity={0.6}>
          <path data-fx="steam" d="M238 236 q-6 -10 2 -18 q6 -8 -2 -18" />
          <path data-fx="steam" d="M244 238 q6 -12 -2 -20" style={{ animationDelay: "-1.6s" }} />
        </g>,
      )}
      {/* Mist between the hills. */}
      <g data-fx="drift" filter="url(#garden-mist)" opacity={0.55}>
        <ellipse cx={260} cy={336} rx={300} ry={16} fill="var(--garden-mist)" />
        <ellipse cx={860} cy={330} rx={340} ry={14} fill="var(--garden-mist)" />
      </g>

      <path d="M0 392 C200 352 380 372 520 386 S820 360 1000 376 S1150 382 1200 372 L1200 560 L0 560 Z" fill="var(--garden-hill)" />
      {stage(
        "bamboo",
        <g data-fx="sway">
          {[22, 38, 54, 70, 86].map((bx, i) => (
            <g key={bx}>
              <path d={`M${bx} 452 L${bx + 2} ${318 + (i % 3) * 14}`} stroke="var(--garden-leaf-lit)" strokeWidth={5} opacity={0.85} />
              {[0, 1, 2, 3].map((k) => (
                <line key={k} x1={bx - 3} y1={430 - k * 28} x2={bx + 5} y2={430 - k * 28} stroke="var(--garden-leaf-tree)" strokeWidth={1.4} />
              ))}
              <path d={`M${bx + 2} ${330 + (i % 3) * 14} q12 -6 20 2 M${bx + 2} ${360 + (i % 2) * 10} q-12 -6 -18 2`} stroke="var(--garden-leaf)" strokeWidth={3} fill="none" strokeLinecap="round" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "teahouse",
        <g>
          <rect x={112} y={378} width={66} height={36} fill="var(--garden-wood)" />
          <path d="M100 382 L145 352 L190 382 Z" fill="var(--garden-stone-dark)" />
          <path d="M96 384 L194 384" stroke="var(--garden-stone-dark)" strokeWidth={4} strokeLinecap="round" />
          <rect x={124} y={390} width={18} height={24} fill="var(--garden-stone-dark)" opacity={0.6} />
        </g>,
      )}
      {stage(
        "tea-light",
        <g>
          <circle cx={160} cy={398} r={24} fill="url(#garden-glow)" data-fx="glow" />
          <rect x={152} y={390} width={16} height={14} fill="var(--garden-light)" />
          <path d="M160 390 L160 404 M152 397 L168 397" stroke="var(--garden-wood)" strokeWidth={1.4} />
        </g>,
      )}
      {stage(
        "fence",
        <g stroke="var(--garden-wood)" strokeWidth={2.4}>
          <path d="M872 418 L1200 414 M872 432 L1200 428" strokeWidth={2} />
          {Array.from({ length: 17 }, (_, i) => 878 + i * 20).map((fx) => (
            <line key={fx} x1={fx} y1={410} x2={fx} y2={446} />
          ))}
        </g>,
      )}
      {stage(
        "moonflowers",
        <g>
          <path d="M876 420 Q930 404 980 422 T1090 418 T1196 420" stroke="var(--garden-leaf)" strokeWidth={2} fill="none" />
          {[892, 924, 958, 1004, 1038, 1084, 1120, 1160].map((mx, i) => (
            <g key={mx}>
              <circle cx={mx} cy={416 + (i % 2) * 6} r={5} fill="var(--garden-moon)" opacity={0.95} />
              <circle cx={mx} cy={416 + (i % 2) * 6} r={1.6} fill="var(--garden-light)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "pine",
        <g>
          <path d="M908 436 C904 412 914 396 906 376 L912 374 C920 394 912 414 916 436 Z" fill="var(--garden-bark)" />
          <path d="M910 400 L944 392 M908 384 L878 378" stroke="var(--garden-bark)" strokeWidth={3} strokeLinecap="round" />
          {[
            [910, 368, 30, 10],
            [946, 388, 22, 8],
            [876, 374, 20, 7],
          ].map(([px, py, rx, ry]) => (
            <g key={px}>
              <ellipse cx={px} cy={py} rx={rx} ry={ry} fill="var(--garden-leaf-tree)" />
              <ellipse cx={px + 4} cy={py - 3} rx={rx * 0.6} ry={ry * 0.5} fill="var(--garden-leaf-lit)" opacity={0.5} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "cherry",
        <>
          <path d="M696 402 C698 380 694 366 700 350 L706 352 C702 368 706 382 706 402 Z" fill="var(--garden-bark)" />
          <path d="M700 362 C690 352 680 350 670 352" stroke="var(--garden-bark)" strokeWidth={3} fill="none" />
          {[
            [700, 336, 30],
            [676, 350, 21],
            [726, 348, 23],
            [690, 318, 18],
            [716, 320, 17],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="var(--garden-blossom)" opacity={0.92} />
          ))}
          {[
            [714, 326, 12],
            [732, 342, 10],
            [702, 320, 9],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="var(--garden-blossom-lit)" opacity={0.8} />
          ))}
          {[
            [744, 380],
            [668, 392],
            [758, 398],
          ].map(([x, y], i) => (
            <circle key={i} data-fx="petal" cx={x} cy={y} r={2.2} fill="var(--garden-blossom)" style={{ animationDelay: `${i * 2.3}s` }} />
          ))}
        </>,
        { "data-fx": "sway" },
      )}
      <g data-fx="drift" filter="url(#garden-mist)" opacity={0.4} style={{ animationDelay: "-12s" }}>
        <ellipse cx={600} cy={414} rx={420} ry={12} fill="var(--garden-mist)" />
      </g>

      <path d="M0 432 C240 418 420 426 600 428 S960 418 1200 434 L1200 560 L0 560 Z" fill="var(--garden-ground)" />
      <g>
        <title>{SCENE.base}</title>
        {TUFTS.map((t, i) => (
          <path
            key={i}
            d={`M${t.x} ${t.y} q2 -${12 + t.r * 14} 5 0 m-3 0 q5 -${10 + t.r * 10} 10 -3 m-12 3 q-3 -${8 + t.r * 8} -7 -2`}
            stroke="var(--garden-leaf)"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            opacity={0.5 + t.r * 0.45}
          />
        ))}
        {[
          [150, 512, 16, 7],
          [1010, 528, 20, 8],
          [1068, 502, 12, 5],
        ].map(([x, y, rx, ry]) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="var(--garden-stone-dark)" opacity={0.85} />
            <ellipse cx={x + rx * 0.25} cy={y - ry * 0.35} rx={rx * 0.5} ry={ry * 0.35} fill="var(--garden-stone)" opacity={0.35} />
          </g>
        ))}
        <ellipse cx={1120} cy={452} rx={42} ry={18} fill="var(--garden-leaf-tree)" opacity={0.95} />
        <ellipse cx={1152} cy={456} rx={28} ry={13} fill="var(--garden-leaf-tree)" />
        <ellipse cx={1132} cy={444} rx={22} ry={8} fill="var(--garden-leaf-lit)" opacity={0.45} />
      </g>

      {stage(
        "moss",
        <g fill="var(--garden-leaf)" opacity={0.85}>
          <path d="M134 508 Q150 500 166 508 Q150 512 134 508 Z" />
          <path d="M990 524 Q1010 516 1030 524 Q1010 528 990 524 Z" />
          <path d="M1056 498 Q1068 492 1080 498 Q1068 502 1056 498 Z" />
          <path d="M364 497 Q372 493 380 497 Z" />
        </g>,
      )}
      {stage(
        "gravel",
        <g>
          <path d="M960 530 L1200 524 L1200 560 L940 560 Z" fill="var(--garden-stone)" opacity={0.45} />
          {[536, 544, 552].map((gy) => (
            <path key={gy} d={`M954 ${gy} Q1080 ${gy - 6} 1200 ${gy - 4}`} stroke="var(--garden-stone-dark)" strokeWidth={1.2} fill="none" opacity={0.5} />
          ))}
        </g>,
      )}
      {stage(
        "bench",
        <g>
          <rect x={1052} y={496} width={60} height={8} rx={2} fill="var(--garden-stone)" />
          <rect x={1058} y={504} width={10} height={14} fill="var(--garden-stone-dark)" />
          <rect x={1096} y={504} width={10} height={14} fill="var(--garden-stone-dark)" />
        </g>,
      )}
      {stage(
        "cat",
        <g transform="translate(1086 496)" fill="var(--garden-fore)">
          <ellipse cx={0} cy={-5} rx={11} ry={5.5} />
          <circle cx={9} cy={-9} r={4.5} />
          <path d="M6 -12 l1.5 -4 l2 3 Z M10.5 -12 l2 -3.5 l1 4 Z" />
          <path d="M-11 -3 q-6 4 0 7" stroke="var(--garden-fore)" strokeWidth={2} fill="none" />
        </g>,
      )}
      {stage(
        "basin",
        <g>
          <ellipse cx={112} cy={490} rx={22} ry={9} fill="var(--garden-stone-dark)" />
          <ellipse cx={112} cy={486} rx={20} ry={7} fill="var(--garden-stone)" />
          <ellipse cx={112} cy={486} rx={13} ry={4} fill="url(#garden-water)" />
          <ellipse cx={116} cy={485} rx={4} ry={1} fill="var(--garden-moon)" opacity={0.6} data-fx="shimmer" />
        </g>,
      )}
      {stage(
        "spout",
        <g>
          <line x1={150} y1={500} x2={150} y2={468} stroke="var(--garden-leaf-lit)" strokeWidth={4} />
          <path d="M150 470 L120 478" stroke="var(--garden-leaf-lit)" strokeWidth={5} strokeLinecap="round" />
          <circle data-fx="steam" cx={120} cy={482} r={1.6} fill="var(--garden-ripple)" />
        </g>,
      )}
      {stage(
        "azaleas",
        <g>
          {[
            [304, 448],
            [880, 446],
          ].map(([ax, ay]) => (
            <g key={ax}>
              <ellipse cx={ax} cy={ay} rx={26} ry={13} fill="var(--garden-leaf-tree)" />
              {[-16, -6, 4, 14, -10, 8].map((dx, i) => (
                <circle key={i} cx={ax + dx} cy={ay - 6 + (i > 3 ? 6 : 0)} r={4} fill="var(--garden-blossom)" />
              ))}
            </g>
          ))}
        </g>,
      )}
      {stage(
        "hydrangeas",
        <g>
          {[
            [52, 474],
            [1160, 466],
          ].map(([hx, hy]) => (
            <g key={hx}>
              <ellipse cx={hx} cy={hy} rx={24} ry={12} fill="var(--garden-leaf-tree)" />
              {[-12, 0, 12].map((dx) => (
                <circle key={dx} cx={hx + dx} cy={hy - 8} r={8} fill="var(--garden-hydrangea)" opacity={0.9} />
              ))}
            </g>
          ))}
        </g>,
      )}
      {stage(
        "stream",
        <g>
          <path d="M304 424 C320 430 326 444 342 452 C356 458 360 468 368 480 L386 478 C380 466 372 454 356 446 C340 438 334 426 318 420 Z" fill="url(#garden-water)" />
          <path data-fx="flow" d="M330 432 q8 10 16 20" stroke="var(--garden-ripple)" strokeWidth={1.2} fill="none" />
        </g>,
      )}
      {stage(
        "falls",
        <g>
          <ellipse cx={358} cy={470} rx={9} ry={5} fill="var(--garden-stone-dark)" />
          <ellipse cx={378} cy={474} rx={8} ry={4} fill="var(--garden-stone-dark)" />
          <path data-fx="flow" d="M364 468 L366 482 M370 468 L372 484" stroke="var(--garden-ripple)" strokeWidth={2} strokeLinecap="round" />
        </g>,
      )}
      {stage(
        "rabbit",
        <g transform="translate(84 540)" fill="var(--garden-stone)">
          <ellipse cx={0} cy={-7} rx={10} ry={7} />
          <circle cx={8} cy={-13} r={5} />
          <ellipse cx={8} cy={-22} rx={2} ry={6} />
          <ellipse cx={12} cy={-21} rx={2} ry={6} transform="rotate(14 12 -21)" />
          <circle cx={-10} cy={-6} r={3} fill="var(--garden-moon)" />
        </g>,
      )}
      {stage(
        "willow",
        <>
          <path d="M1046 446 C1044 400 1040 360 1052 322 L1060 322 C1054 360 1058 400 1058 446 Z" fill="var(--garden-bark)" />
          <ellipse cx={1055} cy={318} rx={66} ry={28} fill="var(--garden-leaf-tree)" />
          <ellipse cx={1070} cy={308} rx={40} ry={14} fill="var(--garden-leaf-lit)" opacity={0.5} />
          {[-60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60].map((dx) => (
            <path
              key={dx}
              d={`M${1055 + dx} ${318 + Math.abs(dx) / 6} q${dx / 4} 50 ${dx / 6} ${96 - Math.abs(dx) / 2}`}
              stroke={dx > 0 ? "var(--garden-leaf-lit)" : "var(--garden-leaf-tree)"}
              strokeOpacity={dx > 0 ? 0.7 : 1}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </>,
        { "data-fx": "sway" },
      )}

      {stage(
        "mushrooms",
        <g>
          {[
            [1020, 450],
            [1034, 452],
            [1082, 448],
            [1096, 452],
          ].map(([mx, my], i) => (
            <g key={i}>
              <circle cx={mx} cy={my - 4} r={10} fill="url(#garden-glow)" data-fx="glow" style={{ animationDelay: `${i * -1.3}s` }} />
              <rect x={mx - 1.2} y={my - 6} width={2.4} height={6} fill="var(--garden-moon)" />
              <path d={`M${mx - 5} ${my - 5} Q${mx} ${my - 13} ${mx + 5} ${my - 5} Z`} fill="var(--garden-light)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "fireflies-willow",
        WILLOW_FLIES.map((fly, i) => (
          <g key={i} data-fx="firefly" style={{ animationDelay: `${(-fly.r * 7).toFixed(2)}s` }}>
            <circle cx={round(fly.x)} cy={round(fly.y)} r={6} fill="var(--garden-light)" opacity={0.25} filter="url(#garden-soft)" />
            <circle cx={round(fly.x)} cy={round(fly.y)} r={2} fill="var(--garden-light)" />
          </g>
        )),
      )}
      {stage(
        "maple",
        <>
          <path d="M244 448 C246 420 244 396 248 372 L258 372 C260 396 258 420 262 448 Z" fill="var(--garden-bark)" />
          <path d="M252 400 C238 390 228 386 216 388" stroke="var(--garden-bark)" strokeWidth={4} fill="none" strokeLinecap="round" />
          <Canopy
            blobs={[
              [252, 352, 44],
              [218, 378, 30],
              [288, 378, 32],
              [236, 330, 26],
              [276, 334, 26],
            ]}
          />
        </>,
        { "data-fx": "sway" },
      )}

      {stage(
        "owl",
        <g transform="translate(222 372)">
          <ellipse cx={0} cy={0} rx={9} ry={12} fill="var(--garden-heron)" />
          <circle cx={-3.5} cy={-4} r={3} fill="var(--garden-light)" />
          <circle cx={3.5} cy={-4} r={3} fill="var(--garden-light)" />
          <circle cx={-3.5} cy={-4} r={1.2} fill="var(--garden-fore)" />
          <circle cx={3.5} cy={-4} r={1.2} fill="var(--garden-fore)" />
          <path d="M-7 -11 l2 -5 l2 4 M7 -11 l-2 -5 l-2 4" fill="var(--garden-heron)" />
        </g>,
      )}
      {stage(
        "chime",
        <g>
          <line x1={286} y1={384} x2={286} y2={398} stroke="var(--garden-stone-dark)" strokeWidth={1} />
          <g data-fx="sway">
            {[-6, -2, 2, 6].map((dx, i) => (
              <line key={dx} x1={286 + dx} y1={400} x2={286 + dx} y2={410 + i * 3} stroke="var(--garden-light)" strokeWidth={2} strokeLinecap="round" />
            ))}
          </g>
        </g>,
      )}
      {/* The pond, the moon in it, and what's in and on it. */}
      {stage(
        "pond",
        <>
          <ellipse cx={600} cy={494} rx={236} ry={45} fill="url(#garden-water)" />
          <ellipse cx={600} cy={494} rx={236} ry={45} fill="none" stroke="var(--garden-water-rim)" strokeWidth={3} />
          <ellipse cx={760} cy={474} rx={24} ry={5} fill="var(--garden-moon)" opacity={0.55} data-fx="shimmer" />
          <ellipse data-fx="ripple" cx={600} cy={496} rx={120} ry={16} fill="none" stroke="var(--garden-ripple)" strokeWidth={1.5} />
          <ellipse data-fx="ripple" cx={600} cy={496} rx={56} ry={7} fill="none" stroke="var(--garden-ripple)" strokeWidth={1.5} />
          {[
            [372, 500, 9],
            [828, 498, 8],
            [480, 532, 7],
          ].map(([x, y, r]) => (
            <ellipse key={x} cx={x} cy={y} rx={r * 1.6} ry={r * 0.7} fill="var(--garden-stone-dark)" />
          ))}
        </>,
      )}
      {stage(
        "full-moon",
        <g opacity={0.6}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} data-fx="shimmer" x={748 - (6 - i) * 4} y={466 + i * 8} width={24 + (6 - i) * 8} height={2.5} rx={1.2} fill="var(--garden-moon)" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </g>,
      )}
      {stage(
        "koi",
        [
          { x: 560, y: 498, d: "0s" },
          { x: 650, y: 486, d: "-6s" },
          { x: 610, y: 512, d: "-10s" },
        ].map((fish) => (
          <g key={fish.x} data-fx="swim" style={{ animationDelay: fish.d }}>
            <ellipse cx={fish.x} cy={fish.y} rx={10} ry={4} fill="var(--garden-koi)" />
            <circle cx={fish.x + 3} cy={fish.y - 1} r={2} fill="var(--garden-koi-spot)" />
            <path d={`M${fish.x - 9} ${fish.y} l-7 -4 l0 8 z`} fill="var(--garden-koi)" />
          </g>
        )),
      )}
      {stage(
        "lilies",
        [
          [690, 505, 15],
          [722, 488, 10],
          [520, 510, 12],
          [470, 486, 9],
        ].map(([x, y, r]) => (
          <g key={x}>
            <path d={`M${x - r} ${y} a${r} ${r / 3} 0 1 0 ${r * 2} 0 l-${r} -1 z`} fill="var(--garden-lily)" />
            <path d={`M${x - r / 4} ${y - 1} l${r / 4} -${r / 2.2} l${r / 4} ${r / 2.2} z`} fill="var(--garden-flower)" />
            <path d={`M${x - r / 2.6} ${y} l${r / 6} -${r / 3} l${r / 6} ${r / 3} z`} fill="var(--garden-flower)" opacity={0.8} />
          </g>
        )),
      )}
      {stage(
        "irises",
        [
          [762, 538],
          [784, 532],
          [438, 542],
          [456, 536],
        ].map(([ix, iy]) => (
          <g key={ix}>
            <path d={`M${ix} ${iy} q-2 -14 -6 -22 M${ix} ${iy} q3 -14 7 -20 M${ix} ${iy} L${ix} ${iy - 24}`} stroke="var(--garden-leaf)" strokeWidth={1.8} fill="none" strokeLinecap="round" />
            <path d={`M${ix} ${iy - 24} q-6 -2 -6 -8 q4 0 6 4 q2 -6 6 -6 q0 6 -6 10 Z`} fill="var(--garden-hydrangea)" />
          </g>
        )),
      )}
      {stage(
        "pond-stars",
        <g>
          {[
            [470, 488],
            [520, 476],
            [640, 470],
            [690, 520],
            [580, 530],
            [430, 512],
            [800, 506],
          ].map(([sx, sy], i) => (
            <circle key={i} data-fx="twinkle" cx={sx} cy={sy} r={1.2} fill="var(--garden-star)" opacity={0.7} style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </g>,
      )}
      {stage(
        "koi-gold",
        [
          { x: 520, y: 492, d: "-3s" },
          { x: 690, y: 500, d: "-8s" },
          { x: 640, y: 520, d: "-12s" },
        ].map((fish) => (
          <g key={fish.x} data-fx="swim" style={{ animationDelay: fish.d }}>
            <ellipse cx={fish.x} cy={fish.y} rx={9} ry={3.6} fill="var(--garden-koi-gold)" />
            <path d={`M${fish.x - 8} ${fish.y} l-6 -3.5 l0 7 z`} fill="var(--garden-koi-gold)" />
            <circle cx={fish.x + 2} cy={fish.y} r={1.6} fill="var(--garden-moon)" />
          </g>
        )),
      )}
      {stage(
        "lotus",
        [
          [640, 506],
          [586, 518],
          [760, 492],
        ].map(([lx, ly]) => (
          <g key={lx}>
            <ellipse cx={lx} cy={ly + 2} rx={12} ry={3} fill="var(--garden-lily)" />
            {[-7, 0, 7].map((dx) => (
              <path key={dx} d={`M${round(lx + dx * 0.6)} ${ly} q${round(dx * 0.4)} -9 ${dx} -10 q${round(-dx * 0.1)} 6 ${round(-dx * 0.6)} 10 Z`} fill="var(--garden-blossom)" />
            ))}
            <path d={`M${lx - 3} ${ly} q3 -12 6 0 Z`} fill="var(--garden-blossom-lit)" />
          </g>
        )),
      )}
      {stage(
        "petals",
        [
          [610, 486],
          [650, 480],
          [548, 498],
          [702, 494],
          [584, 474],
          [668, 512],
        ].map(([px, py], i) => <ellipse key={i} cx={px} cy={py} rx={2.6} ry={1.4} fill="var(--garden-blossom)" opacity={0.85} />),
      )}
      {stage(
        "frog",
        <g transform="translate(722 486)">
          <ellipse cx={0} cy={-2} rx={6} ry={4} fill="var(--garden-leaf-lit)" />
          <circle cx={-3} cy={-6} r={1.8} fill="var(--garden-leaf-lit)" />
          <circle cx={3} cy={-6} r={1.8} fill="var(--garden-leaf-lit)" />
        </g>,
      )}
      {stage(
        "turtle",
        <g transform="translate(372 496)">
          <ellipse cx={0} cy={-4} rx={8} ry={4.5} fill="var(--garden-leaf-tree)" />
          <path d="M-5 -6 L5 -6 M0 -8 L0 -2" stroke="var(--garden-leaf-lit)" strokeWidth={1} opacity={0.6} />
          <circle cx={9} cy={-4} r={2.4} fill="var(--garden-leaf)" />
        </g>,
      )}
      {stage(
        "ducks",
        [
          [470, 512, 1],
          [500, 520, -1],
        ].map(([dx, dy, f], i) => (
          <g key={i} transform={`translate(${dx} ${dy}) scale(${f} 1)`}>
            <g data-fx="bob" style={{ animationDelay: `${i * -1.5}s` }}>
              <ellipse cx={0} cy={0} rx={10} ry={4.5} fill="var(--garden-flower)" />
              <ellipse cx={-2} cy={-2} rx={5} ry={2.4} fill="var(--garden-light)" />
              <circle cx={7} cy={-5} r={3.6} fill="var(--garden-leaf-lit)" />
              <path d="M10 -5 l4 1 l-4 1 Z" fill="var(--garden-flower-2)" />
            </g>
          </g>
        )),
      )}
      {stage(
        "floating",
        [
          [560, 486],
          [612, 500],
          [676, 486],
          [728, 510],
          [512, 524],
        ].map(([fx, fy], i) => (
          <g key={i} data-fx="bob" style={{ animationDelay: `${i * -1.1}s` }}>
            <circle cx={fx} cy={fy - 5} r={14} fill="url(#garden-glow)" />
            <path d={`M${fx - 5} ${fy} L${fx + 5} ${fy} L${fx + 4} ${fy - 9} L${fx - 4} ${fy - 9} Z`} fill="var(--garden-light)" />
          </g>
        )),
      )}
      {stage(
        "mist",
        <g data-fx="drift" filter="url(#garden-mist)" opacity={0.5}>
          <ellipse cx={560} cy={480} rx={180} ry={9} fill="var(--garden-mist)" />
          <ellipse cx={700} cy={510} rx={140} ry={8} fill="var(--garden-mist)" />
        </g>,
      )}
      {stage(
        "reeds",
        [
          [380, 476],
          [398, 468],
          [812, 462],
          [826, 474],
        ].map(([rx, ry]) => (
          <g key={rx} data-fx="sway">
            {[-5, -1, 3, 7].map((dx, i) => (
              <path key={dx} d={`M${rx + dx} ${ry} q${dx * 0.5} -16 ${dx * 1.1} ${-26 - i * 3}`} stroke="var(--garden-leaf)" strokeWidth={1.6} fill="none" strokeLinecap="round" />
            ))}
            <ellipse cx={rx - 6} cy={ry - 27} rx={1.8} ry={4} fill="var(--garden-bark)" />
          </g>
        )),
      )}
      {stage(
        "fireflies-pond",
        POND_FLIES.map((fly, i) => (
          <g key={i} data-fx="firefly" style={{ animationDelay: `${(-fly.r * 7).toFixed(2)}s` }}>
            <circle cx={round(fly.x)} cy={round(fly.y)} r={6} fill="var(--garden-light)" opacity={0.22} filter="url(#garden-soft)" />
            <circle cx={round(fly.x)} cy={round(fly.y)} r={1.8} fill="var(--garden-light)" />
          </g>
        )),
      )}
      {stage(
        "bridge",
        <>
          <path d="M392 494 Q468 436 544 494" stroke="var(--garden-wood)" strokeWidth={8} fill="none" strokeLinecap="round" />
          <path d="M398 480 Q468 424 538 480" stroke="var(--garden-wood)" strokeWidth={2.5} fill="none" />
          {[0.15, 0.35, 0.65, 0.85].map((t) => {
            const bow = t * (1 - t);
            return (
              <line key={t} x1={392 + 152 * t} y1={494 - 116 * bow} x2={398 + 140 * t} y2={480 - 112 * bow} stroke="var(--garden-wood)" strokeWidth={2} />
            );
          })}
          <path d="M398 498 Q468 448 538 498" stroke="var(--garden-water-2)" strokeWidth={2} fill="none" opacity={0.4} />
        </>,
      )}
      {stage(
        "heron",
        <>
          <line x1={850} y1={500} x2={846} y2={474} stroke="var(--garden-heron)" strokeWidth={2} />
          <line x1={858} y1={500} x2={854} y2={474} stroke="var(--garden-heron)" strokeWidth={2} />
          <ellipse cx={852} cy={466} rx={16} ry={9} fill="var(--garden-heron)" />
          <path d="M862 462 Q874 440 866 428" stroke="var(--garden-heron)" strokeWidth={4} fill="none" strokeLinecap="round" />
          <circle cx={866} cy={426} r={5} fill="var(--garden-heron)" />
          <path d="M870 425 l13 2 l-13 2 z" fill="var(--garden-heron)" />
          <ellipse cx={852} cy={503} rx={14} ry={2.5} fill="var(--garden-heron)" opacity={0.25} />
        </>,
      )}

      {stage("lantern", <Lantern x={944} y={466} />)}
      {stage(
        "moths",
        [
          [930, 404, 0],
          [958, 396, -1.4],
          [944, 386, -2.8],
        ].map(([mx, my, d], i) => (
          <g key={i} data-fx="firefly" style={{ animationDelay: `${d}s` }}>
            <path d={`M${mx} ${my} l-4 -3 l0 6 Z M${mx} ${my} l4 -3 l0 6 Z`} fill="var(--garden-moon)" opacity={0.85} />
          </g>
        )),
      )}
      {stage("bridge-lantern", <Lantern x={556} y={488} scale={0.42} />)}
      {stage(
        "path-lights",
        [
          [222, 540],
          [278, 526],
          [324, 516],
          [176, 552],
        ].map(([lx, ly], i) => (
          <g key={i}>
            <circle cx={lx} cy={ly - 6} r={11} fill="url(#garden-glow)" data-fx="glow" style={{ animationDelay: `${i * -1.2}s` }} />
            <rect x={lx - 2.5} y={ly - 10} width={5} height={8} rx={1} fill="var(--garden-light)" />
          </g>
        )),
      )}
      {stage(
        "path",
        [
          [196, 548, 24, 8],
          [252, 536, 22, 7],
          [302, 524, 19, 6],
          [344, 513, 17, 5.5],
        ].map(([x, y, rx, ry]) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="var(--garden-stone)" opacity={0.85} />
            <ellipse cx={x + rx * 0.2} cy={y - ry * 0.3} rx={rx * 0.55} ry={ry * 0.4} fill="var(--garden-moon)" opacity={0.18} />
          </g>
        )),
      )}
      {stage(
        "flowers",
        [
          [150, 470],
          [330, 540],
          [900, 528],
          [1086, 472],
          [962, 452],
          [128, 530],
          [700, 446],
        ].map(([x, y], i) => (
          <g key={i}>
            <line x1={x} y1={y} x2={x} y2={y - 11} stroke="var(--garden-leaf)" strokeWidth={1.5} />
            <circle cx={x} cy={y - 13} r={4.2} fill={i % 2 ? "var(--garden-flower-2)" : "var(--garden-flower)"} />
            <circle cx={x} cy={y - 13} r={1.5} fill="var(--garden-light)" opacity={0.8} />
            <circle cx={x + 9} cy={y - 6} r={3.2} fill="var(--garden-flower)" />
            <line x1={x + 9} y1={y} x2={x + 9} y2={y - 4} stroke="var(--garden-leaf)" strokeWidth={1.5} />
          </g>
        )),
      )}
      {stage(
        "fireflies",
        FIREFLIES.map((fly, i) => (
          <g key={i} data-fx="firefly" style={{ animationDelay: `${(-fly.r * 7).toFixed(2)}s` }}>
            <circle cx={fly.x} cy={fly.y} r={7} fill="var(--garden-light)" opacity={0.25} filter="url(#garden-soft)" />
            <circle cx={fly.x} cy={fly.y} r={2.2} fill="var(--garden-light)" />
          </g>
        )),
      )}

      {/* The nearest grass, and the dark at the edges. */}
      <g fill="var(--garden-fore)">
        {BLADES.map((b, i) => (
          <path key={i} d={`M${b.x} 562 q${3 - b.r * 6} -${16 + b.r * 26} ${6 + b.r * 6} -${22 + b.r * 30} q-2 ${14 + b.r * 18} 5 ${24 + b.r * 30} z`} />
        ))}
      </g>
      {stage("silver", <rect width="1200" height="560" fill="var(--garden-moon)" opacity={0.07} pointerEvents="none" />)}
      <rect width="1200" height="560" fill="url(#garden-vignette)" pointerEvents="none" />
    </SceneSvg>
  );
}
