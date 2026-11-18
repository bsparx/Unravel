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
 * The moonlit garden. A meadow under the moon, and fourteen things that come
 * into it, one for each day of the last two weeks you sat. Hills fade into
 * mist behind, the canopies catch the moon on one side, the moon lies in the
 * pond once there is one, and the full moon comes with a whole fortnight.
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
      <g>
        <circle data-fx="halo" cx={820} cy={110} r={fullMoon ? 250 : 170} fill="url(#garden-halo)" />
        <circle cx={820} cy={110} r={moonR} fill="var(--garden-moon)" />
        <circle cx={806} cy={100} r={moonR * 0.18} fill="var(--garden-moon-shade)" opacity={0.35} />
        <circle cx={834} cy={122} r={moonR * 0.12} fill="var(--garden-moon-shade)" opacity={0.3} />
        <circle cx={826} cy={94} r={moonR * 0.08} fill="var(--garden-moon-shade)" opacity={0.25} />
      </g>
      {fullMoon && (
        <g>
          <path data-fx="meteor" d="M420 60 l-70 34" stroke="var(--garden-star)" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
          <path data-fx="meteor" d="M1080 40 l-56 27" stroke="var(--garden-star)" strokeWidth={1.5} strokeLinecap="round" opacity={0.6} style={{ animationDelay: "4.5s" }} />
        </g>
      )}

      {/* The far hill and its pines, softened by distance. */}
      <path d={FAR_HILL} fill="var(--garden-hill-far)" />
      <g fill="var(--garden-treeline)">
        {PINES.map((p, i) => (
          <path key={i} d={`M${p.x} ${p.y - p.h} L${p.x + p.h * 0.22} ${p.y - p.h * 0.45} L${p.x + p.h * 0.14} ${p.y - p.h * 0.45} L${p.x + p.h * 0.3} ${p.y} L${p.x - p.h * 0.3} ${p.y} L${p.x - p.h * 0.14} ${p.y - p.h * 0.45} L${p.x - p.h * 0.22} ${p.y - p.h * 0.45} Z`} />
        ))}
      </g>
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
      {/* Mist between the hills. */}
      <g data-fx="drift" filter="url(#garden-mist)" opacity={0.55}>
        <ellipse cx={260} cy={336} rx={300} ry={16} fill="var(--garden-mist)" />
        <ellipse cx={860} cy={330} rx={340} ry={14} fill="var(--garden-mist)" />
      </g>

      <path d="M0 392 C200 352 380 372 520 386 S820 360 1000 376 S1150 382 1200 372 L1200 560 L0 560 Z" fill="var(--garden-hill)" />
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
      {fullMoon && (
        <g opacity={0.6}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} data-fx="shimmer" x={748 - (6 - i) * 4} y={466 + i * 8} width={24 + (6 - i) * 8} height={2.5} rx={1.2} fill="var(--garden-moon)" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </g>
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
      <rect width="1200" height="560" fill="url(#garden-vignette)" pointerEvents="none" />
    </SceneSvg>
  );
}
