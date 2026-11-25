import { SCENES } from "@/lib/scenes";

import { SceneSvg, onCurve, riverPath, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.gratitude;

const STARS = scatter(17, 50, { x: [10, 1190], y: [10, 230] });
const WHEAT = scatter(43, 70, { x: [30, 300], y: [334, 382] });
const FIREFLIES = scatter(71, 18, { x: [40, 420], y: [300, 400] });

// The stream comes off the hill behind the village and widens towards the
// near left corner.
const STREAM_LINE = [
  [532, 290, 3],
  [506, 318, 6],
  [474, 344, 9],
  [440, 370, 13],
  [398, 400, 17],
  [346, 430, 22],
  [290, 462, 30],
  [228, 496, 40],
  [160, 534, 54],
  [108, 572, 64],
] as const;
const STREAM = riverPath(STREAM_LINE);

const MID_HILL = "M0 338 C180 318 360 300 540 298 S900 286 1200 292 L1200 560 L0 560 Z";
const NEAR = "M0 430 C200 416 420 424 640 432 S1000 420 1200 428 L1200 560 L0 560 Z";

type HouseProps = {
  x: number;
  base: number;
  w: number;
  h: number;
  wall?: string;
  roof?: string;
  lit?: boolean;
  chimney?: boolean;
  boxes?: boolean;
  windows?: number;
};

/** A cottage: walls, a pitched roof, a door, small windows; lit at night. */
function House({ x, base, w, h, wall = "var(--village-wall)", roof = "var(--village-roof)", lit, chimney, boxes, windows = 2 }: HouseProps) {
  const left = x - w / 2;
  const top = base - h;
  const pitch = w * 0.42;
  const glass = lit ? "var(--village-lit)" : "var(--village-window)";
  const spots = Array.from({ length: windows }, (_, i) => left + (w * (i + 1)) / (windows + 1));
  return (
    <g>
      {chimney && <rect x={x + w * 0.18} y={top - pitch * 0.9} width={w * 0.11} height={pitch * 0.8} fill="var(--village-stone-dark)" />}
      <rect x={left} y={top} width={w} height={h} fill={wall} />
      <rect x={left} y={top} width={w * 0.22} height={h} fill="var(--village-shade)" opacity={0.35} />
      <path d={`M${left - 5} ${top + 2} L${x} ${top - pitch} L${left + w + 5} ${top + 2} Z`} fill={roof} />
      <path d={`M${x} ${top - pitch} L${left + w + 5} ${top + 2} L${x + w * 0.1} ${top + 2} Z`} fill="var(--village-shine)" opacity={0.18} />
      <rect x={x - w * 0.09} y={base - h * 0.5} width={w * 0.18} height={h * 0.5} rx={w * 0.09} fill="var(--village-wood)" />
      {spots
        .filter((sx) => Math.abs(sx - x) > w * 0.15)
        .map((sx) => (
          <g key={sx}>
            <rect x={sx - w * 0.07} y={top + h * 0.22} width={w * 0.14} height={h * 0.26} rx={1.5} fill={glass} />
            {boxes && (
              <g>
                <rect x={sx - w * 0.09} y={top + h * 0.48} width={w * 0.18} height={3} fill="var(--village-wood)" />
                {[-1, 0, 1].map((k) => (
                  <circle key={k} cx={sx + k * w * 0.05} cy={top + h * 0.46} r={2} fill={k ? "var(--village-flower-1)" : "var(--village-flower-2)"} />
                ))}
              </g>
            )}
          </g>
        ))}
    </g>
  );
}

/** Chimney smoke drifting off to the right. */
function Smoke({ x, y }: { x: number; y: number }) {
  return (
    <g fill="var(--village-smoke)" filter="url(#village-soft)">
      {[0, 1, 2].map((i) => (
        <ellipse key={i} data-fx="smoke" cx={x + i * 7} cy={y - i * 11} rx={4 + i * 3} ry={3 + i * 2} opacity={0.75 - i * 0.2} style={{ animationDelay: `${i * -1.6}s` }} />
      ))}
    </g>
  );
}

/** A round-headed tree; `fruit` dots it with apples. */
function Tree({ x, base, s = 1, fruit = false }: { x: number; base: number; s?: number; fruit?: boolean }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${s})`}>
      <g data-fx="sway" style={{ animationDelay: `${round((x % 5) * -1.3)}s` }}>
        <path d="M-4 0 L-3 -30 L3 -30 L4 0 Z" fill="var(--village-bark)" />
        <circle cx={0} cy={-44} r={20} fill="var(--village-leaf)" />
        <circle cx={-14} cy={-34} r={13} fill="var(--village-leaf)" />
        <circle cx={14} cy={-36} r={14} fill="var(--village-leaf)" />
        <circle cx={5} cy={-50} r={11} fill="var(--village-leaf-lit)" opacity={0.7} />
        {fruit &&
          [
            [-10, -40],
            [8, -32],
            [12, -46],
            [-4, -28],
            [-16, -30],
            [2, -54],
          ].map(([fx, fy], i) => <circle key={i} cx={fx} cy={fy} r={2.6} fill="var(--village-fruit)" />)}
      </g>
    </g>
  );
}

/** A villager, feet at the origin. */
function Person({ x, y, s = 1, tone = 1, child = false }: { x: number; y: number; s?: number; tone?: 1 | 2 | 3; child?: boolean }) {
  const k = child ? 0.7 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * k})`}>
      <path d="M-5 0 L5 0 L4 -16 C4 -20 -4 -20 -4 -16 Z" fill={`var(--village-cloth-${tone})`} />
      <circle cx={0} cy={-23} r={4} fill="var(--village-skin)" />
    </g>
  );
}

