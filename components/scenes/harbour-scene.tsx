import { SCENES } from "@/lib/scenes";

import { SceneSvg, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.disputations;

const RAIN = scatter(3, 120, { x: [-40, 1200], y: [-20, 540] });
const WHITECAPS = scatter(37, 26, { x: [0, 1180], y: [414, 548] });
const GLITTER = scatter(19, 34, { x: [180, 520], y: [420, 540] });

/** A cloud: a flat-bottomed heap of rounds. */
function Cloud({ x, y, w, fill, opacity = 1 }: { x: number; y: number; w: number; fill: string; opacity?: number }) {
  const h = w * 0.32;
  return (
    <g opacity={opacity}>
      <ellipse cx={x} cy={y} rx={w / 2} ry={h * 0.42} fill={fill} />
      <circle cx={x - w * 0.22} cy={y - h * 0.3} r={h * 0.55} fill={fill} />
      <circle cx={x + w * 0.04} cy={y - h * 0.5} r={h * 0.72} fill={fill} />
      <circle cx={x + w * 0.27} cy={y - h * 0.25} r={h * 0.5} fill={fill} />
    </g>
  );
}

/** The crest line of a row of waves: rough in the storm, long and low after. */
function crest(y: number, amp: number, len: number) {
  let d = `M-160 ${y}`;
  for (let x = -160; x < 1360; x += len) {
    d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
  }
  return d;
}

/**
 * A band of sea: a filled row of waves, darker the nearer it is, with foam
 * along its crest. Bands overlap from far to near, so the sea has depth.
 */
function WaveBand({ y, amp, len, shade, foam, delay }: { y: number; amp: number; len: number; shade: number; foam: number; delay: number }) {
  const line = crest(y, amp, len);
  return (
    <g data-fx="swell" style={{ animationDelay: `${delay}s` }}>
      <path d={`${line} L1360 560 L-160 560 Z`} fill="var(--harbour-sea-2)" opacity={shade} />
      <path d={line} fill="none" stroke="var(--harbour-foam)" strokeWidth={1.6} strokeLinecap="round" opacity={foam} />
    </g>
  );
}

/**
 * The harbour after the storm. The one scene that clears rather than fills:
 * a storm over the harbour, rain and high water and a dark lighthouse, and
 * fourteen kept days that take it apart, the beam lit, the rain easing, the sea
 * settling, the sun breaking through, a boat going out, a rainbow, and at
 * last a clear sky. Miss days and the weather comes back.
 */
export function HarbourScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const clearing = level >= 4 ? Math.min(1, (level - 3) / 11) : 0;
  const heavyRain = !has("rain-eases");
  const raining = !has("rain-stops");
  const calm = has("waves");
  const darkCloud = !has("white-cloud");
  const clear = has("clear");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="harbour-storm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--harbour-storm-1)" />
            <stop offset="100%" stopColor="var(--harbour-storm-2)" />
          </linearGradient>
          <linearGradient id="harbour-clear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--harbour-clear-1)" />
            <stop offset="65%" stopColor="var(--harbour-clear-2)" />
            <stop offset="100%" stopColor="var(--harbour-clear-3)" />
          </linearGradient>
          <linearGradient id="harbour-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--harbour-sea-1)" />
            <stop offset="100%" stopColor="var(--harbour-sea-2)" />
          </linearGradient>
          <radialGradient id="harbour-sun-glow">
            <stop offset="0%" stopColor="var(--harbour-sun)" stopOpacity="0.8" />
            <stop offset="40%" stopColor="var(--harbour-sun)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--harbour-sun)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="harbour-beam" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--harbour-lamp)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--harbour-lamp)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="harbour-lamp-glow">
            <stop offset="0%" stopColor="var(--harbour-lamp)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--harbour-lamp)" stopOpacity="0" />
          </radialGradient>
          <filter id="harbour-cloud" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="harbour-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <clipPath id="harbour-above-sea">
            <rect x={0} y={0} width={1200} height={404} />
          </clipPath>
        </>
      }
    >
      {/* The sky: the storm, and the clear sky coming through it. */}
      <g>
        <title>{SCENE.base}</title>
        <rect width="1200" height="560" fill="url(#harbour-storm)" />
      </g>
      <rect width="1200" height="560" fill="url(#harbour-clear)" style={{ opacity: clearing }} />

      {stage(
        "sunbreak",
        <>
          <circle cx={300} cy={150} r={clear ? 220 : 170} fill="url(#harbour-sun-glow)" data-fx="halo" />
          <circle cx={300} cy={150} r={34} fill="var(--harbour-sun)" />
          {!clear && (
            <g fill="var(--harbour-sun)" opacity={0.1} data-fx="rays" filter="url(#harbour-soft)">
              <path d="M280 170 L180 404 L250 404 Z" />
              <path d="M300 176 L320 404 L380 404 Z" />
              <path d="M318 168 L470 404 L520 404 Z" />
            </g>
          )}
        </>,
      )}
      {stage(
        "rainbow",
        <g clipPath="url(#harbour-above-sea)" opacity={0.32} fill="none" strokeWidth={9}>
          {["#ff8a8a", "#ffb86b", "#ffe680", "#9ee6a0", "#8cc8ff", "#a99cff", "#d49cff"].map((c, i) => (
            <circle key={c} cx={720} cy={470} r={420 - i * 9} stroke={c} />
          ))}
        </g>,
      )}

      {/* Clouds: a low heavy deck, torn open, then white and few. */}
      {darkCloud ? (
        <g filter="url(#harbour-cloud)" style={{ opacity: level >= 4 ? 0.85 : 1 }}>
          {has("gap") ? (
            <>
              <Cloud x={40} y={110} w={360} fill="var(--harbour-cloud)" />
              <Cloud x={700} y={80} w={560} fill="var(--harbour-cloud)" />
              <Cloud x={1080} y={130} w={420} fill="var(--harbour-cloud-dark)" />
              <Cloud x={640} y={170} w={380} fill="var(--harbour-cloud-dark)" opacity={0.9} />
            </>
          ) : (
            <>
              <rect x={0} y={0} width={1200} height={90} fill="var(--harbour-cloud-dark)" />
              <Cloud x={160} y={120} w={460} fill="var(--harbour-cloud)" />
              <Cloud x={560} y={110} w={520} fill="var(--harbour-cloud-dark)" />
              <Cloud x={980} y={128} w={500} fill="var(--harbour-cloud)" />
              <Cloud x={380} y={186} w={420} fill="var(--harbour-cloud-dark)" opacity={0.85} />
              <Cloud x={860} y={196} w={400} fill="var(--harbour-cloud-dark)" opacity={0.8} />
            </>
          )}
        </g>
      ) : (
        <g data-fx="drift">
          {clear ? (
            <>
              <Cloud x={620} y={110} w={150} fill="var(--harbour-cloud-white)" opacity={0.9} />
              <Cloud x={880} y={70} w={110} fill="var(--harbour-cloud-white)" opacity={0.8} />
            </>
          ) : (
            <>
              <Cloud x={600} y={110} w={260} fill="var(--harbour-cloud-white)" opacity={0.9} />
              <Cloud x={900} y={80} w={200} fill="var(--harbour-cloud-white)" opacity={0.85} />
              <Cloud x={140} y={70} w={180} fill="var(--harbour-cloud-white)" opacity={0.8} />
              <Cloud x={1080} y={170} w={220} fill="var(--harbour-cloud-white)" opacity={0.75} />
            </>
          )}
        </g>
      )}

      {stage(
        "gull",
        <path
          data-fx="glide"
          d="M540 236 Q552 222 566 232 Q580 222 592 236"
          stroke="var(--harbour-gull)"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />,
      )}

      {/* The cliff, the lighthouse and the cottage. */}
      <path d="M860 404 C880 360 900 320 940 304 L1200 290 L1200 560 L860 560 Z" fill="var(--harbour-rock)" />
      <path d="M900 404 C914 372 930 340 960 324 L960 560 L900 560 Z" fill="var(--harbour-rock-shade)" opacity={0.7} />
      {stage("green", <path d="M930 306 C960 296 1000 300 1040 294 C1100 290 1160 294 1200 290 L1200 302 C1150 306 1090 302 1040 308 C990 312 958 310 930 316 Z" fill="var(--harbour-grass)" />)}
      <g>
        <path d="M972 300 L982 160 L1010 160 L1020 300 Z" fill="var(--harbour-tower)" />
        <path d="M977 240 L1015 240 L1017 262 L975 262 Z M981 186 L1011 186 L1012 204 L980 204 Z" fill="var(--harbour-stripe)" />
        <rect x={978} y={134} width={36} height={26} rx={2} fill="var(--harbour-lantern-room)" />
        <path d="M972 136 L996 114 L1020 136 Z" fill="var(--harbour-stripe)" />
        <rect x={970} y={158} width={52} height={5} rx={1} fill="var(--harbour-stripe)" />
      </g>
      {stage(
        "beam",
        <>
          <g data-fx="beam" style={{ opacity: 1 - clearing * 0.75 }}>
            <path d="M996 147 L520 92 L520 210 Z" fill="url(#harbour-beam)" transform="scale(-1 1) translate(-1992 0)" />
            <path d="M996 147 L520 92 L520 210 Z" fill="url(#harbour-beam)" />
          </g>
          <circle cx={996} cy={147} r={46} fill="url(#harbour-lamp-glow)" data-fx="glow" />
          <rect x={984} y={138} width={24} height={18} rx={2} fill="var(--harbour-lamp)" />
        </>,
      )}
      {stage(
        "cottage",
        <>
          <rect x={1060} y={258} width={84} height={44} fill="var(--harbour-cottage)" />
          <path d="M1052 260 L1102 230 L1152 260 Z" fill="var(--harbour-stripe)" />
          <rect x={1122} y={226} width={12} height={22} fill="var(--harbour-cottage)" />
          <rect x={1076} y={272} width={16} height={14} rx={2} fill="var(--harbour-lamp)" opacity={0.85} />
          <rect x={1104} y={276} width={16} height={26} rx={2} fill="var(--harbour-rock-shade)" />
          {[0, -2.5, -5].map((d) => (
            <circle key={d} data-fx="smoke" cx={1128} cy={218} r={7} fill="var(--harbour-smoke)" style={{ animationDelay: `${d}s` }} />
          ))}
        </>,
      )}

      {/* The sea. */}
      <rect x={0} y={404} width={1200} height={156} fill="url(#harbour-sea)" />
      {calm
        ? (
            [
              [428, 2.5, 220, 0.25, 0.35],
              [462, 3.5, 260, 0.3, 0.3],
              [506, 4.5, 300, 0.35, 0.25],
            ] as const
          ).map(([y, amp, len, shade, foam], i) => (
            <WaveBand key={y} y={y} amp={amp} len={len} shade={shade} foam={foam} delay={-i * 2.5} />
          ))
        : (
            [
              [422, 7, 96, 0.25, 0.55],
              [448, 10, 128, 0.3, 0.55],
              [480, 13, 88, 0.35, 0.6],
              [516, 16, 140, 0.4, 0.65],
            ] as const
          ).map(([y, amp, len, shade, foam], i) => (
            <WaveBand key={y} y={y} amp={amp} len={len} shade={shade} foam={foam} delay={-i * 1.3} />
          ))}
      {!calm && (
        <g fill="var(--harbour-foam)" opacity={0.6}>
          {WHITECAPS.map((cap, i) => (
            <path key={i} d={`M${cap.x} ${cap.y} q${6 + cap.r * 8} -${4 + cap.r * 5} ${14 + cap.r * 14} 0 q-${6 + cap.r * 6} -2 -${14 + cap.r * 14} 0 z`} />
          ))}
        </g>
      )}
      {stage(
        "glitter",
        GLITTER.map((g, i) => (
          <rect
            key={i}
            data-fx="shimmer"
            x={g.x}
            y={g.y}
            width={8 + g.r * 16}
            height={2}
            rx={1}
            fill="var(--harbour-sun)"
            opacity={0.7}
            style={{ animationDelay: `${(g.r * 3).toFixed(2)}s` }}
          />
        )),
      )}
      {stage(
        "boat",
        <g data-fx="bob">
          <path d="M386 470 L470 470 L456 488 L398 488 Z" fill="var(--harbour-boat)" />
          <line x1={428} y1={470} x2={428} y2={398} stroke="var(--harbour-boat)" strokeWidth={2.5} />
          <path d="M431 402 L431 466 L470 466 Z" fill="var(--harbour-sail)" />
          <path d="M425 410 L425 466 L396 466 Z" fill="var(--harbour-sail)" opacity={0.85} />
        </g>,
      )}
      <path d="M0 520 C40 500 90 504 140 510 C180 514 200 530 220 560 L0 560 Z" fill="var(--harbour-rock)" />

      {/* Lightning in the worst of it. */}
      {heavyRain && (
        <path
          data-fx="flash"
          d="M712 150 L690 222 L708 222 L684 300 L734 206 L714 206 L738 150 Z"
          fill="var(--harbour-lamp)"
          opacity={0.85}
        />
      )}

      {/* The rain, heavy, then light, then gone. */}
      {raining && (
        <g data-fx="rain" stroke="var(--harbour-rain)" strokeWidth={heavyRain ? 1.6 : 1.1} opacity={heavyRain ? 0.6 : 0.35} strokeLinecap="round">
          {(heavyRain ? RAIN : RAIN.filter((_, i) => i % 3 === 0)).map((drop, i) => (
            <line key={i} x1={drop.x} y1={drop.y} x2={drop.x - 8} y2={drop.y + 26} />
          ))}
        </g>
      )}
    </SceneSvg>
  );
}
