import { SCENES } from "@/lib/scenes";

import { SceneSvg, onCurve, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.gratitude;

// The cord between the two posts, and where each lantern hangs on it.
const CORD = { from: [380, 214], via: [630, 300], to: [878, 204] } as const;
const FIRST = [0.5];
const MORE = [0.3, 0.7];
const GARLAND = [0.1, 0.2, 0.4, 0.6, 0.8, 0.9];

const SKY_LANTERNS = [
  [300, 150, 0],
  [470, 96, -3],
  [690, 130, -6],
  [820, 70, -9],
  [560, 40, -12],
  [980, 120, -4],
];
const FIREFLIES = scatter(17, 12, { x: [130, 400], y: [330, 400] });
const OLIVE_LANTERNS: [number, number, string][] = [
  [180, 262, "var(--terrace-paper-1)"],
  [236, 276, "var(--terrace-paper-2)"],
  [292, 258, "var(--terrace-paper-1)"],
  [150, 236, "var(--terrace-paper-2)"],
];

function CordLantern({ t, size = 1 }: { t: number; size?: number }) {
  const [x, y] = onCurve(CORD.from, CORD.via, CORD.to, t);
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <circle cx={0} cy={22} r={30} fill="url(#terrace-glow)" data-fx="glow" />
      <line x1={0} y1={0} x2={0} y2={8} stroke="var(--terrace-wood)" strokeWidth={1.5} />
      <rect x={-5} y={7} width={10} height={4} rx={1} fill="var(--terrace-wood)" />
      <rect x={-8} y={11} width={16} height={22} rx={7} fill="var(--terrace-lantern)" />
      <rect x={-4} y={14} width={8} height={15} rx={4} fill="var(--terrace-lantern-core)" opacity={0.85} />
      <rect x={-5} y={33} width={10} height={3} rx={1} fill="var(--terrace-wood)" />
    </g>
  );
}

/**
 * The lantern terrace. A terrace at golden hour (dusk, at night) with a
 * bare cord between two posts, and fourteen things that gather on it: the
 * first lantern, then herbs, tea, a lit window, bread and figs, a cat, the
 * full garland, and at last the evening star, one for each day of the last
 * two weeks you wrote down what was good.
 */
