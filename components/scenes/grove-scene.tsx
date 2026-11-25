import { SCENES } from "@/lib/scenes";

import { SceneSvg, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.exercises;

const WILDFLOWERS = scatter(41, 30, { x: [60, 440], y: [484, 548] });
const BLUEBELLS = scatter(67, 22, { x: [120, 260], y: [488, 504] });
const POOL_STONES = scatter(73, 16, { x: [470, 720], y: [440, 470] });
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
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g data-fx="sway">
      <path d="M-4 0 Q-2 -68 2 -136 L7 -136 Q4 -68 5 0 Z" fill="var(--grove-birch-bark)" />
      <path d="M-2 -26 h5 M0 -54 h4 M-1 -82 h5 M1 -108 h4" stroke="var(--grove-trunk)" strokeWidth={1.6} opacity={0.45} />
      <ellipse cx={-12} cy={-128} rx={26} ry={18} fill="var(--grove-birch-leaf)" opacity={0.85} />
      <ellipse cx={14} cy={-142} rx={30} ry={20} fill="var(--grove-birch-leaf-lit)" opacity={0.88} />
      <ellipse cx={-2} cy={-156} rx={24} ry={16} fill="var(--grove-birch-leaf)" opacity={0.9} />
      </g>
    </g>
  );
}

function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-3} y={-10} width={6} height={12} fill="var(--grove-trunk)" />
      <path d="M0 -110 L26 -60 L12 -60 L32 -24 L16 -24 L38 4 L-38 4 L-16 -24 L-32 -24 L-12 -60 L-26 -60 Z" fill="var(--grove-cedar)" />
      <path d="M0 -110 L26 -60 L12 -60 L32 -24 L16 -24 L38 4 L6 4 Z" fill="var(--grove-cedar-lit)" opacity={0.4} />
    </g>
  );
}

