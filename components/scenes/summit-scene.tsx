import { SCENES } from "@/lib/scenes";

import { SceneSvg, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.wishes;

const STARS = scatter(13, 46, { x: [10, 1190], y: [10, 250] });
const PATH = "M180 546 L300 504 L430 478 L520 430 L468 392 L548 352 L610 344 L660 300 L622 254 L684 210 L656 168 L700 116";
const PINES: [number, number, number][] = [
  [236, 520, 1],
  [262, 530, 0.8],
  [356, 496, 0.9],
  [392, 508, 1.1],
  [500, 452, 0.8],
  [452, 418, 0.7],
  [540, 392, 0.7],
  [118, 520, 1.1],
  [150, 532, 0.8],
];
const FLOWERS = scatter(29, 26, { x: [120, 560], y: [520, 552] });

function Pine({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-2} y={-6} width={4} height={8} fill="var(--summit-trunk)" />
      <path d="M0 -46 L13 -20 L6 -20 L17 -4 L-17 -4 L-6 -20 L-13 -20 Z" fill="var(--summit-pine)" />
      <path d="M0 -46 L13 -20 L6 -20 L17 -4 L4 -4 Z" fill="var(--summit-pine-lit)" opacity={0.45} />
    </g>
  );
}

/**
 * The summit at sunrise. A valley before dawn under a mountain, and
 * fourteen things that come as the morning does: a cairn, the path, a tent,
 * the bridge over the ravine, first light on the peak, the mist lifting, a
 * lake that holds the sky, and at last the sun at the summit, one more for
 * each day you rehearse a wish.
 */
