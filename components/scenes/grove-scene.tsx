import { SCENES } from "@/lib/scenes";

import { SceneSvg, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.exercises;

const WILDFLOWERS = scatter(41, 30, { x: [60, 440], y: [484, 548] });
const FAR_CEDARS: [number, number, number][] = [
  [76, 336, 1.05],
  [124, 342, 0.85],
  [168, 332, 1.15],
  [218, 344, 0.9],
  [264, 348, 0.78],
  [930, 340, 0.92],
  [978, 332, 1.18],
  [1036, 340, 0.96],
  [1086, 334, 1.12],
  [1140, 344, 0.88],
];
const BIRCHES: [number, number, number][] = [
  [158, 476, 1],
  [210, 488, 0.86],
  [1038, 474, 0.95],
  [1092, 486, 0.82],
];

function Cedar({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-3} y={-8} width={6} height={14} fill="var(--grove-trunk)" />
      <path d="M0 -84 L20 -44 L10 -44 L26 -16 L13 -16 L30 6 L-30 6 L-13 -16 L-26 -16 L-10 -44 L-20 -44 Z" fill="var(--grove-cedar)" />
      <path d="M0 -84 L20 -44 L10 -44 L26 -16 L13 -16 L30 6 L5 6 Z" fill="var(--grove-cedar-lit)" opacity={0.45} />
    </g>
  );
}

function Birch({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} data-fx="sway" style={{ transformOrigin: "0px 0px" }}>
      <path d="M-4 0 Q-2 -68 2 -136 L7 -136 Q4 -68 5 0 Z" fill="var(--grove-birch-bark)" />
      <path d="M-2 -26 h5 M0 -54 h4 M-1 -82 h5 M1 -108 h4" stroke="var(--grove-trunk)" strokeWidth={1.6} opacity={0.45} />
      <ellipse cx={-12} cy={-128} rx={26} ry={18} fill="var(--grove-birch-leaf)" opacity={0.85} />
      <ellipse cx={14} cy={-142} rx={30} ry={20} fill="var(--grove-birch-leaf-lit)" opacity={0.88} />
      <ellipse cx={-2} cy={-156} rx={24} ry={16} fill="var(--grove-birch-leaf)" opacity={0.9} />
    </g>
  );
}