function Fern({ x, y, flip = 1, s = 1 }: { x: number; y: number; flip?: 1 | -1; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip * s} ${s})`}>
      <g data-fx="sway">
      <path d="M0 0 Q14 -24 38 -32" stroke="var(--grove-fern)" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M8 -10 L18 -18 M14 -16 L26 -24 M20 -22 L32 -28 M8 -10 L18 -6 M16 -16 L28 -14 M24 -22 L34 -20" stroke="var(--grove-fern-lit)" strokeWidth={2} strokeLinecap="round" />
      <path d="M0 0 Q6 -20 18 -38" stroke="var(--grove-fern)" strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.85} />
      </g>
    </g>
  );
}

/**
 * The waterfall grove (Exercises). Quiet stones in a misty glen, and sixty
 * things that arrive as you keep your training days: a clear stream, then
 * the waterfall and its pool, cedars and birches, a footbridge, trout and an
 * otter, a cabin in the trees, an upper fall and a side fall, until the
 * falls run in full flood and a rainbow stands in the mist.
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
          <radialGradient id="grove-lamp-glow">
            <stop offset="0%" stopColor="var(--grove-lamp)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--grove-lamp)" stopOpacity="0" />
          </radialGradient>
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

      {stage(
        "eagle",
        <path data-fx="glide" d="M300 150 Q284 142 266 146 Q284 148 296 154 Q300 160 304 154 Q316 148 334 146 Q316 142 300 150 Z" fill="var(--grove-bird)" />,
      )}
      {stage(
        "stag",
        <g transform="translate(860 288) scale(0.8)" fill="var(--grove-cedar)">
          <ellipse cx={0} cy={-12} rx={13} ry={6} />
          <path d="M9 -15 L15 -28 L19 -26 L13 -12 Z" />
          <path d="M15 -29 l-4 -8 l-4 2 M15 -29 l-2 -10 M18 -28 l4 -8 l4 1 M18 -28 l2 -10" stroke="var(--grove-cedar)" strokeWidth={1.4} fill="none" />
          {[-9, -5, 5, 9].map((lx) => (
            <rect key={lx} x={lx} y={-8} width={2} height={10} />
          ))}
        </g>,
      )}

      {/* Tall cedars on the ridge */}
      {stage(
        "cedars",
        FAR_CEDARS.map(([x, y, s]) => <Cedar key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}

      {stage(
        "squirrel",
        <g transform="translate(176 300)" fill="var(--grove-fox)">
          <ellipse cx={0} cy={0} rx={5} ry={4} />
          <circle cx={4} cy={-4} r={3} />
          <path d="M-4 0 q-8 -2 -6 -12 q4 4 6 8 Z" />
        </g>,
      )}
      {stage(
        "meadow",
        <g fill="var(--grove-meadow)" opacity={0.7}>
          <path d="M0 404 C120 396 220 398 300 404 L300 414 C200 410 100 410 0 416 Z" />
          <path d="M1200 408 C1080 400 980 402 900 408 L900 418 C1000 414 1100 414 1200 420 Z" />
        </g>,
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

      {stage(
        "upper-falls",
        <g>
          <path d="M540 236 L556 196 L640 192 L656 236 Z" fill="var(--grove-cliff-shade)" />
          <path d="M586 196 L606 196 L610 236 L582 236 Z" fill="url(#grove-falls)" />
          <path data-fx="shimmer" d="M590 200 L588 232 M600 200 L602 232" stroke="var(--grove-foam)" strokeWidth={1.6} />
        </g>,
      )}
      {stage(
        "ivy",
        <g stroke="var(--grove-fern)" strokeWidth={2} fill="none" strokeLinecap="round">
          <path d="M300 280 C310 320 296 360 310 400 M340 270 C350 300 338 340 352 380" />
          {[
            [304, 300],
            [298, 340],
            [308, 380],
            [344, 290],
            [342, 330],
            [350, 364],
          ].map(([lx, ly], i) => (
            <circle key={i} cx={lx + 4} cy={ly} r={4} fill="var(--grove-fern-lit)" stroke="none" />
          ))}
        </g>,
      )}
      {stage(
        "cliff-flowers",
        [
          [370, 294],
          [400, 292],
          [430, 290],
          [710, 286],
          [750, 290],
          [790, 294],
          [380, 352],
          [760, 358],
        ].map(([fx, fy], i) => <circle key={i} cx={fx} cy={fy} r={3} fill={i % 2 ? "var(--grove-flower-1)" : "var(--grove-flower-2)"} />),
      )}
      {stage(
        "trickle",
        <path data-fx="shimmer" d="M452 262 C446 300 456 340 448 380 C444 400 450 420 446 434" stroke="var(--grove-water-light)" strokeWidth={3} fill="none" opacity={0.8} />,
      )}
      {stage(
        "side-falls",
        <g>
          <path d="M876 268 L888 268 L896 440 L870 440 Z" fill="url(#grove-falls)" opacity={0.85} />
          <ellipse cx={884} cy={440} rx={22} ry={6} fill="var(--grove-foam)" opacity={0.7} />
        </g>,
      )}
      {stage("glow", <path d="M260 440 L318 258 L460 226 L560 242 L684 228 L830 250 L924 440 Z" fill="var(--grove-sun)" opacity={0.12} />)}

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

      {stage(
        "cascade-full",
        <g>
          <path d="M522 236 Q514 320 516 418 L676 418 Q678 320 668 236 Z" fill="url(#grove-falls)" opacity={0.55} />
        </g>,
      )}
      {stage(
        "foam",
        <g fill="var(--grove-foam)">
          {[548, 572, 596, 620, 644].map((fx, i) => (
            <ellipse key={fx} data-fx="shimmer" cx={fx} cy={420 + (i % 2) * 4} rx={14} ry={6} opacity={0.85} style={{ animationDelay: `${i * -0.4}s` }} />
          ))}
        </g>,
      )}
      {stage(
        "spray",
        <g data-fx="drift" filter="url(#grove-mist)" fill="var(--grove-foam)" opacity={0.6}>
          <ellipse cx={540} cy={300} rx={40} ry={14} />
          <ellipse cx={660} cy={320} rx={44} ry={12} />
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

      {stage(
        "clear-pool",
        POOL_STONES.map((p, i) => <ellipse key={i} cx={round(p.x)} cy={round(p.y)} rx={round(4 + p.r * 5)} ry={round(2 + p.r * 2)} fill="var(--grove-stone-lit)" opacity={0.45} />),
      )}
      {stage(
        "trout",
        <g fill="var(--grove-fish)" opacity={0.8}>
          {[
            [540, 456, 0],
            [650, 462, -5],
            [600, 476, -9],
          ].map(([fx, fy, d], i) => (
            <g key={i} data-fx="swim" style={{ animationDelay: `${d}s` }}>
              <ellipse cx={fx} cy={fy} rx={9} ry={3} />
              <path d={`M${fx - 8} ${fy} l-6 -3 l0 6 Z`} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "leaping",
        <g>
          <path d="M548 430 Q560 410 574 426" fill="none" stroke="var(--grove-foam)" strokeWidth={1} opacity={0.6} />
          <ellipse cx={561} cy={416} rx={8} ry={3} transform="rotate(-20 561 416)" fill="var(--grove-fish)" />
          <ellipse data-fx="ripple" cx={576} cy={434} rx={12} ry={3} fill="none" stroke="var(--grove-foam)" strokeWidth={1} />
        </g>,
      )}
      {stage(
        "otter",
        <g data-fx="bob" fill="var(--grove-fox)">
          <ellipse cx={680} cy={470} rx={11} ry={4} />
          <circle cx={690} cy={466} r={4} />
        </g>,
      )}
      {stage(
        "ducks",
        <g>
          {[
            [500, 452, 0],
            [520, 458, -1.4],
          ].map(([dx, dy, d], i) => (
            <g key={i} data-fx="bob" style={{ animationDelay: `${d}s` }}>
              <ellipse cx={dx} cy={dy} rx={9} ry={4} fill="var(--grove-duck)" />
              <circle cx={dx + 6} cy={dy - 5} r={3.2} fill="var(--grove-fern)" />
              <path d={`M${dx + 9} ${dy - 5} l4 1 l-4 1 Z`} fill="var(--grove-butterfly)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "lilies",
        [
          [470, 478, 11],
          [724, 476, 10],
          [700, 490, 8],
        ].map(([lx, ly, r]) => (
          <g key={lx}>
            <path d={`M${lx - r} ${ly} a${r} ${r / 3} 0 1 0 ${r * 2} 0 l-${r} -1 z`} fill="var(--grove-fern)" />
            <circle cx={lx + 2} cy={ly - 3} r={r / 3} fill="var(--grove-flower-1)" />
          </g>
        )),
      )}
      {stage(
        "cattails",
        [
          [430, 470],
          [770, 466],
        ].map(([cx, cy]) => (
          <g key={cx} data-fx="sway">
            {[-6, 0, 6].map((dx, i) => (
              <g key={dx}>
                <path d={`M${cx + dx} ${cy} L${cx + dx * 1.4} ${cy - 40 - i * 4}`} stroke="var(--grove-fern)" strokeWidth={1.6} />
                <ellipse cx={cx + dx * 1.4} cy={cy - 40 - i * 4} rx={2.4} ry={6} fill="var(--grove-trunk)" />
              </g>
            ))}
          </g>
        )),
      )}
      {stage(
        "sun-pool",
        [
          [560, 442],
          [636, 448],
          [596, 462],
        ].map(([sx, sy], i) => <ellipse key={i} data-fx="shimmer" cx={sx} cy={sy} rx={20} ry={1.6} fill="var(--grove-sun)" opacity={0.8} style={{ animationDelay: `${i * -0.5}s` }} />),
      )}
      {stage(
        "mist-arc",
        <path d="M470 430 Q596 330 722 430" stroke="var(--grove-foam)" strokeWidth={18} fill="none" opacity={0.25} filter="url(#grove-mist)" />,
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

      {stage(
        "path",
        <path d="M0 452 C80 446 160 452 240 460 S360 470 420 478" stroke="var(--grove-path)" strokeWidth={6} strokeDasharray="10 7" strokeLinecap="round" fill="none" />,
      )}
      {stage(
        "mushrooms",
        <g>
          <path d="M196 446 L262 440 L264 452 L198 458 Z" fill="var(--grove-trunk)" />
          {[210, 226, 246].map((mx, i) => (
            <g key={mx}>
              <rect x={mx - 1.4} y={438 - i} width={2.8} height={6} fill="var(--grove-foam)" />
              <path d={`M${mx - 6} ${440 - i} Q${mx} ${430 - i} ${mx + 6} ${440 - i} Z`} fill="var(--grove-flower-1)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "bench",
        <g stroke="var(--grove-wood)" strokeWidth={3} strokeLinecap="round">
          <line x1={110} y1={470} x2={160} y2={466} />
          <line x1={114} y1={470} x2={114} y2={482} />
          <line x1={156} y1={466} x2={156} y2={478} />
        </g>,
      )}
      {stage(
        "foxgloves",
        [332, 348, 362].map((fx, i) => (
          <g key={fx}>
            <line x1={fx} y1={470 + i * 2} x2={fx} y2={432 + i * 2} stroke="var(--grove-fern)" strokeWidth={2} />
            {[0, 1, 2, 3].map((k) => (
              <ellipse key={k} cx={fx + (k % 2 ? 3 : -3)} cy={438 + i * 2 + k * 7} rx={2.6} ry={3.6} fill="var(--grove-flower-2)" />
            ))}
          </g>
        )),
      )}
      {stage(
        "frog",
        <g transform="translate(416 512)">
          <ellipse cx={0} cy={-2} rx={6} ry={4} fill="var(--grove-fern-lit)" />
          <circle cx={-3} cy={-6} r={1.8} fill="var(--grove-fern-lit)" />
          <circle cx={3} cy={-6} r={1.8} fill="var(--grove-fern-lit)" />
        </g>,
      )}
      {stage(
        "rope-swing",
        <g>
          <path d="M372 296 L392 420" stroke="var(--grove-wood)" strokeWidth={1.4} />
          <rect x={382} y={418} width={20} height={4} rx={1} fill="var(--grove-wood)" />
        </g>,
      )}
      {stage(
        "cabin",
        <g>
          <rect x={1120} y={402} width={64} height={34} fill="var(--grove-cabin)" />
          {[408, 416, 424, 432].map((ly) => (
            <line key={ly} x1={1120} y1={ly} x2={1184} y2={ly} stroke="var(--grove-trunk)" strokeWidth={1} opacity={0.5} />
          ))}
          <path d="M1112 404 L1152 378 L1192 404 Z" fill="var(--grove-roof)" />
          <rect x={1166} y={380} width={8} height={18} fill="var(--grove-stone)" />
          <rect x={1132} y={412} width={12} height={10} fill="var(--grove-lamp)" />
          <rect x={1156} y={414} width={12} height={22} fill="var(--grove-trunk)" />
        </g>,
      )}
      {stage(
        "chimney",
        <g fill="var(--grove-smoke)" filter="url(#grove-mist)">
          {[0, 1, 2].map((i) => (
            <ellipse key={i} data-fx="smoke" cx={1170 + i * 6} cy={370 - i * 12} rx={5 + i * 3} ry={4 + i * 2} style={{ animationDelay: `${i * -1.6}s` }} />
          ))}
        </g>,
      )}
      {stage(
        "deer",
        <g transform="translate(860 476) scale(0.9)" fill="var(--grove-deer)">
          <ellipse cx={0} cy={-12} rx={13} ry={6} />
          <path d="M-9 -14 L-16 -6 L-13 -3 L-6 -10 Z" />
          {[-8, -4, 5, 9].map((lx) => (
            <rect key={lx} x={lx} y={-8} width={2} height={10} />
          ))}
        </g>,
      )}
      {stage(
        "heron",
        <g>
          <line x1={760} y1={548} x2={756} y2={528} stroke="var(--grove-heron)" strokeWidth={2} />
          <line x1={766} y1={548} x2={762} y2={528} stroke="var(--grove-heron)" strokeWidth={2} />
          <ellipse cx={762} cy={520} rx={14} ry={7} fill="var(--grove-heron)" />
          <path d="M770 516 Q780 498 772 488" stroke="var(--grove-heron)" strokeWidth={3.4} fill="none" strokeLinecap="round" />
          <circle cx={772} cy={486} r={4} fill="var(--grove-heron)" />
          <path d="M776 485 l11 2 l-11 2 Z" fill="var(--grove-heron)" />
        </g>,
      )}
      {stage(
        "fox",
        <g transform="translate(1000 540)" fill="var(--grove-fox)">
          <ellipse cx={0} cy={-8} rx={13} ry={6} />
          <path d="M10 -12 L20 -10 L12 -4 Z" />
          <path d="M11 -12 l1 -6 l3 4 Z" />
          <path d="M-12 -8 q-14 -2 -18 6 q8 0 16 -2 Z" />
          <path d="M-30 -2 l-3 0 l2 -3 Z" fill="var(--grove-foam)" />
          {[-8, -4, 5, 8].map((lx) => (
            <rect key={lx} x={lx} y={-4} width={2} height={5} />
          ))}
        </g>,
      )}
      {stage(
        "wild-roses",
        [
          [60, 478],
          [86, 486],
          [1150, 476],
        ].map(([rx, ry]) => (
          <g key={rx}>
            <ellipse cx={rx} cy={ry} rx={16} ry={8} fill="var(--grove-fern)" />
            <circle cx={rx - 5} cy={ry - 4} r={3.4} fill="var(--grove-flower-1)" />
            <circle cx={rx + 6} cy={ry - 2} r={3} fill="var(--grove-flower-1)" />
          </g>
        )),
      )}
      {stage(
        "blossom",
        <g transform="translate(40 470)">
          <g data-fx="sway">
            <path d="M-3 0 L-2 -50 L2 -50 L3 0 Z" fill="var(--grove-trunk)" />
            {[
              [0, -62, 20],
              [-14, -52, 13],
              [14, -54, 14],
            ].map(([bx, by, r], i) => (
              <circle key={i} cx={bx} cy={by} r={r} fill="var(--grove-blossom)" />
            ))}
          </g>
        </g>,
      )}

      {/* Stage 10: silver birches */}
      {stage(
        "birches",
        BIRCHES.map(([x, y, s]) => <Birch key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}

      {stage(
        "bluebells",
        BLUEBELLS.map((b, i) => (
          <g key={i}>
            <line x1={round(b.x)} y1={round(b.y)} x2={round(b.x)} y2={round(b.y - 8)} stroke="var(--grove-fern)" strokeWidth={1.2} />
            <circle cx={round(b.x + 1.5)} cy={round(b.y - 7)} r={2} fill="var(--grove-bluebell)" />
          </g>
        )),
      )}
      {stage(
        "woodpecker",
        <g transform="translate(1046 380)">
          <ellipse cx={0} cy={0} rx={3.4} ry={6} fill="var(--grove-bird)" />
          <circle cx={2} cy={-6} r={2.6} fill="var(--grove-flower-1)" />
          <path d="M4 -6 l5 0" stroke="var(--grove-bird)" strokeWidth={1.4} />
        </g>,
      )}
      {stage(
        "birdsong",
        [
          [170, 344],
          [222, 360],
          [1100, 346],
        ].map(([bx, by], i) => (
          <g key={i} transform={`translate(${bx} ${by})`}>
            <ellipse cx={0} cy={0} rx={4.6} ry={3.4} fill="var(--grove-butterfly)" />
            <circle cx={4} cy={-3} r={2.4} fill="var(--grove-butterfly)" />
            <path d="M9 -8 q3 -3 6 0 M11 -12 q3 -3 6 0" stroke="var(--grove-bird)" strokeWidth={1} fill="none" opacity={0.6} />
          </g>
        )),
      )}
      {stage(
        "more-ferns",
        <g>
          <Fern x={300} y={540} s={0.9} />
          <Fern x={60} y={540} flip={-1} s={1} />
          <Fern x={880} y={540} s={0.95} />
          <Fern x={1160} y={540} flip={-1} s={1.1} />
        </g>,
      )}
      {stage(
        "pines",
        <g>
          <Pine x={22} y={560} s={1.1} />
          <Pine x={1186} y={560} s={1.2} />
        </g>,
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

      {stage(
        "lanterns",
        [412, 780].map((lx) => (
          <g key={lx}>
            <line x1={lx} y1={448} x2={lx} y2={416} stroke="var(--grove-wood)" strokeWidth={2.4} />
            <circle cx={lx} cy={412} r={16} fill="url(#grove-lamp-glow)" data-fx="glow" />
            <rect x={lx - 3.5} y={406} width={7} height={9} rx={1.5} fill="var(--grove-lamp)" />
          </g>
        )),
      )}
      {stage(
        "kingfisher",
        <g transform="translate(652 414)">
          <ellipse cx={0} cy={0} rx={5.4} ry={4} fill="var(--grove-kingfisher)" />
          <ellipse cx={-1} cy={3} rx={3.6} ry={2.2} fill="var(--grove-butterfly)" />
          <circle cx={4.5} cy={-3.6} r={2.8} fill="var(--grove-kingfisher)" />
          <path d="M6.5 -4.4 l6 1 l-6 1 Z" fill="var(--grove-bird)" />
        </g>,
      )}
      {stage(
        "second-bridge",
        <g>
          <path d="M540 552 Q596 520 652 552 L652 560 L540 560 Z" fill="var(--grove-stone)" />
          <path d="M570 560 Q596 540 622 560" fill="var(--grove-water-deep)" />
        </g>,
      )}
      {stage(
        "dragonflies",
        [
          [520, 420, 0],
          [690, 430, -2],
        ].map(([dx, dy, d], i) => (
          <g key={i} data-fx="glide" style={{ animationDelay: `${d}s` }}>
            <line x1={dx - 8} y1={dy} x2={dx + 8} y2={dy} stroke="var(--grove-kingfisher)" strokeWidth={1.8} />
            <ellipse cx={dx - 1} cy={dy - 4} rx={6} ry={2} fill="var(--grove-kingfisher)" opacity={0.5} />
            <ellipse cx={dx - 1} cy={dy + 4} rx={6} ry={2} fill="var(--grove-kingfisher)" opacity={0.5} />
          </g>
        )),
      )}
      {stage(
        "dusk-birds",
        <g data-fx="glide" stroke="var(--grove-bird)" strokeWidth={1.6} fill="none" strokeLinecap="round" style={{ animationDelay: "-3s" }}>
          <path d="M560 196 q4 -4 8 0 q4 -4 8 0" />
          <path d="M600 184 q4 -4 8 0 q4 -4 8 0" />
          <path d="M630 200 q4 -4 8 0 q4 -4 8 0" />
        </g>,
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

      {stage("golden", <rect width="1200" height="560" fill="var(--grove-sun)" opacity={0.06} pointerEvents="none" />)}
      {fullFlow && <rect width="1200" height="560" fill="var(--grove-sun)" opacity={0.07} pointerEvents="none" />}
    </SceneSvg>
  );
}
