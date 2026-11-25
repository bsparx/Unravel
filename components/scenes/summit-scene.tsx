import { SCENES } from "@/lib/scenes";

import { SceneSvg, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.wishes;

const STARS = scatter(13, 46, { x: [10, 1190], y: [10, 250] });
const PATH_POINTS: [number, number][] = [
  [180, 546],
  [300, 504],
  [430, 478],
  [520, 430],
  [468, 392],
  [548, 352],
  [610, 344],
  [660, 300],
  [622, 254],
  [684, 210],
  [656, 168],
  [700, 112],
];
const PATH = `M${PATH_POINTS.map(([x, y]) => `${x} ${y}`).join(" L")}`;
const PATH_LENGTHS = PATH_POINTS.slice(1).map(([x, y], i) => Math.hypot(x - PATH_POINTS[i][0], y - PATH_POINTS[i][1]));
const PATH_TOTAL = PATH_LENGTHS.reduce((a, b) => a + b, 0);

/** The point a fraction `t` of the way up the path. */
function along(t: number): [number, number] {
  let left = Math.max(0, Math.min(1, t)) * PATH_TOTAL;
  for (let i = 0; i < PATH_LENGTHS.length; i++) {
    if (left <= PATH_LENGTHS[i]) {
      const k = PATH_LENGTHS[i] ? left / PATH_LENGTHS[i] : 0;
      const [x0, y0] = PATH_POINTS[i];
      const [x1, y1] = PATH_POINTS[i + 1];
      return [round(x0 + (x1 - x0) * k), round(y0 + (y1 - y0) * k)];
    }
    left -= PATH_LENGTHS[i];
  }
  return PATH_POINTS[PATH_POINTS.length - 1];
}

/** The climber reaches the top on this stage. */
const SUMMIT_LEVEL = 58;

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

/** A climber with a pack, feet at the origin; `top` raises the arms. */
function Climber({ x, y, s = 1, top = false }: { x: number; y: number; s?: number; top?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-3 0 L-1 -8 L1 -8 L3 0" stroke="var(--summit-cloth)" strokeWidth={2} fill="none" />
      <rect x={-3} y={-17} width={6} height={10} rx={2} fill="var(--summit-tent)" />
      <rect x={-6} y={-16} width={4} height={8} rx={1.5} fill="var(--summit-cloth)" />
      <circle cx={0} cy={-20} r={3} fill="var(--summit-skin)" />
      {top ? (
        <path d="M-3 -15 L-7 -25 M3 -15 L7 -25" stroke="var(--summit-skin)" strokeWidth={1.6} strokeLinecap="round" />
      ) : (
        <path d="M3 -14 L6 -6 M6 -6 L7 0" stroke="var(--summit-wood)" strokeWidth={1.2} />
      )}
    </g>
  );
}

/** A waymark post on the path: a short pole and a coloured band. */
function Waymark({ at }: { at: number }) {
  const [x, y] = along(at);
  return (
    <g>
      <line x1={x + 6} y1={y} x2={x + 6} y2={y - 14} stroke="var(--summit-wood)" strokeWidth={2} />
      <rect x={x + 4} y={y - 14} width={4} height={4} fill="var(--summit-flag)" />
    </g>
  );
}

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
 * The summit at sunrise. A valley before dawn under a mountain, and sixty
 * things that come as the morning does, one more for each day you rehearse
 * a wish: a cairn and the path, and a climber on it who goes a little higher
 * each day, past ten waymarks, a hut, a ladder and a fixed rope, the false
 * summit, until they stand at the top as the sun clears the range.
 */
export function SummitScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const morning = has("rose");
  const risen = has("sunrise");
  const starsShown = has("stars-fade") ? 0.5 : 1;
  const climber = along(Math.min(level, SUMMIT_LEVEL) / SUMMIT_LEVEL);

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
      <g style={{ opacity: (morning ? 0.25 : 1) * starsShown }}>
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

      {stage("stars-fade", <rect width="1200" height="160" fill="var(--summit-sky-2)" opacity={0.2} />)}
      {stage(
        "moon-set",
        <g>
          <circle cx={120} cy={232} r={18} fill="var(--summit-snow)" opacity={0.85} />
          <circle cx={112} cy={226} r={4} fill="var(--summit-far)" opacity={0.25} />
        </g>,
      )}
      {stage(
        "eagle",
        <path data-fx="glide" d="M560 150 Q544 142 526 146 Q544 148 556 154 Q560 160 564 154 Q576 148 594 146 Q576 142 560 150 Z" fill="var(--summit-bird)" />,
      )}
      {stage(
        "swifts",
        <g data-fx="glide" stroke="var(--summit-bird)" strokeWidth={1.6} fill="none" strokeLinecap="round" style={{ animationDelay: "-2s" }}>
          <path d="M740 90 q4 -4 8 0 q4 -4 8 0" />
          <path d="M770 76 q4 -4 8 0 q4 -4 8 0" />
          <path d="M640 80 q4 -4 8 0 q4 -4 8 0" />
        </g>,
      )}
      {stage(
        "rays",
        <g fill="var(--summit-sun)" opacity={0.14}>
          <path d="M990 226 L0 280 L0 310 Z" />
          <path d="M990 226 L200 360 L260 380 Z" />
          <path d="M990 226 L1200 380 L1200 340 Z" />
        </g>,
      )}

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
      {stage(
        "far-peaks",
        <path d="M90 262 L170 300 L120 300 Z M260 244 L350 300 L300 300 Z M1010 236 L1100 286 L1050 290 Z" fill="var(--summit-alpenglow)" opacity={0.55} />,
      )}
      {stage(
        "view",
        <g fill="var(--summit-far)" opacity={0.55}>
          <path d="M470 300 L520 276 L560 300 Z M1100 286 L1150 262 L1200 280 L1200 300 Z" />
        </g>,
      )}

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
        "glacier",
        <path d="M744 176 L790 222 L800 262 L770 272 L748 240 L736 200 Z" fill="var(--summit-ice)" opacity={0.85} />,
      )}
      {stage(
        "snowfield",
        <path d="M680 176 L716 168 L730 200 L700 214 L668 206 Z" fill="var(--summit-snow)" opacity={0.9} />,
      )}
      {stage(
        "snow-glow",
        <path d="M700 108 L742 154 L724 162 L708 152 L690 170 L676 160 L660 166 Z" fill="var(--summit-alpenglow)" opacity={0.6} />,
      )}
      {stage(
        "ridge",
        <path d="M700 108 L820 240 L1070 480" stroke="var(--summit-alpenglow)" strokeWidth={3} fill="none" opacity={0.6} />,
      )}
      {stage(
        "waterfall",
        <g>
          <path d="M388 398 L410 396 L404 404 L394 404 Z" fill="var(--summit-rock-shade)" />
          <path d="M394 402 L404 402 L410 470 L388 470 Z" fill="var(--summit-snow)" opacity={0.75} />
          <path data-fx="flow" d="M397 406 L394 466 M401 406 L402 466 M405 406 L407 466" stroke="var(--summit-ice)" strokeWidth={1.2} />
          <ellipse cx={399} cy={472} rx={18} ry={5} fill="var(--summit-mist)" opacity={0.8} />
        </g>,
      )}
      {stage(
        "goats",
        <g fill="var(--summit-goat)">
          {[
            [770, 270, 1],
            [800, 300, -1],
            [836, 330, 1],
          ].map(([gx, gy, f], i) => (
            <g key={i} transform={`translate(${gx} ${gy}) scale(${f * 0.7} 0.7)`}>
              <ellipse cx={0} cy={-10} rx={11} ry={6} />
              <path d="M9 -13 L15 -18 L17 -14 L12 -9 Z" />
              <path d="M14 -18 q-4 -6 0 -9 M16 -18 q2 -6 6 -6" stroke="var(--summit-goat)" strokeWidth={1.4} fill="none" />
              {[-7, -3, 4, 8].map((lx) => (
                <rect key={lx} x={lx} y={-6} width={2} height={6} />
              ))}
            </g>
          ))}
        </g>,
      )}
      {stage(
        "switchbacks",
        <path d="M760 420 L800 396 L770 370 L812 346 L784 322" stroke="var(--summit-path)" strokeWidth={2.4} strokeDasharray="5 6" strokeLinecap="round" fill="none" opacity={0.7} />,
      )}
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
        "hut",
        <g>
          <rect x={562} y={344} width={32} height={20} fill="var(--summit-stone-lit)" />
          <path d="M556 346 L578 330 L600 346 Z" fill="var(--summit-tent)" />
          <rect x={574} y={352} width={8} height={12} fill="var(--summit-wood)" />
        </g>,
      )}
      {stage(
        "hut-light",
        <g>
          <circle cx={588} cy={354} r={18} fill="url(#summit-lamp)" data-fx="glow" />
          <rect x={585} y={351} width={6} height={6} fill="var(--summit-lamp)" />
        </g>,
      )}
      {stage(
        "camp-2",
        <g>
          <circle cx={636} cy={318} r={22} fill="url(#summit-lamp)" data-fx="glow" />
          <path d="M624 326 L636 308 L648 326 Z" fill="var(--summit-flag)" />
        </g>,
      )}
      {stage(
        "ladder",
        <g stroke="var(--summit-wood)" strokeWidth={1.6}>
          <line x1={640} y1={252} x2={666} y2={216} />
          <line x1={648} y1={256} x2={674} y2={220} />
          {[0.2, 0.4, 0.6, 0.8].map((t) => (
            <line key={t} x1={round(640 + 26 * t)} y1={round(252 - 36 * t)} x2={round(648 + 26 * t)} y2={round(256 - 36 * t)} />
          ))}
        </g>,
      )}
      {stage(
        "rope",
        <path d="M660 168 Q676 150 700 116" stroke="var(--summit-flag)" strokeWidth={1.4} fill="none" strokeDasharray="1 2" />,
      )}
      {stage(
        "edelweiss",
        [
          [596, 340],
          [646, 296],
          [612, 258],
          [672, 214],
        ].map(([ex, ey], i) => (
          <g key={i}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx={ex} cy={ey - 2.5} rx={1.3} ry={2.6} fill="var(--summit-snow)" transform={`rotate(${a} ${ex} ${ey})`} />
            ))}
            <circle cx={ex} cy={ey} r={1.2} fill="var(--summit-flower-2)" />
          </g>
        )),
      )}
      {stage(
        "false-summit",
        <g>
          <ellipse cx={652} cy={170} rx={8} ry={3} fill="var(--summit-stone)" />
          <ellipse cx={652} cy={165} rx={5} ry={3} fill="var(--summit-stone-lit)" />
        </g>,
      )}
      {stage(
        "prayer-flags",
        <g>
          <path d="M700 112 Q722 128 742 156" stroke="var(--summit-wood)" strokeWidth={0.8} fill="none" />
          {[0.15, 0.32, 0.5, 0.68, 0.85].map((t, i) => {
            const fx = round(700 + 42 * t);
            const fy = round(112 + 44 * t - 8 * Math.sin(Math.PI * t));
            return <rect key={t} data-fx="flutter" x={fx} y={fy} width={5} height={6} fill={["var(--summit-flag)", "var(--summit-flower-2)", "var(--summit-ice)", "var(--summit-tent)", "var(--summit-pine-lit)"][i]} />;
          })}
        </g>,
      )}
      {stage(
        "summit-cairn",
        <g>
          <ellipse cx={712} cy={114} rx={7} ry={3} fill="var(--summit-stone)" />
          <ellipse cx={712} cy={109} rx={4.5} ry={2.6} fill="var(--summit-stone-lit)" />
        </g>,
      )}
      {Array.from({ length: 10 }, (_, i) => stage(`post-${i + 1}`, <Waymark at={(i + 1) / 11} />))}
      {stage(
        "climbers",
        [0.18, 0.3, 0.42].map((t, i) => {
          const [cx, cy] = along(t);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy - 14} r={10} fill="url(#summit-lamp)" data-fx="glow" style={{ animationDelay: `${i * -1.2}s` }} />
              <circle cx={cx} cy={cy - 14} r={1.6} fill="var(--summit-lamp)" />
            </g>
          );
        }),
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
        "stream",
        <path d="M330 474 C300 496 270 504 240 522 S170 548 120 560" stroke="var(--summit-water)" strokeWidth={7} fill="none" strokeLinecap="round" />,
      )}
      {stage(
        "logs",
        <path d="M222 516 L262 530" stroke="var(--summit-wood)" strokeWidth={5} strokeLinecap="round" />,
      )}
      {stage(
        "deer",
        <g fill="var(--summit-near)">
          {[
            [980, 478, 1],
            [1008, 482, -1],
          ].map(([dx, dy, f], i) => (
            <g key={i} transform={`translate(${dx} ${dy}) scale(${f * 0.8} 0.8)`}>
              <ellipse cx={0} cy={-12} rx={12} ry={6} />
              <path d="M9 -15 L15 -26 L19 -24 L13 -12 Z" />
              <path d="M15 -27 l-3 -7 M17 -27 l3 -6" stroke="var(--summit-near)" strokeWidth={1.4} />
              {[-8, -4, 5, 9].map((lx) => (
                <rect key={lx} x={lx} y={-8} width={2} height={9} />
              ))}
            </g>
          ))}
        </g>,
      )}
      {stage(
        "village",
        <g>
          {[
            [1070, 476],
            [1092, 472],
            [1116, 478],
            [1140, 474],
          ].map(([hx, hy]) => (
            <g key={hx}>
              <rect x={hx - 7} y={hy - 8} width={14} height={8} fill="var(--summit-stone-lit)" />
              <path d={`M${hx - 9} ${hy - 8} L${hx} ${hy - 15} L${hx + 9} ${hy - 8} Z`} fill="var(--summit-tent)" />
              <rect x={hx - 1.5} y={hy - 6} width={3} height={3} fill="var(--summit-lamp)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "lake",
        <>
          <ellipse cx={890} cy={512} rx={170} ry={22} fill="url(#summit-lake)" />
          <ellipse cx={890} cy={512} rx={170} ry={22} fill="none" stroke="var(--summit-near)" strokeWidth={2} opacity={0.6} />
          <path d="M820 506 l40 0 M900 516 l56 0 M846 520 l24 0" stroke="var(--summit-star)" strokeWidth={1.5} opacity={0.5} data-fx="shimmer" />
        </>,
      )}
      {stage(
        "lake-gold",
        <ellipse data-fx="shimmer" cx={900} cy={510} rx={60} ry={4} fill="var(--summit-sun)" opacity={0.6} />,
      )}
      {stage(
        "clouds-below",
        <g data-fx="drift" filter="url(#summit-mist)" fill="var(--summit-mist)" opacity={0.7}>
          <ellipse cx={200} cy={420} rx={220} ry={14} />
          <ellipse cx={1000} cy={430} rx={200} ry={12} />
        </g>,
      )}
      <g data-fx="drift" filter="url(#summit-mist)" style={{ opacity: has("mist") ? 0.2 : 0.75 }}>
        <ellipse cx={300} cy={452} rx={360} ry={22} fill="var(--summit-mist)" />
        <ellipse cx={900} cy={446} rx={380} ry={20} fill="var(--summit-mist)" />
        <ellipse cx={620} cy={400} rx={300} ry={16} fill="var(--summit-mist)" />
      </g>
      {stage(
        "mist",
        <g data-fx="drift" filter="url(#summit-mist)" fill="var(--summit-mist)" opacity={0.35}>
          <ellipse cx={520} cy={360} rx={140} ry={8} />
          <ellipse cx={860} cy={340} rx={120} ry={7} />
        </g>,
      )}
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
        "sign",
        <g>
          <line x1={214} y1={548} x2={214} y2={514} stroke="var(--summit-wood)" strokeWidth={2.4} />
          <path d="M214 516 L242 516 L248 521 L242 526 L214 526 Z" fill="var(--summit-wood)" />
          <path d="M214 528 L190 528 L184 533 L190 538 L214 538 Z" fill="var(--summit-wood)" />
        </g>,
      )}
      {stage(
        "campfire",
        <g>
          <circle cx={472} cy={480} r={22} fill="url(#summit-lamp)" data-fx="glow" />
          <path d="M464 486 L480 482 M465 482 L480 487" stroke="var(--summit-wood)" strokeWidth={2.4} strokeLinecap="round" />
          <path data-fx="flicker" d="M472 468 C477 474 478 480 472 484 C466 480 467 474 472 468 Z" fill="var(--summit-tent)" />
        </g>,
      )}
      {stage(
        "marmot",
        <g>
          <ellipse cx={302} cy={526} rx={16} ry={7} fill="var(--summit-stone)" />
          <ellipse cx={302} cy={514} rx={5} ry={7} fill="var(--summit-trunk)" />
          <circle cx={302} cy={505} r={3.6} fill="var(--summit-trunk)" />
        </g>,
      )}
      {stage("valley-light", <rect y={440} width="1200" height="120" fill="var(--summit-sun)" opacity={0.07} pointerEvents="none" />)}
      {stage("warmth", <path d="M360 480 L560 260 L700 108 L820 240 L1070 480 Z" fill="var(--summit-sun)" opacity={0.06} pointerEvents="none" />)}
      {has("path") && !has("summit") && (
        <g>
          <title>the climber, on the way up</title>
          <Climber x={climber[0]} y={climber[1]} s={0.8} />
        </g>
      )}
      {stage("summit", <Climber x={700} y={112} s={0.85} top />)}
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