export function SummitScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const morning = has("rose");
  const risen = has("sunrise");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="summit-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--summit-sky-1)" />
            <stop offset="60%" stopColor="var(--summit-sky-2)" />
            <stop offset="100%" stopColor="var(--summit-sky-3)" />
          </linearGradient>
          <linearGradient id="summit-rose" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--summit-rose)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--summit-rose)" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="summit-sun-glow">
            <stop offset="0%" stopColor="var(--summit-sun)" stopOpacity="0.85" />
            <stop offset="35%" stopColor="var(--summit-sun)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--summit-sun)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="summit-lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--summit-sky-3)" />
            <stop offset="100%" stopColor="var(--summit-sky-2)" />
          </linearGradient>
          <radialGradient id="summit-lamp">
            <stop offset="0%" stopColor="var(--summit-lamp)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--summit-lamp)" stopOpacity="0" />
          </radialGradient>
          <filter id="summit-mist" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <clipPath id="summit-horizon">
            <rect x={0} y={0} width={1200} height={318} />
          </clipPath>
        </>
      }
    >
      <rect width="1200" height="560" fill="url(#summit-sky)" />
      {stage("rose", <rect x={0} y={80} width={1200} height={260} fill="url(#summit-rose)" />)}
      <g style={{ opacity: morning ? 0.25 : 1 }}>
        {STARS.map((star, i) => (
          <circle
            key={i}
            data-fx="twinkle"
            cx={star.x}
            cy={star.y}
            r={0.5 + star.r * 1.3}
            fill="var(--summit-star)"
            opacity={0.5 + star.r * 0.5}
            style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }}
          />
        ))}
      </g>

      {/* The sun: its rim on the horizon, then risen over the shoulder. */}
      {stage(
        "sun-rim",
        risen ? null : (
          <g clipPath="url(#summit-horizon)">
            <circle cx={990} cy={322} r={160} fill="url(#summit-sun-glow)" />
            <circle cx={990} cy={334} r={30} fill="var(--summit-sun)" />
          </g>
        ),
      )}
      {stage(
        "sunrise",
        <>
          <circle cx={990} cy={226} r={260} fill="url(#summit-sun-glow)" data-fx="halo" />
          <g data-fx="rays" stroke="var(--summit-sun)" strokeWidth={3} strokeLinecap="round" opacity={0.5}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <line key={i} x1={round(990 + Math.cos(a) * 50)} y1={round(226 + Math.sin(a) * 50)} x2={round(990 + Math.cos(a) * 74)} y2={round(226 + Math.sin(a) * 74)} />
              );
            })}
          </g>
          <circle cx={990} cy={226} r={36} fill="var(--summit-sun)" />
        </>,
      )}

      {/* The far ranges. */}
      <path d="M0 318 L90 262 L170 300 L260 244 L350 300 L420 270 L470 300 L1200 300 L1200 560 L0 560 Z" fill="var(--summit-far)" />
      <path d="M760 310 L860 250 L930 290 L1010 236 L1100 286 L1200 256 L1200 560 L760 560 Z" fill="var(--summit-far)" />
      <path d="M90 262 L112 276 L100 278 L82 268 Z M260 244 L282 258 L270 262 L248 252 Z M1010 236 L1032 250 L1020 254 L998 244 Z" fill="var(--summit-snow)" opacity={0.7} />

      {/* The mountain. */}
      <g>
        <title>{SCENE.base}</title>
        <path d="M360 480 L560 260 L700 108 L820 240 L1070 480 Z" fill="var(--summit-rock)" />
        <path d="M360 480 L560 260 L700 108 L690 300 L620 480 Z" fill="var(--summit-rock-shade)" />
        <path d="M700 108 L742 154 L724 162 L708 152 L690 170 L676 160 L660 166 Z" fill="var(--summit-snow)" />
        {/* Strata on the lit face, and snow caught in the gullies. */}
        <g stroke="var(--summit-rock-shade)" strokeWidth={2} opacity={0.5} fill="none" strokeLinecap="round">
          <path d="M716 150 L780 250 L850 330" />
          <path d="M742 176 L840 290 L960 410" />
          <path d="M770 214 L870 330" />
          <path d="M728 210 L760 300 L790 380" />
        </g>
        <g fill="var(--summit-snow)" opacity={0.55}>
          <path d="M716 162 L728 196 L722 198 Z" />
          <path d="M742 172 L760 206 L752 206 Z" />
          <path d="M686 168 L680 206 L676 204 Z" />
        </g>
        {/* The ravine the path has to cross. */}
        <path d="M546 312 L558 306 L568 324 L563 338 L580 360 L566 366 L554 344 L560 330 Z" fill="var(--summit-ravine)" />
      </g>
      {stage(
        "peak-light",
        <path d="M700 108 L820 240 L780 250 L740 200 L716 196 Z" fill="var(--summit-alpenglow)" opacity={0.75} />,
      )}
      {stage(
        "path",
        <path d={PATH} stroke="var(--summit-path)" strokeWidth={3} strokeDasharray="7 7" strokeLinecap="round" fill="none" opacity={0.9} />,
      )}
      {stage(
        "bridge",
        <>
          <path d="M536 344 Q560 354 586 344" stroke="var(--summit-path)" strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d="M536 332 Q560 342 586 332" stroke="var(--summit-path)" strokeWidth={1.4} fill="none" opacity={0.8} />
          {[542, 552, 562, 572, 581].map((x) => (
            <line key={x} x1={x} y1={334 + (x - 536) * 0.08} x2={x} y2={346 + (x - 536) * 0.08} stroke="var(--summit-path)" strokeWidth={1.2} opacity={0.8} />
          ))}
        </>,
      )}
      {stage(
        "flag",
        <>
          <line x1={660} y1={300} x2={660} y2={270} stroke="var(--summit-wood)" strokeWidth={2.5} />
          <path data-fx="flutter" d="M661 271 L684 278 L661 286 Z" fill="var(--summit-flag)" />
        </>,
      )}
      {stage(
        "sunrise",
        <>
          <line x1={700} y1={110} x2={700} y2={74} stroke="var(--summit-wood)" strokeWidth={2.5} />
          <path data-fx="flutter" d="M701 75 L730 84 L701 94 Z" fill="var(--summit-flag)" />
        </>,
        {},
        "-flag",
      )}
      {stage(
        "birds",
        [
          [440, 168, 0],
          [474, 156, -1],
          [506, 174, -2],
          [380, 196, -3],
        ].map(([x, y, d]) => (
          <path
            key={x}
            data-fx="glide"
            d={`M${x - 10} ${y - 4} Q${x - 5} ${y - 8} ${x} ${y} Q${x + 5} ${y - 8} ${x + 10} ${y - 4}`}
            stroke="var(--summit-bird)"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            style={{ animationDelay: `${d}s` }}
          />
        )),
      )}

      {/* The valley, its mist, and the near ground. */}
      <path d="M0 470 C200 452 400 470 600 474 S1000 456 1200 470 L1200 560 L0 560 Z" fill="var(--summit-valley)" />
      {stage(
        "lake",
        <>
          <ellipse cx={890} cy={512} rx={170} ry={22} fill="url(#summit-lake)" />
          <ellipse cx={890} cy={512} rx={170} ry={22} fill="none" stroke="var(--summit-near)" strokeWidth={2} opacity={0.6} />
          <path d="M820 506 l40 0 M900 516 l56 0 M846 520 l24 0" stroke="var(--summit-star)" strokeWidth={1.5} opacity={0.5} data-fx="shimmer" />
        </>,
      )}
      <g data-fx="drift" filter="url(#summit-mist)" style={{ opacity: has("mist") ? 0.2 : 0.75 }}>
        <ellipse cx={300} cy={452} rx={360} ry={22} fill="var(--summit-mist)" />
        <ellipse cx={900} cy={446} rx={380} ry={20} fill="var(--summit-mist)" />
        <ellipse cx={620} cy={400} rx={300} ry={16} fill="var(--summit-mist)" />
      </g>
      <path d="M0 520 C120 498 260 510 380 522 S600 540 700 560 L0 560 Z" fill="var(--summit-near)" />
      {stage(
        "trees",
        PINES.map(([x, y, s]) => <Pine key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}
      {stage(
        "tent",
        <>
          <circle cx={432} cy={466} r={46} fill="url(#summit-lamp)" data-fx="glow" />
          <path d="M404 482 L432 444 L460 482 Z" fill="var(--summit-tent)" />
          <path d="M424 482 L432 462 L440 482 Z" fill="var(--summit-lamp)" />
          <line x1={432} y1={444} x2={432} y2={438} stroke="var(--summit-wood)" strokeWidth={2} />
        </>,
      )}
      {stage(
        "cairn",
        <>
          <ellipse cx={180} cy={548} rx={20} ry={6} fill="var(--summit-stone)" />
          <ellipse cx={180} cy={538} rx={15} ry={6} fill="var(--summit-stone-lit)" />
          <ellipse cx={181} cy={529} rx={11} ry={5} fill="var(--summit-stone)" />
          <ellipse cx={180} cy={521} rx={7} ry={4} fill="var(--summit-stone-lit)" />
        </>,
      )}
      {stage(
        "flowers",
        FLOWERS.map((f, i) => (
          <g key={i}>
            <line x1={f.x} y1={f.y} x2={f.x} y2={f.y - 8 - f.r * 6} stroke="var(--summit-pine-lit)" strokeWidth={1.4} />
            <circle cx={f.x} cy={f.y - 9 - f.r * 6} r={2.6 + f.r * 1.4} fill={i % 3 ? "var(--summit-flower)" : "var(--summit-flower-2)"} />
          </g>
        )),
      )}
      {risen && <rect width="1200" height="560" fill="var(--summit-sun)" opacity={0.08} pointerEvents="none" />}
    </SceneSvg>
  );
}