function Fern({ x, y, flip = 1, s = 1 }: { x: number; y: number; flip?: 1 | -1; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`} data-fx="sway" style={{ transformOrigin: "0px 0px" }}>
      <path d="M0 0 Q14 -24 38 -32" stroke="var(--grove-fern)" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M8 -10 L18 -18 M14 -16 L26 -24 M20 -22 L32 -28 M8 -10 L18 -6 M16 -16 L28 -14 M24 -22 L34 -20" stroke="var(--grove-fern-lit)" strokeWidth={2} strokeLinecap="round" />
      <path d="M0 0 Q6 -20 18 -38" stroke="var(--grove-fern)" strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.85} />
    </g>
  );
}

/**
 * The waterfall grove (Exercises). Quiet stones in a misty glen, and fourteen
 * things that arrive as you keep your training days: a clear stream, ferns,
 * stepping stones, the cascade, a turquoise pool, ridge cedars, moss, a timber
 * footbridge, wildflowers, silver birches, butterflies, sunbeams, swallows,
 * and at last a rainbow in the mist.
 */
export function GroveScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const fullFlow = has("rainbow");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="grove-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--grove-sky-1)" />
            <stop offset="55%" stopColor="var(--grove-sky-2)" />
            <stop offset="100%" stopColor="var(--grove-sky-3)" />
          </linearGradient>
          <linearGradient id="grove-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--grove-water-light)" />
            <stop offset="55%" stopColor="var(--grove-water)" />
            <stop offset="100%" stopColor="var(--grove-water-deep)" />
          </linearGradient>
          <linearGradient id="grove-falls" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--grove-foam)" stopOpacity="0.95" />
            <stop offset="45%" stopColor="var(--grove-water-light)" stopOpacity="0.88" />
            <stop offset="100%" stopColor="var(--grove-foam)" stopOpacity="0.92" />
          </linearGradient>
          <linearGradient id="grove-beam" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="var(--grove-sun)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--grove-sun)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="grove-rainbow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff94a8" stopOpacity="0.55" />
            <stop offset="28%" stopColor="#ffd27a" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#8ce6b8" stopOpacity="0.55" />
            <stop offset="80%" stopColor="#88cfff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#c5a3ff" stopOpacity="0.5" />
          </linearGradient>
          <filter id="grove-mist" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </>
      }
    >
      {/* Sky */}
      <rect width="1200" height="560" fill="url(#grove-sky)" />

      {/* Distant misty ridges */}
      <path d="M0 300 Q190 230 390 278 T820 264 Q1020 236 1200 284 L1200 560 L0 560 Z" fill="var(--grove-far)" />
      <path d="M0 340 Q240 286 480 318 T960 308 L1200 326 L1200 560 L0 560 Z" fill="var(--grove-mid)" />

      {/* Tall cedars on the ridge */}
      {stage(
        "cedars",
        FAR_CEDARS.map(([x, y, s]) => <Cedar key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}

      {/* The cliff face & glen base */}
      <g>
        <title>{SCENE.base}</title>
        <path d="M260 440 L318 258 L460 226 L560 242 L684 228 L830 250 L924 440 Z" fill="var(--grove-cliff)" />
        <path d="M260 440 L318 258 L460 226 L496 314 L468 440 Z" fill="var(--grove-cliff-shade)" />
        <path d="M684 228 L830 250 L924 440 L744 440 L710 310 Z" fill="var(--grove-cliff-shade)" opacity={0.65} />
        {/* Rock ledges */}
        <path d="M350 296 L466 286 M692 288 L814 300 M322 356 L450 348 M730 362 L862 354" stroke="var(--grove-cliff-edge)" strokeWidth={2.5} strokeLinecap="round" opacity={0.55} />
      </g>

      {/* Stage 1: a clear stream trickling down the rock shelf */}
      {stage(
        "stream",
        <g>
          <path d="M582 238 Q576 310 584 410 L610 410 Q616 310 608 238 Z" fill="var(--grove-water-light)" opacity={0.7} />
          <path d="M586 410 C560 448 534 486 486 560 L692 560 C662 492 640 452 612 410 Z" fill="url(#grove-water)" opacity={0.8} />
        </g>,
      )}

      {/* Stage 4: full waterfall cascade */}
      {stage(
        "cascade",
        <g>
          <path d="M540 236 Q532 320 534 416 L658 416 Q660 320 650 236 Z" fill="url(#grove-falls)" />
          <g stroke="var(--grove-foam)" strokeWidth={3} strokeLinecap="round" opacity={0.85} data-fx="shimmer">
            <line x1={556} y1={244} x2={552} y2={408} />
            <line x1={584} y1={240} x2={582} y2={412} />
            <line x1={614} y1={242} x2={616} y2={410} />
            <line x1={640} y1={246} x2={644} y2={406} />
          </g>
          <g filter="url(#grove-mist)" opacity={0.75}>
            <ellipse cx={596} cy={418} rx={96} ry={18} fill="var(--grove-foam)" />
          </g>
        </g>,
      )}

      {/* Valley banks */}
      <path d="M0 404 C160 390 320 402 496 426 L440 560 L0 560 Z" fill="var(--grove-bank)" />
      <path d="M1200 408 C1040 392 860 402 696 426 L750 560 L1200 560 Z" fill="var(--grove-bank)" />

      {/* Stage 5: turquoise pool below */}
      {stage(
        "pool",
        <g>
          <ellipse cx={596} cy={448} rx={182} ry={40} fill="url(#grove-water)" />
          <path d="M446 462 C474 494 460 526 420 560 L784 560 C744 524 726 492 746 462 Z" fill="url(#grove-water)" />
          <ellipse cx={596} cy={446} rx={68} ry={14} fill="none" stroke="var(--grove-foam)" strokeWidth={1.8} opacity={0.7} data-fx="ripple" />
          <ellipse cx={596} cy={446} rx={114} ry={22} fill="none" stroke="var(--grove-water-light)" strokeWidth={1.4} opacity={0.45} data-fx="shimmer" />
        </g>,
      )}

      {/* Foreground quiet stones (part of base) */}
      <g>
        <ellipse cx={306} cy={476} rx={52} ry={22} fill="var(--grove-stone)" />
        <ellipse cx={292} cy={468} rx={36} ry={14} fill="var(--grove-stone-lit)" />
        <ellipse cx={896} cy={472} rx={58} ry={24} fill="var(--grove-stone)" />
        <ellipse cx={882} cy={464} rx={40} ry={14} fill="var(--grove-stone-lit)" />
        <ellipse cx={416} cy={522} rx={34} ry={14} fill="var(--grove-stone)" />
        <ellipse cx={792} cy={520} rx={38} ry={15} fill="var(--grove-stone)" />
      </g>

      {/* Stage 7: moss on the boulders */}
      {stage(
        "moss",
        <g fill="var(--grove-moss)">
          <path d="M262 466 Q292 448 334 462 Q314 472 262 466 Z" />
          <path d="M846 462 Q886 444 934 460 Q906 470 846 462 Z" />
          <path d="M388 516 Q416 504 444 516 Q418 522 388 516 Z" />
          <path d="M760 514 Q792 500 822 514 Q792 520 760 514 Z" />
        </g>,
      )}

      {/* Stage 3: river stepping stones */}
      {stage(
        "stones",
        <g>
          {[
            [474, 514, 24, 9],
            [534, 522, 26, 10],
            [598, 516, 25, 9],
            [662, 524, 26, 10],
            [722, 514, 24, 9],
          ].map(([cx, cy, rx, ry]) => (
            <g key={`${cx}-${cy}`}>
              <ellipse cx={cx} cy={cy + 3} rx={rx} ry={ry} fill="var(--grove-stone)" />
              <ellipse cx={cx} cy={cy} rx={rx - 3} ry={ry - 2} fill="var(--grove-stone-lit)" />
            </g>
          ))}
        </g>,
      )}

      {/* Stage 8: timber footbridge */}
      {stage(
        "bridge",
        <g>
          <path d="M404 456 Q596 410 788 456" stroke="var(--grove-wood)" strokeWidth={11} fill="none" strokeLinecap="round" />
          <path d="M404 452 Q596 406 788 452" stroke="var(--grove-wood-lit)" strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d="M412 434 Q596 390 780 434" stroke="var(--grove-wood)" strokeWidth={3} fill="none" strokeLinecap="round" />
          {[432, 486, 540, 596, 652, 706, 760].map((x) => {
            const t = (x - 404) / 384;
            const arch = 4 * t * (1 - t) * 23;
            const y = round(454 - arch);
            return <line key={x} x1={x} y1={y - 20} x2={x} y2={y + 2} stroke="var(--grove-wood)" strokeWidth={3} strokeLinecap="round" />;
          })}
        </g>,
      )}

      {/* Stage 10: silver birches */}
      {stage(
        "birches",
        BIRCHES.map(([x, y, s]) => <Birch key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}

      {/* Stage 2: ferns along the bank */}
      {stage(
        "ferns",
        <g>
          <Fern x={118} y={528} s={1.15} />
          <Fern x={182} y={542} flip={-1} s={0.95} />
          <Fern x={244} y={508} s={0.9} />
          <Fern x={956} y={518} flip={-1} s={1.05} />
          <Fern x={1026} y={540} s={0.95} />
          <Fern x={1094} y={524} flip={-1} s={1.1} />
        </g>,
      )}

      {/* Stage 9: wildflowers by the bank */}
      {stage(
        "wildflowers",
        WILDFLOWERS.map((f, i) => (
          <g key={i}>
            <line x1={f.x} y1={f.y} x2={f.x} y2={f.y - 8 - f.r * 7} stroke="var(--grove-fern)" strokeWidth={1.4} />
            <circle cx={f.x} cy={f.y - 9 - f.r * 7} r={2.5 + f.r * 1.4} fill={i % 3 === 0 ? "var(--grove-flower-2)" : "var(--grove-flower-1)"} />
          </g>
        )),
      )}

      {/* Stage 12: sunbeams through the canopy */}
      {stage(
        "sunbeams",
        <g data-fx="rays" pointerEvents="none">
          <polygon points="180,0 320,0 590,460 440,460" fill="url(#grove-beam)" />
          <polygon points="410,0 520,0 740,440 620,440" fill="url(#grove-beam)" opacity={0.75} />
          <polygon points="730,0 850,0 1040,430 920,430" fill="url(#grove-beam)" opacity={0.65} />
        </g>,
      )}

      {/* Stage 14: rainbow in the mist */}
      {stage(
        "rainbow",
        <g pointerEvents="none">
          <path d="M440 426 A168 128 0 0 1 756 426" fill="none" stroke="url(#grove-rainbow)" strokeWidth={16} strokeLinecap="round" opacity={0.75} />
          <path d="M454 426 A154 114 0 0 1 742 426" fill="none" stroke="var(--grove-foam)" strokeWidth={4} opacity={0.28} />
        </g>,
      )}

      {/* Stage 11: butterflies over the water */}
      {stage(
        "butterflies",
        [
          [494, 396, 0],
          [694, 376, -1.6],
          [556, 354, -3.1],
        ].map(([x, y, d]) => (
          <g key={x} data-fx="glide" style={{ animationDelay: `${d}s` }}>
            <ellipse cx={x - 5} cy={y - 2} rx={6} ry={4} transform={`rotate(-20 ${x - 5} ${y - 2})`} fill="var(--grove-butterfly)" />
            <ellipse cx={x + 5} cy={y - 2} rx={6} ry={4} transform={`rotate(20 ${x + 5} ${y - 2})`} fill="var(--grove-butterfly)" />
            <circle cx={x} cy={y} r={1.6} fill="var(--grove-trunk)" />
          </g>
        )),
      )}

      {/* Stage 13: swallows across the falls */}
      {stage(
        "swallows",
        [
          [356, 152, 0],
          [402, 134, -1.2],
          [444, 160, -2.4],
          [774, 146, -0.8],
          [820, 128, -2],
        ].map(([x, y, d]) => (
          <path
            key={x}
            data-fx="glide"
            d={`M${x - 11} ${y - 4} Q${x - 5} ${y - 9} ${x} ${y} Q${x + 5} ${y - 9} ${x + 11} ${y - 4}`}
            stroke="var(--grove-bird)"
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
            style={{ animationDelay: `${d}s` }}
          />
        )),
      )}

      {/* Gentle mist layer across the glen */}
      <g data-fx="drift" filter="url(#grove-mist)" opacity={fullFlow ? 0.25 : 0.48} pointerEvents="none">
        <ellipse cx={280} cy={384} rx={240} ry={18} fill="var(--grove-foam)" />
        <ellipse cx={920} cy={390} rx={260} ry={18} fill="var(--grove-foam)" />
      </g>

      {fullFlow && <rect width="1200" height="560" fill="var(--grove-sun)" opacity={0.07} pointerEvents="none" />}
    </SceneSvg>
  );
}