export function TerraceScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { stage } = stager(SCENE, level, fresh);
  // The terrace warms as lanterns come: the light on the floor follows them.
  const warmth = Math.min(1, level / 10);

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="terrace-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--terrace-sky-1)" />
            <stop offset="55%" stopColor="var(--terrace-sky-2)" />
            <stop offset="100%" stopColor="var(--terrace-sky-3)" />
          </linearGradient>
          <radialGradient id="terrace-glow">
            <stop offset="0%" stopColor="var(--terrace-lantern)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--terrace-lantern)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="terrace-sun">
            <stop offset="0%" stopColor="var(--terrace-sun)" stopOpacity="0.95" />
            <stop offset="30%" stopColor="var(--terrace-sun)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--terrace-sun)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="terrace-floor-light" cx="50%" cy="0%" r="75%">
            <stop offset="0%" stopColor="var(--terrace-lantern)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--terrace-lantern)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="terrace-window" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--terrace-lit)" />
            <stop offset="100%" stopColor="var(--terrace-lantern)" />
          </linearGradient>
          <filter id="terrace-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </>
      }
    >
      {/* The evening: sky, the sun going down behind the hills. */}
      <rect width="1200" height="560" fill="url(#terrace-sky)" />
      <circle cx={300} cy={318} r={190} fill="url(#terrace-sun)" style={{ opacity: "var(--terrace-sun-show)" }} />
      <circle cx={300} cy={322} r={34} fill="var(--terrace-sun)" style={{ opacity: "var(--terrace-sun-show)" }} />
      {stage(
        "evening-star",
        <g data-fx="twinkle">
          <circle cx={150} cy={78} r={26} fill="var(--terrace-star)" opacity={0.22} filter="url(#terrace-soft)" />
          <path d="M150 64 L153 75 L164 78 L153 81 L150 92 L147 81 L136 78 L147 75 Z" fill="var(--terrace-star)" />
        </g>,
      )}
      {stage(
        "sky-lanterns",
        SKY_LANTERNS.map(([x, y, d]) => (
          <g key={x} data-fx="rise" style={{ animationDelay: `${d}s` }}>
            <circle cx={x} cy={y + 8} r={14} fill="var(--terrace-lantern)" opacity={0.3} filter="url(#terrace-soft)" />
            <path d={`M${x - 6} ${y} L${x + 6} ${y} L${x + 5} ${y + 15} L${x - 5} ${y + 15} Z`} fill="var(--terrace-lantern)" />
            <rect x={x - 3} y={y + 8} width={6} height={6} rx={1} fill="var(--terrace-lantern-core)" />
          </g>
        )),
      )}

      <path d="M0 330 C170 300 330 318 470 330 S760 296 940 318 S1120 312 1200 326 L1200 560 L0 560 Z" fill="var(--terrace-hill-far)" />
      <path d="M0 368 C200 344 380 356 560 366 S880 346 1200 362 L1200 560 L0 560 Z" fill="var(--terrace-hill)" />

      {/* The olive tree, and the hedge behind the wall. */}
      <g>
        <title>{SCENE.base}</title>
        <path d="M222 412 C218 380 230 352 214 322 C206 306 214 290 226 282 L234 286 C226 300 228 312 236 326 C248 350 236 382 240 412 Z" fill="var(--terrace-bark)" />
        <path d="M226 300 C206 286 188 282 170 286" stroke="var(--terrace-bark)" strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M232 296 C254 280 276 276 296 280" stroke="var(--terrace-bark)" strokeWidth={4} fill="none" strokeLinecap="round" />
        {[
          [226, 236, 56, 34],
          [168, 256, 42, 26],
          [292, 254, 44, 26],
          [206, 206, 34, 20],
          [262, 210, 36, 22],
        ].map(([x, y, rx, ry], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="var(--terrace-olive)" />
            <ellipse cx={x + rx * 0.2} cy={y - ry * 0.3} rx={rx * 0.6} ry={ry * 0.5} fill="var(--terrace-olive-lit)" opacity={0.6} />
          </g>
        ))}
        <path d="M0 412 C30 372 70 380 96 366 C126 350 160 372 190 360 C226 346 260 374 300 362 C340 352 380 374 420 368 L420 420 L0 420 Z" fill="var(--terrace-hedge)" />
        <path d="M40 386 C70 372 100 380 130 372 M200 372 C230 362 262 380 300 372" stroke="var(--terrace-hedge-lit)" strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.5} />
      </g>
      {stage(
        "olive",
        OLIVE_LANTERNS.map(([x, y, colour], i) => (
          <g key={x} data-fx="sway" style={{ animationDelay: `${i * -2}s` }}>
            <line x1={x} y1={y - 22} x2={x} y2={y - 9} stroke="var(--terrace-wood)" strokeWidth={1} />
            <circle cx={x} cy={y} r={20} fill="url(#terrace-glow)" />
            <ellipse cx={x} cy={y} rx={10} ry={11} fill={colour} />
            <ellipse cx={x} cy={y} rx={10} ry={11} fill="none" stroke="var(--terrace-lantern-core)" strokeWidth={1} opacity={0.6} />
            <path d={`M${x - 10} ${y} h20`} stroke="var(--terrace-wood)" strokeWidth={0.8} opacity={0.4} />
          </g>
        )),
      )}
      {stage(
        "fireflies",
        FIREFLIES.map((fly, i) => (
          <g key={i} data-fx="firefly" style={{ animationDelay: `${(-fly.r * 7).toFixed(2)}s` }}>
            <circle cx={fly.x} cy={fly.y} r={6} fill="var(--terrace-lit)" opacity={0.3} filter="url(#terrace-soft)" />
            <circle cx={fly.x} cy={fly.y} r={2} fill="var(--terrace-lit)" />
          </g>
        )),
      )}

      {/* The house, its window dark until someone's home. */}
      <path d="M900 446 L900 176 L1050 104 L1200 176 L1200 446 Z" fill="var(--terrace-house)" />
      <path d="M884 182 L1050 96 L1216 182 L1206 192 L1050 112 L894 192 Z" fill="var(--terrace-roof)" />
      <rect x={952} y={238} width={88} height={104} rx={6} fill="var(--terrace-glass)" />
      <rect x={1086} y={300} width={64} height={146} rx={30} fill="var(--terrace-wood)" opacity={0.85} />
      <circle cx={1138} cy={378} r={3} fill="var(--terrace-lit)" />
      {stage(
        "window",
        <>
          <circle cx={996} cy={290} r={110} fill="url(#terrace-glow)" />
          <rect x={952} y={238} width={88} height={104} rx={6} fill="url(#terrace-window)" />
          <rect x={994} y={238} width={4} height={104} fill="var(--terrace-wood)" opacity={0.7} />
          <rect x={952} y={286} width={88} height={4} fill="var(--terrace-wood)" opacity={0.7} />
          <path d="M958 244 Q976 270 960 338" stroke="var(--terrace-cloth)" strokeWidth={8} fill="none" opacity={0.55} />
        </>,
      )}
      <rect x={944} y={340} width={104} height={8} rx={2} fill="var(--terrace-wall-cap)" />

      {/* The low wall, and the herbs on it. */}
      <rect x={0} y={414} width={1200} height={34} fill="var(--terrace-wall)" />
      <rect x={0} y={406} width={1200} height={10} rx={3} fill="var(--terrace-wall-cap)" />
      {stage(
        "rosemary",
        <>
          <path d="M442 406 L446 380 L482 380 L486 406 Z" fill="var(--terrace-pot)" />
          <rect x={440} y={376} width={48} height={7} rx={2} fill="var(--terrace-pot)" />
          {[-14, -7, 0, 7, 14].map((dx, i) => (
            <path
              key={dx}
              d={`M${464 + dx / 2} 378 q${dx / 3} -${22 + (i % 2) * 8} ${dx} -${36 + (i % 3) * 6}`}
              stroke="var(--terrace-herb)"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
          ))}
          {[-10, 4, 12].map((dx) => (
            <circle key={dx} cx={464 + dx} cy={348 - Math.abs(dx)} r={2} fill="var(--terrace-paper-2)" />
          ))}
        </>,
      )}

      {/* The posts and the cord, and the lanterns that come onto it. */}
      <rect x={374} y={196} width={12} height={250} rx={2} fill="var(--terrace-wood)" />
      <rect x={872} y={186} width={12} height={260} rx={2} fill="var(--terrace-wood)" />
      <path
        d={`M${CORD.from[0]} ${CORD.from[1]} Q${CORD.via[0]} ${CORD.via[1]} ${CORD.to[0]} ${CORD.to[1]}`}
        stroke="var(--terrace-cord)"
        strokeWidth={1.6}
        fill="none"
      />
      {stage(
        "jasmine",
        <>
          <path
            d="M884 446 C860 420 892 396 870 370 C852 346 890 324 868 296 C852 274 884 252 872 222"
            stroke="var(--terrace-herb)"
            strokeWidth={2.5}
            fill="none"
          />
          {[
            [870, 420],
            [884, 392],
            [864, 360],
            [880, 330],
            [862, 300],
            [878, 268],
            [868, 240],
            [890, 410],
          ].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x - 6} cy={y + 2} rx={5} ry={2.5} fill="var(--terrace-herb)" transform={`rotate(-30 ${x - 6} ${y + 2})`} />
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx={x} cy={y - 3} rx={1.8} ry={3.2} fill="var(--terrace-jasmine)" transform={`rotate(${a} ${x} ${y})`} />
              ))}
            </g>
          ))}
        </>,
      )}
      {stage("lantern-1", FIRST.map((t) => <CordLantern key={t} t={t} />))}
      {stage("lanterns-3", MORE.map((t) => <CordLantern key={t} t={t} />))}
      {stage("garland", GARLAND.map((t) => <CordLantern key={t} t={t} size={0.8} />))}

      {/* The floor, warming as the lanterns come. */}
      <path d="M0 448 L1200 448 L1200 560 L0 560 Z" fill="var(--terrace-floor)" />
      <g stroke="var(--terrace-floor-line)" strokeWidth={1.5}>
        {[470, 500, 538].map((y) => (
          <line key={y} x1={0} y1={y} x2={1200} y2={y} />
        ))}
        {[-500, -300, -120, 40, 200, 360, 520, 700, 880, 1040, 1220, 1400, 1640].map((x) => (
          <line key={x} x1={600 + (x - 600) * 0.42} y1={448} x2={x} y2={560} />
        ))}
      </g>
      <rect x={0} y={448} width={1200} height={112} fill="url(#terrace-floor-light)" style={{ opacity: warmth }} />

      {/* The table and the chair. */}
      <ellipse cx={600} cy={546} rx={190} ry={10} fill="var(--terrace-shadow)" />
      <path d="M466 454 L734 454 L756 472 L444 472 Z" fill="var(--terrace-cloth)" />
      <path d="M444 472 L756 472 L752 492 L448 492 Z" fill="var(--terrace-cloth)" opacity={0.85} />
      {[
        [462, 492],
        [736, 492],
      ].map(([x, y]) => (
        <rect key={x} x={x - 4} y={y} width={8} height={52} rx={2} fill="var(--terrace-wood)" />
      ))}
      <g>
        <rect x={782} y={404} width={8} height={70} rx={2} fill="var(--terrace-wood)" />
        <path d="M776 470 L850 470 L854 482 L772 482 Z" fill="var(--terrace-wood)" />
        <rect x={776} y={482} width={6} height={56} rx={2} fill="var(--terrace-wood)" />
        <rect x={844} y={482} width={6} height={56} rx={2} fill="var(--terrace-wood)" />
        <rect x={782} y={414} width={58} height={6} rx={2} fill="var(--terrace-wood)" opacity={0.8} />
      </g>
      {stage(
        "cat",
        <>
          <ellipse cx={814} cy={462} rx={30} ry={13} fill="var(--terrace-cat)" />
          <circle cx={838} cy={454} r={10} fill="var(--terrace-cat)" />
          <path d="M832 446 l3 -9 l5 7 z M842 446 l4 -8 l3 9 z" fill="var(--terrace-cat)" />
          <path d="M786 466 C770 470 772 482 790 478" stroke="var(--terrace-cat)" strokeWidth={6} fill="none" strokeLinecap="round" />
          <path d="M834 456 q3 2 6 0" stroke="var(--terrace-cloth)" strokeWidth={1} fill="none" opacity={0.6} />
        </>,
        { "data-fx": "breathe" },
      )}
      {stage(
        "bread",
        <>
          <ellipse cx={500} cy={452} rx={28} ry={10} fill="var(--terrace-bread)" />
          <path d="M486 448 l6 -4 M498 446 l6 -4 M510 448 l6 -4" stroke="var(--terrace-bread-score)" strokeWidth={2} strokeLinecap="round" />
          <path d="M690 456 Q710 470 730 456 Z" fill="var(--terrace-pot)" />
          {[
            [700, 452],
            [712, 448],
            [722, 453],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={6} fill="var(--terrace-fig)" />
          ))}
        </>,
      )}
      {stage(
        "tea",
        <>
          <ellipse cx={548} cy={444} rx={18} ry={14} fill="var(--terrace-teapot)" />
          <rect x={541} y={427} width={14} height={4} rx={2} fill="var(--terrace-teapot)" />
          <circle cx={548} cy={426} r={2.5} fill="var(--terrace-teapot)" />
          <path d="M565 444 q12 -4 14 -14" stroke="var(--terrace-teapot)" strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d="M531 438 q-10 4 -2 12" stroke="var(--terrace-teapot)" strokeWidth={3} fill="none" />
          {[588, 614].map((x) => (
            <g key={x}>
              <path d={`M${x - 8} 444 L${x + 8} 444 L${x + 6} 456 L${x - 6} 456 Z`} fill="var(--terrace-cup)" />
              <path d={`M${x + 8} 447 q5 1 2 6`} stroke="var(--terrace-cup)" strokeWidth={1.6} fill="none" />
              <path data-fx="steam" d={`M${x} 438 q-4 -8 0 -14 q4 -6 0 -12`} stroke="var(--terrace-steam)" strokeWidth={1.6} fill="none" strokeLinecap="round" />
            </g>
          ))}
        </>,
      )}
      {stage(
        "candles",
        [640, 656, 670].map((x, i) => {
          const h = [22, 30, 18][i];
          return (
            <g key={x}>
              <circle cx={x} cy={452 - h - 6} r={18} fill="url(#terrace-glow)" data-fx="glow" />
              <rect x={x - 3} y={452 - h} width={6} height={h} rx={1} fill="var(--terrace-candle)" />
              <path data-fx="flicker" d={`M${x} ${452 - h - 12} q4 6 0 9 q-4 -3 0 -9`} fill="var(--terrace-lit)" />
            </g>
          );
        }),
      )}
    </SceneSvg>
  );
}