function Hen({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <ellipse cx={0} cy={-5} rx={6} ry={4.5} fill="var(--village-hen)" />
      <circle cx={5} cy={-9} r={2.6} fill="var(--village-hen)" />
      <path d="M7.4 -9 L10 -8 L7.4 -7.4 Z" fill="var(--village-flower-2)" />
      <path d="M4 -12 l1 -2 l1 2 Z" fill="var(--village-fruit)" />
      <path d="M-1 -1 L-1 1 M2 -1 L2 1" stroke="var(--village-wood)" strokeWidth={1} />
    </g>
  );
}

function Goat({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -0.9 : 0.9} 0.9)`} fill="var(--village-goat)">
      <ellipse cx={0} cy={-10} rx={11} ry={6} />
      <path d="M9 -13 L15 -18 L17 -14 L12 -9 Z" />
      <path d="M14 -18 l-2 -5 M16 -18 l1 -5" stroke="var(--village-goat)" strokeWidth={1.2} />
      {[-7, -3, 4, 8].map((lx) => (
        <rect key={lx} x={lx} y={-6} width={2} height={6} />
      ))}
    </g>
  );
}

function Cow({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <rect x={-14} y={-18} width={28} height={12} rx={5} fill="var(--village-cow)" />
      <ellipse cx={-4} cy={-14} rx={5} ry={3.5} fill="var(--village-cow-patch)" />
      <path d="M12 -18 L20 -16 L20 -8 L13 -9 Z" fill="var(--village-cow)" />
      {[-11, -6, 6, 10].map((lx) => (
        <rect key={lx} x={lx} y={-7} width={2.6} height={7} fill="var(--village-cow)" />
      ))}
    </g>
  );
}

/** A lantern on a short bracket, glowing. */
function DoorLantern({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={14} fill="url(#village-lamp-glow)" data-fx="glow" />
      <rect x={x - 2.5} y={y - 3.5} width={5} height={7} rx={1} fill="var(--village-lamp)" />
    </g>
  );
}

/** A lamp post along the lane. */
function LanePost({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - 34} stroke="var(--village-wood)" strokeWidth={2.4} />
      <circle cx={x} cy={y - 38} r={18} fill="url(#village-lamp-glow)" data-fx="glow" />
      <rect x={x - 4} y={y - 44} width={8} height={9} rx={1.5} fill="var(--village-lamp)" />
      <path d={`M${x - 6} ${y - 44} L${x} ${y - 49} L${x + 6} ${y - 44} Z`} fill="var(--village-wood)" />
    </g>
  );
}

/** Lanterns strung on a sagging line between two points. */
function LanternString({ from, to, sag, count }: { from: [number, number]; to: [number, number]; sag: number; count: number }) {
  const ctrl: [number, number] = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + sag];
  return (
    <g>
      <path d={`M${from[0]} ${from[1]} Q${ctrl[0]} ${ctrl[1]} ${to[0]} ${to[1]}`} stroke="var(--village-wood)" strokeWidth={1} fill="none" />
      {Array.from({ length: count }, (_, i) => {
        const [lx, ly] = onCurve(from, ctrl, to, (i + 1) / (count + 1));
        return (
          <g key={i}>
            <circle cx={round(lx)} cy={round(ly + 4)} r={8} fill="url(#village-lamp-glow)" data-fx="glow" style={{ animationDelay: `${i * -0.7}s` }} />
            <circle cx={round(lx)} cy={round(ly + 4)} r={2.6} fill={i % 2 ? "var(--village-lamp)" : "var(--village-flower-2)"} />
          </g>
        );
      })}
    </g>
  );
}

/**
 * The hillside village (gratitude). An empty hillside by a stream, and sixty
 * things that come to it, one more for each day you give thanks: a campfire
 * and a well, the first hut and its garden, then cottages, a bakery, a mill,
 * a school, a masjid, a green with its oak and fountain, until every window
 * is lit and the whole village sits down to eat together. A small
 * civilisation, made of things noticed.
 */
export function VillageScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const allLit = has("windows");
  // Some windows glow from the start; every one does once the village is lit.
  const lit = (always: boolean) => allLit || always;

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="village-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--village-sky-1)" />
            <stop offset="58%" stopColor="var(--village-sky-2)" />
            <stop offset="100%" stopColor="var(--village-sky-3)" />
          </linearGradient>
          <radialGradient id="village-sun-glow">
            <stop offset="0%" stopColor="var(--village-sun)" stopOpacity="0.8" />
            <stop offset="40%" stopColor="var(--village-sun)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--village-sun)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="village-lamp-glow">
            <stop offset="0%" stopColor="var(--village-lamp)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--village-lamp)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="village-fire-glow">
            <stop offset="0%" stopColor="var(--village-fire)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--village-fire)" stopOpacity="0" />
          </radialGradient>
          <filter id="village-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <linearGradient id="village-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--village-stream)" />
            <stop offset="100%" stopColor="var(--village-stream-deep)" />
          </linearGradient>
        </>
      }
    >
      <rect width="1200" height="560" fill="url(#village-sky)" />
      <g style={{ opacity: "var(--village-stars)" }}>
        {STARS.map((star, i) => (
          <circle
            key={i}
            data-fx="twinkle"
            cx={round(star.x)}
            cy={round(star.y)}
            r={round(0.5 + star.r * 1.2)}
            fill="var(--village-star)"
            opacity={round(0.45 + star.r * 0.5)}
            style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }}
          />
        ))}
      </g>
      <circle cx={210} cy={214} r={190} fill="url(#village-sun-glow)" />
      <circle cx={210} cy={214} r={34} fill="var(--village-sun)" />
      {stage(
        "evening-star",
        <g data-fx="twinkle">
          <circle cx={930} cy={74} r={16} fill="url(#village-lamp-glow)" />
          <path d="M930 64 L932 72 L940 74 L932 76 L930 84 L928 76 L920 74 L928 72 Z" fill="var(--village-star)" />
        </g>,
      )}
      {stage(
        "kites",
        <g>
          {[
            [330, 120, "var(--village-flower-1)", 0],
            [430, 158, "var(--village-flower-2)", -2],
          ].map(([kx, ky, colour, d]) => (
            <g key={String(kx)} data-fx="bob" style={{ animationDelay: `${d}s` }}>
              <path d={`M${kx} ${Number(ky) - 14} L${Number(kx) + 10} ${ky} L${kx} ${Number(ky) + 16} L${Number(kx) - 10} ${ky} Z`} fill={String(colour)} />
              <path d={`M${kx} ${Number(ky) + 16} q-8 18 4 30 q-10 16 2 26`} stroke="var(--village-wood)" strokeWidth={1} fill="none" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "sky-lanterns",
        <g>
          {[
            [560, 150, 1],
            [640, 110, 0.8],
            [720, 170, 0.9],
            [820, 128, 0.7],
            [480, 196, 0.75],
            [900, 190, 0.85],
          ].map(([sx, sy, s], i) => (
            <g key={i} data-fx="rise" style={{ animationDelay: `${i * -2.5}s` }}>
              <circle cx={sx} cy={sy} r={14 * s} fill="url(#village-lamp-glow)" />
              <path d={`M${sx - 5 * s} ${sy - 6 * s} L${sx + 5 * s} ${sy - 6 * s} L${sx + 4 * s} ${sy + 6 * s} L${sx - 4 * s} ${sy + 6 * s} Z`} fill="var(--village-lamp)" />
            </g>
          ))}
        </g>,
      )}

      {stage("windows", <rect x={0} y={250} width={1200} height={310} fill="var(--village-lamp)" opacity={0.06} pointerEvents="none" />)}

      {/* The far ridge, its windmill. */}
      <path d="M0 290 C140 260 300 250 460 266 S760 252 900 246 S1100 254 1200 262 L1200 560 L0 560 Z" fill="var(--village-far)" />
      {stage(
        "windmill",
        <g transform="translate(1070 262)">
          <path d="M-9 0 L-6 -40 L6 -40 L9 0 Z" fill="var(--village-wall-2)" />
          <path d="M-8 -40 Q0 -50 8 -40 Z" fill="var(--village-roof-2)" />
          <g transform="translate(0 -42)">
            <g data-fx="spin">
              {[0, 90, 180, 270].map((a) => (
                <g key={a} transform={`rotate(${a})`}>
                  <line x1={0} y1={0} x2={0} y2={-30} stroke="var(--village-wood)" strokeWidth={1.6} />
                  <rect x={1} y={-30} width={7} height={22} fill="var(--village-cloth-light)" opacity={0.8} />
                </g>
              ))}
            </g>
          </g>
        </g>,
      )}

      {/* The hill the village climbs. */}
      <path d={MID_HILL} fill="var(--village-hill)" />
      {stage(
        "vines",
        <g>
          {[300, 314, 328].map((y, i) => (
            <path key={y} d={`M${960 + i * 12} ${y} L1200 ${y - 4}`} stroke="var(--village-leaf)" strokeWidth={5} strokeLinecap="round" strokeDasharray="2 7" />
          ))}
        </g>,
      )}
      {stage(
        "goats",
        <g>
          <Goat x={1010} y={350} />
          <Goat x={1046} y={356} flip />
          <Goat x={1120} y={346} />
        </g>,
      )}
      {stage(
        "wheat",
        <g>
          <path d="M20 334 C90 322 200 318 300 324 C330 330 360 350 386 378 C300 388 180 390 70 388 C40 380 24 360 20 334 Z" fill="var(--village-wheat)" />
          <path d="M40 350 C120 342 230 340 330 346 M52 366 C150 360 260 360 356 366" stroke="var(--village-wheat-dark)" strokeWidth={1.2} fill="none" opacity={0.5} />
          <g stroke="var(--village-wheat-dark)" strokeWidth={1.3} strokeLinecap="round">
            {WHEAT.map((w, i) => (
              <line key={i} x1={round(w.x)} y1={round(w.y)} x2={round(w.x + 1)} y2={round(w.y - 7)} />
            ))}
          </g>
        </g>,
      )}
      {stage(
        "harvest",
        <g fill="var(--village-wheat-dark)">
          {[70, 130, 190, 250].map((sx, i) => (
            <path key={sx} d={`M${sx - 7} ${370 - (i % 2) * 6} L${sx} ${350 - (i % 2) * 6} L${sx + 7} ${370 - (i % 2) * 6} Z`} />
          ))}
        </g>,
      )}
      {stage(
        "scarecrow",
        <g>
          <line x1={176} y1={366} x2={176} y2={334} stroke="var(--village-wood)" strokeWidth={2} />
          <line x1={164} y1={344} x2={188} y2={344} stroke="var(--village-wood)" strokeWidth={2} />
          <path d="M170 344 L182 344 L180 358 L172 358 Z" fill="var(--village-cloth-2)" />
          <circle cx={176} cy={338} r={4.5} fill="var(--village-wheat)" />
          <path d="M169 335 L183 335 L176 328 Z" fill="var(--village-wood)" />
        </g>,
      )}
      {stage(
        "fireflies",
        FIREFLIES.map((f, i) => (
          <circle key={i} data-fx="firefly" cx={round(f.x)} cy={round(f.y)} r={1.8 + f.r} fill="var(--village-lamp)" style={{ animationDelay: `${(f.r * -7).toFixed(2)}s` }} />
        )),
      )}
      {stage("granary", <House x={330} base={342} w={34} h={24} wall="var(--village-stone)" roof="var(--village-thatch)" windows={1} />)}
      {stage(
        "dovecote",
        <g>
          <rect x={414} y={304} width={14} height={28} fill="var(--village-wall-2)" />
          <path d="M410 305 L421 292 L432 305 Z" fill="var(--village-roof-2)" />
          {[310, 318].map((y) => (
            <circle key={y} cx={421} cy={y} r={2} fill="var(--village-wood)" />
          ))}
          <g data-fx="glide" stroke="var(--village-dove)" strokeWidth={1.6} fill="none" strokeLinecap="round">
            <path d="M440 282 q4 -4 8 0 q4 -4 8 0" />
            <path d="M398 270 q3 -3 6 0 q3 -3 6 0" />
          </g>
        </g>,
      )}
      {stage(
        "houses",
        <g>
          <House x={790} base={330} w={30} h={20} roof="var(--village-roof-3)" lit={lit(false)} windows={1} />
          <House x={840} base={324} w={34} h={22} wall="var(--village-wall-2)" lit={lit(false)} />
          <House x={892} base={318} w={30} h={20} roof="var(--village-roof-2)" lit={lit(false)} windows={1} />
          <House x={940} base={314} w={28} h={19} lit={lit(false)} windows={1} />
        </g>,
      )}
      {stage(
        "gardens",
        <g>
          <path d="M770 350 L960 338 L962 348 L772 360 Z" fill="var(--village-stone)" />
          {[796, 850, 904].map((gx) => (
            <g key={gx}>
              <circle cx={gx} cy={342} r={7} fill="var(--village-leaf)" />
              <circle cx={gx + 14} cy={340} r={5} fill="var(--village-leaf-lit)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "cat",
        <g transform="translate(930 340)" fill="var(--village-cat)">
          <ellipse cx={0} cy={-4} rx={6} ry={4} />
          <circle cx={5} cy={-8} r={3} />
          <path d="M3.5 -10.5 l1 -3 l1.5 2.5 Z M6 -10.5 l1.5 -3 l1 3 Z" />
          <path d="M-6 -4 q-6 2 -5 8" stroke="var(--village-cat)" strokeWidth={1.4} fill="none" />
        </g>,
      )}
      {stage(
        "masjid",
        <g>
          <rect x={530} y={296} width={64} height={30} fill="var(--village-wall)" />
          <path d="M540 297 C540 268 584 268 584 297 Z" fill="var(--village-dome)" />
          <line x1={562} y1={274} x2={562} y2={264} stroke="var(--village-dome)" strokeWidth={1.6} />
          <path d="M559 262 A3.5 3.5 0 1 0 565 266 A2.8 2.8 0 1 1 559 262 Z" fill="var(--village-lamp)" />
          <path d="M556 326 L556 310 A6 6 0 0 1 568 310 L568 326 Z" fill={lit(true) ? "var(--village-lit)" : "var(--village-window)"} />
          {[540, 580].map((wx) => (
            <path key={wx} d={`M${wx} 318 L${wx} 308 A4 4 0 0 1 ${wx + 8} 308 L${wx + 8} 318 Z`} fill={lit(false) ? "var(--village-lit)" : "var(--village-window)"} />
          ))}
        </g>,
      )}
      {stage(
        "minaret",
        <g>
          <rect x={604} y={252} width={12} height={74} fill="var(--village-wall)" />
          <rect x={600} y={270} width={20} height={4} fill="var(--village-wall-2)" />
          <path d="M603 252 L610 236 L617 252 Z" fill="var(--village-dome)" />
          <circle cx={610} cy={262} r={12} fill="url(#village-lamp-glow)" data-fx="glow" />
          <rect x={607} y={258} width={6} height={8} rx={3} fill="var(--village-lamp)" />
        </g>,
      )}
      {stage(
        "clock",
        <g>
          <rect x={688} y={266} width={22} height={74} fill="var(--village-stone)" />
          <path d="M684 266 L699 244 L714 266 Z" fill="var(--village-roof)" />
          <circle cx={699} cy={282} r={7} fill="var(--village-cloth-light)" />
          <path d="M699 282 L699 277 M699 282 L703 284" stroke="var(--village-wood)" strokeWidth={1.2} />
        </g>,
      )}
      {stage(
        "mill",
        <g>
          <House x={508} base={368} w={38} h={26} wall="var(--village-stone)" roof="var(--village-roof-2)" lit={lit(false)} windows={1} />
        </g>,
      )}

      <path d={NEAR} fill="var(--village-near)" />

      {/* The stream, and what's on it. */}
      <path d={STREAM} fill="url(#village-water)" />
      <path d={STREAM} fill="none" stroke="var(--village-shine)" strokeWidth={1.4} opacity={0.5} />
      {[
        [470, 350, 8],
        [380, 412, 12],
        [290, 466, 18],
        [190, 520, 24],
      ].map(([gx, gy, w], i) => (
        <line key={i} data-fx="shimmer" x1={gx - w / 2} y1={gy} x2={gx + w / 2} y2={gy - 2} stroke="var(--village-shine)" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} style={{ animationDelay: `${i * -0.5}s` }} />
      ))}
      {stage(
        "wheel",
        <g transform="translate(474 360)">
          <g data-fx="spin">
            <circle r={14} fill="none" stroke="var(--village-wood)" strokeWidth={2.4} />
            {[0, 45, 90, 135].map((a) => (
              <line key={a} x1={-14} y1={0} x2={14} y2={0} stroke="var(--village-wood)" strokeWidth={1.6} transform={`rotate(${a})`} />
            ))}
          </g>
        </g>,
      )}
      {stage(
        "plank-bridge",
        <g>
          <path d="M370 398 L414 408" stroke="var(--village-wood)" strokeWidth={6} strokeLinecap="round" />
          <path d="M372 392 L412 402" stroke="var(--village-wood)" strokeWidth={1.4} />
        </g>,
      )}
      {stage(
        "ducks",
        <g fill="var(--village-hen)">
          {[
            [250, 486],
            [272, 492],
            [168, 532],
          ].map(([dx, dy], i) => (
            <g key={i} data-fx="bob" style={{ animationDelay: `${i * -1.4}s` }}>
              <ellipse cx={dx} cy={dy} rx={7} ry={3.5} />
              <circle cx={dx + 5} cy={dy - 4} r={2.6} />
              <path d={`M${dx + 7} ${dy - 4} l3 1 l-3 1 Z`} fill="var(--village-flower-2)" />
            </g>
          ))}
        </g>,
      )}

      {/* The near ground, where the village gathers. */}
      <g>
        <title>{SCENE.base}</title>
        {[
          [60, 470],
          [130, 450],
          [980, 460],
          [1150, 470],
        ].map(([tx, ty]) => (
          <path key={tx} d={`M${tx} ${ty} q2 -8 4 0 m2 0 q2 -10 5 -1`} stroke="var(--village-leaf)" strokeWidth={1.6} fill="none" />
        ))}
      </g>
      {stage(
        "cows",
        <g>
          <Cow x={70} y={452} />
          <Cow x={134} y={466} flip />
        </g>,
      )}
      {stage(
        "stone-bridge",
        <g>
          <path d="M150 492 Q206 466 262 488 L262 500 Q206 480 150 504 Z" fill="var(--village-stone)" />
          <path d="M186 500 Q206 486 226 496" fill="none" stroke="var(--village-stone-dark)" strokeWidth={2} />
        </g>,
      )}
      {stage("apple", <Tree x={300} base={418} s={1} fruit={has("orchard")} />)}
      {stage(
        "orchard",
        <g>
          <Tree x={1030} base={470} s={0.9} fruit />
          <Tree x={1100} base={482} s={1} fruit />
          <Tree x={1168} base={468} s={0.85} fruit />
        </g>,
      )}
      {stage(
        "hives",
        <g>
          {[1000, 1022].map((hx) => (
            <g key={hx}>
              <rect x={hx - 7} y={504} width={14} height={14} rx={2} fill="var(--village-wheat)" />
              <path d={`M${hx - 8} 505 L${hx} 498 L${hx + 8} 505 Z`} fill="var(--village-roof-3)" />
            </g>
          ))}
          <circle data-fx="firefly" cx={1012} cy={494} r={1.4} fill="var(--village-wood)" />
        </g>,
      )}

      {/* The row along the lane, back to front. */}
      {stage("smithy", <House x={1140} base={428} w={50} h={30} wall="var(--village-stone)" roof="var(--village-roof-2)" lit={lit(false)} windows={1} />)}
      {stage(
        "smithy",
        <g>
          <circle cx={1128} cy={420} r={18} fill="url(#village-fire-glow)" data-fx="glow" />
          <rect x={1120} y={414} width={14} height={12} fill="var(--village-fire)" opacity={0.85} />
        </g>,
        {},
        "-forge",
      )}
      {stage(
        "school",
        <House x={1012} base={428} w={64} h={34} wall="var(--village-wall-2)" roof="var(--village-roof)" lit={lit(false)} windows={3} boxes={has("window-boxes")} />,
      )}
      {stage(
        "school-bell",
        <g>
          <rect x={1006} y={364} width={12} height={12} fill="var(--village-wall-2)" />
          <path d="M1003 365 L1012 356 L1021 365 Z" fill="var(--village-roof)" />
          <path d="M1009 375 Q1012 366 1015 375 Z" fill="var(--village-lamp)" />
        </g>,
      )}
      {stage(
        "cottage-3",
        <House x={890} base={430} w={46} h={28} roof="var(--village-roof-3)" lit={lit(false)} chimney boxes={has("window-boxes")} />,
      )}
      {stage(
        "inn",
        <g>
          <House x={440} base={408} w={52} h={32} wall="var(--village-wall-2)" roof="var(--village-roof)" lit={lit(true)} windows={3} />
          <line x1={470} y1={386} x2={482} y2={386} stroke="var(--village-wood)" strokeWidth={1.4} />
          <rect x={476} y={387} width={10} height={8} fill="var(--village-flower-2)" />
        </g>,
      )}
      {stage(
        "bakery",
        <House x={770} base={436} w={50} h={32} wall="var(--village-wall-2)" roof="var(--village-roof-2)" lit={lit(true)} chimney boxes={has("window-boxes")} />,
      )}
      {stage(
        "bread",
        <g>
          <circle cx={756} cy={416} r={14} fill="url(#village-lamp-glow)" />
          {[752, 760].map((bx) => (
            <ellipse key={bx} cx={bx} cy={418} rx={3.5} ry={2} fill="var(--village-wheat-dark)" />
          ))}
        </g>,
      )}
      {stage(
        "cottage-2",
        <House x={656} base={432} w={46} h={28} roof="var(--village-roof)" lit={lit(false)} chimney boxes={has("window-boxes")} />,
      )}
      {stage(
        "cottage",
        <House x={548} base={440} w={48} h={30} wall="var(--village-wall)" roof="var(--village-roof-3)" lit={lit(true)} chimney boxes={has("window-boxes")} />,
      )}
      {stage(
        "smoke",
        <g>
          <Smoke x={560} y={388} />
          {has("cottage-2") && <Smoke x={666} y={382} />}
          {has("bakery") && <Smoke x={780} y={384} />}
          {has("cottage-3") && <Smoke x={900} y={380} />}
        </g>,
      )}
      {stage(
        "bunting",
        <g>
          <path d="M792 402 Q830 420 868 406" stroke="var(--village-wood)" strokeWidth={0.9} fill="none" />
          {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((t, i) => {
            const [bx, by] = onCurve([792, 402], [830, 420], [868, 406], t);
            return <path key={t} d={`M${round(bx - 3)} ${round(by)} L${round(bx + 3)} ${round(by)} L${round(bx)} ${round(by + 6)} Z`} fill={`var(--village-bunting-${(i % 3) + 1})`} />;
          })}
        </g>,
      )}
      {stage(
        "door-lanterns",
        <g>
          {has("cottage") && <DoorLantern x={560} y={420} />}
          {has("cottage-2") && <DoorLantern x={668} y={414} />}
          {has("bakery") && <DoorLantern x={782} y={418} />}
          <DoorLantern x={404} y={424} />
        </g>,
      )}
      {stage(
        "window-boxes",
        <g>
          {[372, 436].map((px) => (
            <g key={px}>
              <path d={`M${px - 6} 448 L${px + 6} 448 L${px + 4} 456 L${px - 4} 456 Z`} fill="var(--village-roof-3)" />
              <circle cx={px - 3} cy={444} r={3} fill="var(--village-flower-1)" />
              <circle cx={px + 3} cy={443} r={3} fill="var(--village-flower-2)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "hut",
        <g>
          <path d="M376 448 L376 428 L432 428 L432 448 Z" fill="var(--village-wall-2)" />
          <path d="M368 430 Q404 392 440 430 Z" fill="var(--village-thatch)" />
          <path d="M398 448 L398 436 A6 6 0 0 1 410 436 L410 448 Z" fill={lit(true) ? "var(--village-lit)" : "var(--village-wood)"} />
        </g>,
      )}
      {stage(
        "patch",
        <g>
          {[476, 484, 492].map((py) => (
            <path key={py} d={`M330 ${py} L414 ${py + 2}`} stroke="var(--village-earth)" strokeWidth={5} strokeLinecap="round" />
          ))}
          {[340, 356, 372, 388, 404].map((px, i) => (
            <circle key={px} cx={px} cy={476 + (i % 3) * 8} r={3} fill="var(--village-leaf-lit)" />
          ))}
        </g>,
      )}
      {stage(
        "fence",
        <g stroke="var(--village-wood)" strokeWidth={1.6}>
          <path d="M322 468 L424 470 M322 500 L424 504" />
          {[322, 342, 362, 382, 402, 422].map((fx) => (
            <line key={fx} x1={fx} y1={464} x2={fx} y2={506} />
          ))}
        </g>,
      )}
      {stage(
        "footpath",
        <path d="M404 452 Q370 464 330 452 T290 462" stroke="var(--village-path)" strokeWidth={4} strokeDasharray="5 5" fill="none" strokeLinecap="round" />,
      )}
      {stage(
        "hens",
        <g>
          <Hen x={588} y={458} />
          <Hen x={604} y={462} flip />
          <Hen x={620} y={456} />
        </g>,
      )}
      {stage(
        "washing",
        <g>
          <line x1={612} y1={460} x2={612} y2={434} stroke="var(--village-wood)" strokeWidth={1.6} />
          <line x1={700} y1={460} x2={700} y2={434} stroke="var(--village-wood)" strokeWidth={1.6} />
          <path d="M612 436 Q656 444 700 436" stroke="var(--village-wood)" strokeWidth={0.8} fill="none" />
          {[626, 646, 668, 686].map((wx, i) => (
            <rect key={wx} data-fx="flutter" x={wx} y={439} width={10} height={12} fill={`var(--village-bunting-${(i % 3) + 1})`} opacity={0.85} />
          ))}
        </g>,
      )}

      {/* The green: lawn, oak, fountain, the table, and the people. */}
      {stage("green", <ellipse cx={660} cy={506} rx={176} ry={40} fill="var(--village-lawn)" />)}
      {stage("oak", <Tree x={474} base={486} s={1.7} />)}
      {stage(
        "bench",
        <g stroke="var(--village-wood)" strokeWidth={2.4} strokeLinecap="round">
          <line x1={452} y1={484} x2={498} y2={484} />
          <line x1={456} y1={484} x2={456} y2={494} />
          <line x1={494} y1={484} x2={494} y2={494} />
        </g>,
      )}
      {stage(
        "well",
        <g>
          <ellipse cx={644} cy={478} rx={16} ry={5} fill="var(--village-stone-dark)" />
          <rect x={628} y={464} width={32} height={14} fill="var(--village-stone)" />
          <line x1={631} y1={464} x2={631} y2={442} stroke="var(--village-wood)" strokeWidth={2} />
          <line x1={657} y1={464} x2={657} y2={442} stroke="var(--village-wood)" strokeWidth={2} />
          <path d="M626 444 L644 434 L662 444 Z" fill="var(--village-roof)" />
          <line x1={644} y1={446} x2={644} y2={458} stroke="var(--village-wood)" strokeWidth={1} />
          <rect x={640} y={456} width={8} height={6} fill="var(--village-wood)" />
        </g>,
      )}
      {stage(
        "fountain",
        <g>
          <ellipse cx={724} cy={506} rx={28} ry={8} fill="var(--village-stone)" />
          <ellipse cx={724} cy={503} rx={22} ry={5} fill="url(#village-water)" />
          <rect x={721} y={486} width={6} height={17} fill="var(--village-stone)" />
          <path data-fx="flow" d="M724 486 C724 476 714 478 710 490 M724 486 C724 476 734 478 738 490" stroke="var(--village-shine)" strokeWidth={1.4} fill="none" />
        </g>,
      )}
      {stage(
        "campfire",
        <g>
          <circle cx={566} cy={508} r={40} fill="url(#village-fire-glow)" data-fx="glow" />
          <path d="M552 516 L580 508 M554 508 L580 516" stroke="var(--village-wood)" strokeWidth={4} strokeLinecap="round" />
          <g data-fx="flicker">
            <path d="M566 488 C574 498 576 506 566 512 C556 506 558 498 566 488 Z" fill="var(--village-fire)" />
            <path d="M566 498 C570 503 570 507 566 510 C562 507 562 503 566 498 Z" fill="var(--village-fire-core)" />
          </g>
          {[540, 594].map((sx) => (
            <ellipse key={sx} cx={sx} cy={518} rx={6} ry={3} fill="var(--village-stone-dark)" />
          ))}
        </g>,
      )}
      {stage(
        "stall",
        <g>
          <rect x={816} y={466} width={44} height={16} fill="var(--village-wood)" />
          <path d="M810 452 L866 452 L860 462 L816 462 Z" fill="var(--village-bunting-1)" />
          <path d="M818 452 L818 462 M828 452 L828 462 M838 452 L838 462 M848 452 L848 462" stroke="var(--village-cloth-light)" strokeWidth={4} opacity={0.6} />
          <line x1={814} y1={462} x2={814} y2={482} stroke="var(--village-wood)" strokeWidth={2} />
          <line x1={862} y1={462} x2={862} y2={482} stroke="var(--village-wood)" strokeWidth={2} />
          {[824, 834, 844, 852].map((fx, i) => (
            <circle key={fx} cx={fx} cy={464} r={3} fill={i % 2 ? "var(--village-fruit)" : "var(--village-wheat)"} />
          ))}
        </g>,
      )}
      {stage(
        "lane-lamps",
        <g>
          <LanePost x={880} y={474} />
          <LanePost x={960} y={470} />
          <LanePost x={1060} y={474} />
        </g>,
      )}
      {stage(
        "donkey",
        <g transform="translate(930 498)">
          <rect x={-30} y={-20} width={26} height={12} fill="var(--village-wood)" />
          <circle cx={-24} cy={-6} r={6} fill="none" stroke="var(--village-wood)" strokeWidth={2} />
          <line x1={-4} y1={-14} x2={6} y2={-14} stroke="var(--village-wood)" strokeWidth={1.4} />
          <ellipse cx={14} cy={-14} rx={10} ry={6} fill="var(--village-donkey)" />
          <path d="M22 -16 L28 -26 L31 -22 L26 -12 Z" fill="var(--village-donkey)" />
          <path d="M27 -26 l-1 -6 M30 -24 l2 -5" stroke="var(--village-donkey)" strokeWidth={1.6} />
          {[8, 12, 18, 21].map((lx) => (
            <rect key={lx} x={lx} y={-10} width={2} height={10} fill="var(--village-donkey)" />
          ))}
        </g>,
      )}
      {stage(
        "children",
        <g>
          <g data-fx="bob">
            <Person x={606} y={530} child tone={2} />
          </g>
          <g data-fx="bob" style={{ animationDelay: "-1.2s" }}>
            <Person x={628} y={534} child tone={3} />
          </g>
          <circle cx={618} cy={522} r={3} fill="var(--village-fruit)" data-fx="bob" />
        </g>,
      )}
      {stage(
        "long-table",
        <g>
          <rect x={560} y={530} width={210} height={8} rx={2} fill="var(--village-cloth-light)" />
          {[570, 760].map((lx) => (
            <line key={lx} x1={lx} y1={538} x2={lx} y2={556} stroke="var(--village-wood)" strokeWidth={3} />
          ))}
          {[590, 626, 664, 700, 738].map((fx, i) => (
            <circle key={fx} cx={fx} cy={528} r={4} fill={i % 2 ? "var(--village-fruit)" : "var(--village-wheat-dark)"} />
          ))}
        </g>,
      )}
      {stage(
        "square-lanterns",
        <g>
          <LanternString from={[500, 440]} to={[640, 446]} sag={20} count={5} />
          <LanternString from={[640, 446]} to={[800, 440]} sag={22} count={6} />
        </g>,
      )}
      {stage(
        "feast",
        <g>
          {[580, 612, 646, 680, 714, 750].map((px, i) => (
            <Person key={px} x={px} y={548} s={0.9} tone={((i % 3) + 1) as 1 | 2 | 3} />
          ))}
        </g>,
      )}
    </SceneSvg>
  );
}
