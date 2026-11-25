import { SCENES } from "@/lib/scenes";

import { SceneSvg, riverPath, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.disputations;

const STARS = scatter(91, 40, { x: [10, 1190], y: [10, 220] });
const RAIN = scatter(33, 90, { x: [0, 1200], y: [0, 520] });
const FLOWERS = scatter(57, 40, { x: [20, 440], y: [440, 552] }).concat(scatter(58, 30, { x: [770, 1180], y: [420, 552] }));
const PEBBLES = scatter(77, 26, { x: [470, 690], y: [520, 556] });

// The river comes from the far hills towards you, bending once each way.
const RIVER_LINE = [
  [604, 290, 10],
  [622, 318, 22],
  [636, 346, 36],
  [600, 382, 60],
  [584, 418, 84],
  [612, 458, 114],
  [584, 504, 150],
  [560, 548, 190],
  [552, 590, 220],
] as const;
const RIVER = riverPath(RIVER_LINE);
/** Both banks as one, running under the river. */
const GROUND = "M0 360 C200 352 420 360 600 366 S1000 346 1200 352 L1200 560 L0 560 Z";
const TUFTS = scatter(19, 60, { x: [0, 1200], y: [380, 556] }).filter((t) => t.x < 470 || t.x > 720);

/** The weather clears one step at a time: these are its steps. */
const WEATHER = ["first-light", "rain-eases", "rain-stops", "clouds-thin", "sun", "blue", "cloud-white", "clear-sky"];
/** The water clears with these. */
const CLEARING = ["murk-1", "murk-2", "murk-3", "murk-4", "clear"];

function Person({ x, y, s = 1, tone = 1 }: { x: number; y: number; s?: number; tone?: 1 | 2 | 3 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5 0 L5 0 L4 -16 C4 -20 -4 -20 -4 -16 Z" fill={`var(--river-cloth-${tone})`} />
      <circle cx={0} cy={-23} r={4} fill="var(--river-skin)" />
    </g>
  );
}

function Duck({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={9} ry={4.5} fill="var(--river-duck)" />
      <circle cx={6} cy={-5} r={3.4} fill="var(--river-duck-head)" />
      <path d="M9 -5 l4 1 l-4 1 Z" fill="var(--river-flower-2)" />
    </g>
  );
}

function Boat({ x, y, s = 1, rower = true }: { x: number; y: number; s?: number; rower?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-30 -4 L30 -4 L22 6 L-22 6 Z" fill="var(--river-wood)" />
      <path d="M-30 -4 L30 -4" stroke="var(--river-wood-dark)" strokeWidth={2} />
      {rower && (
        <>
          <Person x={0} y={-2} s={0.8} tone={2} />
          <path d="M-22 4 L22 -14" stroke="var(--river-wood-dark)" strokeWidth={1.6} />
        </>
      )}
    </g>
  );
}

function Reeds({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g data-fx="sway">
        {[-8, -3, 2, 7].map((dx, i) => (
          <path key={dx} d={`M${dx} 0 q${dx * 0.5} -18 ${dx * 1.2} ${-32 - i * 3}`} stroke="var(--river-reed)" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        ))}
        <ellipse cx={-10} cy={-32} rx={2} ry={4.5} fill="var(--river-wood)" />
        <ellipse cx={9} cy={-43} rx={2} ry={4.5} fill="var(--river-wood)" />
      </g>
    </g>
  );
}

function Tree({ x, base, s = 1, fruit = false }: { x: number; base: number; s?: number; fruit?: boolean }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${s})`}>
      <g data-fx="sway">
        <path d="M-4 0 L-3 -32 L3 -32 L4 0 Z" fill="var(--river-bark)" />
        <circle cx={0} cy={-48} r={22} fill="var(--river-leaf)" />
        <circle cx={-15} cy={-36} r={14} fill="var(--river-leaf)" />
        <circle cx={15} cy={-38} r={15} fill="var(--river-leaf)" />
        <circle cx={6} cy={-56} r={12} fill="var(--river-leaf-lit)" opacity={0.7} />
        {fruit &&
          [
            [-10, -42],
            [9, -34],
            [13, -50],
            [-3, -30],
            [-16, -32],
          ].map(([fx, fy], i) => <circle key={i} cx={fx} cy={fy} r={2.8} fill="var(--river-apple)" />)}
      </g>
    </g>
  );
}

/**
 * The river, running clear (disputations). A murky river choked with junk
 * under a grey sky, and sixty things that come to it, one more for each day
 * you dispute a thought: every piece of debris hauled out and left on the
 * bank where you can see the work, the rain easing, the water clearing, and
 * then everything that comes back to clean water, from reeds and fish to
 * boats, children paddling and a rainbow.
 */
export function RiverScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const weather = WEATHER.filter(has).length / WEATHER.length;
  const clearing = CLEARING.filter(has).length / CLEARING.length;
  const raining = !has("rain-stops");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="river-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--river-sky-1)" />
            <stop offset="60%" stopColor="var(--river-sky-2)" />
            <stop offset="100%" stopColor="var(--river-sky-3)" />
          </linearGradient>
          <linearGradient id="river-storm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--river-storm-1)" />
            <stop offset="100%" stopColor="var(--river-storm-2)" />
          </linearGradient>
          <linearGradient id="river-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--river-water)" />
            <stop offset="100%" stopColor="var(--river-water-deep)" />
          </linearGradient>
          <linearGradient id="river-evening" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--river-evening)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--river-evening)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="river-rainbow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff94a8" stopOpacity="0.5" />
            <stop offset="30%" stopColor="#ffd27a" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#8ce6b8" stopOpacity="0.5" />
            <stop offset="80%" stopColor="#88cfff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#c5a3ff" stopOpacity="0.45" />
          </linearGradient>
          <radialGradient id="river-sun-glow">
            <stop offset="0%" stopColor="var(--river-sun)" stopOpacity="0.8" />
            <stop offset="40%" stopColor="var(--river-sun)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--river-sun)" stopOpacity="0" />
          </radialGradient>
          <filter id="river-blur" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="river-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <clipPath id="river-clip">
            <path d={RIVER} />
          </clipPath>
        </>
      }
    >
      {/* The sky, under a grey that lifts a step at a time. */}
      <rect width="1200" height="560" fill="url(#river-sky)" />
      <g style={{ opacity: "var(--river-stars)" }}>
        {STARS.map((star, i) => (
          <circle key={i} data-fx="twinkle" cx={round(star.x)} cy={round(star.y)} r={round(0.5 + star.r * 1.2)} fill="var(--river-star)" opacity={round((0.4 + star.r * 0.5) * weather)} style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }} />
        ))}
      </g>
      {stage(
        "evening-sky",
        <rect x={0} y={120} width={1200} height={200} fill="url(#river-evening)" />,
      )}
      {stage(
        "sun",
        <g>
          <circle cx={930} cy={130} r={220} fill="url(#river-sun-glow)" data-fx="halo" />
          <circle cx={930} cy={130} r={34} fill="var(--river-sun)" />
        </g>,
      )}
      {stage(
        "rainbow",
        <g pointerEvents="none">
          <path d="M260 320 A360 230 0 0 1 980 320" fill="none" stroke="url(#river-rainbow)" strokeWidth={22} />
        </g>,
      )}
      <rect width="1200" height="330" fill="url(#river-storm)" opacity={round(0.92 * (1 - weather))} />
      {/* Heavy cloud, thinning as the weather turns. */}
      <g data-fx="drift" fill="var(--river-cloud)" opacity={round(0.9 * (1 - weather))} filter="url(#river-blur)">
        <ellipse cx={200} cy={70} rx={260} ry={46} />
        <ellipse cx={640} cy={50} rx={320} ry={50} />
        <ellipse cx={1060} cy={80} rx={260} ry={46} />
        <ellipse cx={420} cy={140} rx={240} ry={30} />
        <ellipse cx={880} cy={150} rx={240} ry={30} />
      </g>
      {stage(
        "first-light",
        <g>
          <ellipse cx={900} cy={130} rx={110} ry={38} fill="var(--river-sky-2)" opacity={round(0.7 * (1 - weather) + 0.1)} filter="url(#river-blur)" />
        </g>,
      )}
      {stage(
        "clouds-thin",
        <g data-fx="drift" fill="var(--river-cloud-white)" opacity={0.55} filter="url(#river-blur)" style={{ animationDelay: "-8s" }}>
          <ellipse cx={300} cy={110} rx={150} ry={22} />
          <ellipse cx={700} cy={90} rx={170} ry={20} />
        </g>,
      )}
      {stage(
        "cloud-white",
        <g data-fx="drift" fill="var(--river-cloud-white)">
          <ellipse cx={420} cy={92} rx={58} ry={17} />
          <ellipse cx={452} cy={80} rx={34} ry={18} />
          <ellipse cx={396} cy={84} rx={24} ry={12} />
        </g>,
      )}
      {stage("blue", <rect width="1200" height="320" fill="var(--river-sky-1)" opacity={0.12} />)}
      {stage(
        "kites",
        <g>
          {[
            [250, 130, "var(--river-flower-1)"],
            [330, 170, "var(--river-flower-3)"],
          ].map(([kx, ky, colour], i) => (
            <g key={i} data-fx="bob" style={{ animationDelay: `${-i * 1.7}s` }}>
              <path d={`M${kx} ${Number(ky) - 13} L${Number(kx) + 9} ${ky} L${kx} ${Number(ky) + 15} L${Number(kx) - 9} ${ky} Z`} fill={String(colour)} />
              <path d={`M${kx} ${Number(ky) + 15} q-8 18 4 30 q-10 16 2 26`} stroke="var(--river-wood)" strokeWidth={1} fill="none" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "swallows",
        <g data-fx="glide" stroke="var(--river-bird)" strokeWidth={1.8} fill="none" strokeLinecap="round">
          <path d="M560 210 q5 -5 10 0 q5 -5 10 0" />
          <path d="M600 190 q4 -4 8 0 q4 -4 8 0" />
          <path d="M640 220 q5 -5 10 0 q5 -5 10 0" />
        </g>,
      )}

      {/* The far hills, and the light that finds them at last. */}
      <path d="M0 300 C160 270 330 262 480 280 S760 266 900 262 S1110 276 1200 282 L1200 560 L0 560 Z" fill="var(--river-hill-far)" />
      {stage(
        "far-hills",
        <path d="M0 300 C160 270 330 262 480 280 S760 266 900 262 S1110 276 1200 282 L1200 300 C1110 296 1010 288 900 284 S640 296 480 300 S160 290 0 316 Z" fill="var(--river-sun)" style={{ opacity: "var(--river-hill-glow)" }} />,
      )}
      <path d="M0 330 C200 312 420 316 600 322 S960 308 1200 320 L1200 560 L0 560 Z" fill="var(--river-hill)" />
      {stage(
        "deer",
        <g fill="var(--river-deer)">
          {[
            [920, 334, 1],
            [956, 338, -1],
          ].map(([dx, dy, f], i) => (
            <g key={i} transform={`translate(${dx} ${dy}) scale(${f * 0.9} 0.9)`}>
              <ellipse cx={0} cy={-12} rx={12} ry={6} />
              <path d="M9 -15 L15 -26 L19 -24 L13 -12 Z" />
              <path d="M15 -27 l-2 -6 M17 -27 l3 -5" stroke="var(--river-deer)" strokeWidth={1.2} />
              {[-8, -4, 5, 9].map((lx) => (
                <rect key={lx} x={lx} y={-8} width={2} height={9} />
              ))}
            </g>
          ))}
        </g>,
      )}

      {/* The banks: mud and grey grass, green again once the meadow returns. */}
      <g>
        <title>{SCENE.base}</title>
        <path d={GROUND} fill="var(--river-bank)" />
        {TUFTS.map((t, i) => (
          <path key={i} d={`M${round(t.x)} ${round(t.y)} q2 -${round(6 + t.r * 6)} 4 0 m1 0 q2 -${round(8 + t.r * 6)} 5 -1`} stroke="var(--river-bank-shade)" strokeWidth={1.4} fill="none" />
        ))}
      </g>
      {stage(
        "meadow",
        <g>
          <path d={GROUND} fill="var(--river-meadow)" />
          {TUFTS.map((t, i) => (
            <path key={i} d={`M${round(t.x)} ${round(t.y)} q2 -${round(6 + t.r * 6)} 4 0 m1 0 q2 -${round(8 + t.r * 6)} 5 -1`} stroke="var(--river-leaf)" strokeWidth={1.4} fill="none" />
          ))}
          <path d="M0 400 C160 392 300 398 420 404 L0 430 Z M1200 392 C1060 388 940 394 840 400 L1200 424 Z" fill="var(--river-meadow-lit)" opacity={0.5} />
        </g>,
      )}

      {/* Upstream: the mill, the cottage, the trees. */}
      <g>
        <rect x={548} y={318} width={40} height={30} fill="var(--river-mill)" />
        <path d="M542 320 L568 300 L594 320 Z" fill="var(--river-roof)" />
        <rect x={562} y={332} width={8} height={8} fill="var(--river-wood-dark)" />
      </g>
      <g transform="translate(608 340)">
        <g {...(has("mill") ? { "data-fx": "spin" } : {})}>
          <circle r={15} fill="none" stroke="var(--river-wood)" strokeWidth={2.4} />
          {[0, 45, 90, 135].map((a) => (
            <line key={a} x1={-15} y1={0} x2={15} y2={0} stroke="var(--river-wood)" strokeWidth={1.6} transform={`rotate(${a})`} />
          ))}
        </g>
      </g>
      {stage(
        "mill",
        <g>
          <path d="M594 352 q8 6 16 2" stroke="var(--river-shine)" strokeWidth={1.4} fill="none" data-fx="flow" />
        </g>,
      )}
      {stage(
        "cottage",
        <g>
          <rect x={846} y={350} width={56} height={34} fill="var(--river-cottage)" />
          <path d="M840 352 L874 326 L908 352 Z" fill="var(--river-roof)" />
          <rect x={886} y={326} width={7} height={16} fill="var(--river-stone-dark)" />
          <rect x={854} y={360} width={10} height={10} fill="var(--river-window)" />
          <rect x={882} y={360} width={10} height={10} fill="var(--river-window)" />
          <rect x={868} y={366} width={10} height={18} fill="var(--river-wood)" />
        </g>,
      )}
      {stage(
        "smoke",
        <g fill="var(--river-smoke)" filter="url(#river-soft)">
          {[0, 1, 2].map((i) => (
            <ellipse key={i} data-fx="smoke" cx={890 + i * 7} cy={318 - i * 11} rx={4 + i * 3} ry={3 + i * 2} style={{ animationDelay: `${i * -1.6}s` }} />
          ))}
        </g>,
      )}
      {stage("apple", <Tree x={980} base={404} s={1.1} fruit />)}
      {stage(
        "willow",
        <g transform="translate(330 410)">
          <g data-fx="sway">
            <path d="M-6 0 C-8 -40 -10 -70 0 -100 L8 -100 C4 -70 6 -40 6 0 Z" fill="var(--river-bark)" />
            <ellipse cx={2} cy={-104} rx={58} ry={26} fill="var(--river-leaf)" />
            {[-52, -40, -28, -16, -4, 8, 20, 32, 44, 56].map((dx) => (
              <path key={dx} d={`M${2 + dx} ${-100 + Math.abs(dx) / 6} q${dx / 4} 44 ${dx / 6} ${84 - Math.abs(dx) / 2}`} stroke={dx > 0 ? "var(--river-leaf-lit)" : "var(--river-leaf)"} strokeWidth={3} fill="none" strokeLinecap="round" />
            ))}
          </g>
        </g>,
      )}

      {/* The river, murky until it isn't. */}
      <path d={RIVER} fill="url(#river-water)" />
      <path d={RIVER} fill="var(--river-murk)" opacity={round(0.85 * (1 - clearing))} />
      <path d={RIVER} fill="none" stroke="var(--river-bank-shade)" strokeWidth={2} opacity={0.6} />
      <g clipPath="url(#river-clip)">
        {stage(
          "pebbles",
          PEBBLES.map((p, i) => (
            <ellipse key={i} cx={round(p.x)} cy={round(p.y)} rx={round(3 + p.r * 4)} ry={round(2 + p.r * 2)} fill={i % 3 ? "var(--river-stone)" : "var(--river-flower-2)"} opacity={0.6} />
          )),
        )}
        {stage(
          "stones",
          [
            [560, 470, 10],
            [640, 500, 12],
            [520, 520, 9],
            [610, 540, 13],
          ].map(([sx, sy, r]) => <ellipse key={sx} cx={sx} cy={sy} rx={r} ry={r * 0.45} fill="var(--river-stone-dark)" opacity={0.7} />),
        )}
        {stage(
          "glitter",
          [
            [600, 400, 30],
            [570, 452, 40],
            [620, 488, 46],
            [560, 530, 56],
          ].map(([gx, gy, w], i) => (
            <line key={i} data-fx="shimmer" x1={gx - w / 2} y1={gy} x2={gx + w / 2} y2={gy - 2} stroke="var(--river-glint)" strokeWidth={2} strokeLinecap="round" style={{ animationDelay: `${i * -0.6}s` }} />
          )),
        )}
        {stage(
          "flow",
          [
            [612, 360],
            [592, 410],
            [616, 470],
            [574, 520],
          ].map(([fx, fy], i) => (
            <path key={i} data-fx="flow" d={`M${fx - 14} ${fy} q14 -5 28 0`} stroke="var(--river-shine)" strokeWidth={1.4} fill="none" opacity={0.7} style={{ animationDelay: `${i * -0.4}s` }} />
          )),
        )}
      </g>

      {/* What chokes it: each piece goes when its day comes. */}
      {!has("dam") && (
        <g>
          <path d="M598 300 L640 304 L646 314 L596 318 Z" fill="var(--river-junk)" />
          <path d="M604 298 l10 -6 l6 8 M624 300 l8 -7 l4 9" stroke="var(--river-wood-dark)" strokeWidth={2} />
        </g>
      )}
      {stage(
        "dam",
        <g data-fx="flow">
          <path d="M604 306 q10 6 20 0 q10 6 20 0" stroke="var(--river-shine)" strokeWidth={1.6} fill="none" />
        </g>,
      )}
      {!has("silt") && <path d="M610 372 Q640 362 662 378 Q636 388 610 372 Z" fill="var(--river-bank-shade)" />}
      {!has("log") && (
        <g>
          <path d="M540 418 L656 410 L658 422 L542 430 Z" fill="var(--river-wood)" />
          <ellipse cx={657} cy={416} rx={3.5} ry={6} fill="var(--river-wood-dark)" />
        </g>
      )}
      {!has("branches") && (
        <g stroke="var(--river-wood-dark)" strokeWidth={3} strokeLinecap="round">
          <path d="M530 448 L600 462 M546 470 L590 440 M560 444 L572 476 M584 470 L612 452" />
        </g>
      )}
      {!has("barrel") && (
        <g>
          <ellipse cx={668} cy={446} rx={14} ry={10} fill="var(--river-junk-2)" />
          <path d="M656 442 L680 442 M656 450 L680 450" stroke="var(--river-wood-dark)" strokeWidth={1.6} />
        </g>
      )}
      {!has("sack") && <path d="M596 490 Q612 476 628 490 Q612 500 596 490 Z" fill="var(--river-junk-2)" />}
      {!has("weed") && (
        <g fill="var(--river-weed)" opacity={0.85}>
          <ellipse cx={520} cy={500} rx={26} ry={6} />
          <ellipse cx={652} cy={474} rx={22} ry={5} />
          <ellipse cx={600} cy={420} rx={18} ry={4} />
        </g>
      )}
      {!has("cart") && (
        <g transform="translate(672 520) rotate(-12)">
          <rect x={-22} y={-10} width={44} height={12} fill="var(--river-wood)" />
          <circle cx={-12} cy={4} r={9} fill="none" stroke="var(--river-wood-dark)" strokeWidth={2.4} />
        </g>
      )}
      {!has("tires") && (
        <g fill="none" stroke="var(--river-tire)" strokeWidth={5}>
          <ellipse cx={502} cy={540} rx={13} ry={6} />
          <ellipse cx={530} cy={548} rx={12} ry={5} />
        </g>
      )}
      {!has("oil") && <ellipse cx={612} cy={528} rx={50} ry={8} fill="var(--river-oil)" opacity={0.45} />}
      {stage("oil", <ellipse cx={612} cy={528} rx={30} ry={3} fill="var(--river-glint)" opacity={0.4} data-fx="shimmer" />)}

      {/* The near bank, where what's been cleared is laid up. */}
      {stage(
        "branches",
        <g stroke="var(--river-wood-dark)" strokeWidth={3} strokeLinecap="round">
          <path d="M386 470 L440 466 M384 476 L438 472 M388 482 L436 480" />
        </g>,
      )}
      {stage(
        "log",
        <g>
          <path d="M300 488 L372 486 L372 498 L300 500 Z" fill="var(--river-wood)" />
          <ellipse cx={372} cy={492} rx={4} ry={6} fill="var(--river-wood-dark)" />
        </g>,
      )}
      {stage("sack", <path d="M396 520 Q408 500 424 516 L422 528 L398 528 Z" fill="var(--river-junk-2)" />)}
      {stage(
        "barrel",
        <g>
          <rect x={440} y={496} width={18} height={24} rx={4} fill="var(--river-junk-2)" />
          <path d="M440 502 L458 502 M440 514 L458 514" stroke="var(--river-wood-dark)" strokeWidth={1.6} />
        </g>,
      )}
      {stage(
        "cart",
        <g transform="translate(200 470)">
          <rect x={-24} y={-14} width={46} height={12} fill="var(--river-wood)" />
          <circle cx={-12} cy={0} r={9} fill="none" stroke="var(--river-wood-dark)" strokeWidth={2.4} />
          <circle cx={12} cy={0} r={9} fill="none" stroke="var(--river-wood-dark)" strokeWidth={2.4} />
        </g>,
      )}
      {stage(
        "weed",
        <g>
          <ellipse cx={120} cy={514} rx={26} ry={12} fill="var(--river-weed)" />
          <ellipse cx={126} cy={506} rx={16} ry={7} fill="var(--river-leaf-lit)" opacity={0.6} />
        </g>,
      )}
      {stage(
        "silt",
        <g>
          <path d="M40 520 Q66 494 94 520 Z" fill="var(--river-bank-shade)" />
          <line x1={82} y1={524} x2={98} y2={490} stroke="var(--river-wood)" strokeWidth={2.4} />
          <path d="M96 488 l8 -2 l-2 8 Z" fill="var(--river-stone-dark)" />
        </g>,
      )}
      {stage(
        "tires",
        <g fill="none" stroke="var(--river-tire)" strokeWidth={5}>
          <ellipse cx={262} cy={536} rx={13} ry={5} />
          <ellipse cx={262} cy={528} rx={13} ry={5} />
        </g>,
      )}

      {/* Life, coming back. */}
      {stage(
        "rain-eases",
        <g fill="var(--river-sky-2)" opacity={0.2}>
          <rect width="1200" height="80" />
        </g>,
      )}
      {stage(
        "rain-stops",
        <g>
          {[
            [140, 470],
            [760, 470],
          ].map(([px, py]) => (
            <ellipse key={px} cx={px} cy={py} rx={22} ry={4} fill="var(--river-water)" opacity={0.6} />
          ))}
        </g>,
      )}
      {stage(
        "reeds",
        <g>
          <Reeds x={700} y={486} />
          <Reeds x={724} y={512} s={1.1} />
          <Reeds x={482} y={430} s={0.8} />
          <Reeds x={474} y={548} s={1.15} />
        </g>,
      )}
      {stage(
        "fish",
        <g fill="var(--river-fish)" opacity={0.75}>
          {[
            [580, 476, 0],
            [630, 506, -5],
            [560, 528, -9],
          ].map(([fx, fy, d], i) => (
            <g key={i} data-fx="swim" style={{ animationDelay: `${d}s` }}>
              <ellipse cx={fx} cy={fy} rx={8} ry={3} />
              <path d={`M${fx - 7} ${fy} l-6 -3 l0 6 Z`} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "frog",
        <g transform="translate(488 470)">
          <ellipse cx={0} cy={4} rx={12} ry={4} fill="var(--river-stone-dark)" />
          <ellipse cx={0} cy={-2} rx={7} ry={5} fill="var(--river-lily)" />
          <circle cx={-3} cy={-6} r={2} fill="var(--river-lily)" />
          <circle cx={3} cy={-6} r={2} fill="var(--river-lily)" />
        </g>,
      )}
      {stage(
        "dragonflies",
        [
          [660, 420, 0],
          [540, 440, -2],
          [700, 456, -4],
        ].map(([dx, dy, d], i) => (
          <g key={i} data-fx="glide" style={{ animationDelay: `${d}s` }}>
            <line x1={dx - 8} y1={dy} x2={dx + 8} y2={dy} stroke="var(--river-dragonfly)" strokeWidth={1.8} />
            <ellipse cx={dx - 1} cy={dy - 4} rx={6} ry={2} fill="var(--river-dragonfly)" opacity={0.5} />
            <ellipse cx={dx - 1} cy={dy + 4} rx={6} ry={2} fill="var(--river-dragonfly)" opacity={0.5} />
          </g>
        )),
      )}
      {stage(
        "lilies",
        [
          [690, 480, 12],
          [656, 492, 9],
          [500, 520, 11],
        ].map(([lx, ly, r]) => (
          <g key={lx}>
            <path d={`M${lx - r} ${ly} a${r} ${r / 3} 0 1 0 ${r * 2} 0 l-${r} -1 z`} fill="var(--river-lily)" />
            <circle cx={lx + 2} cy={ly - 3} r={r / 3} fill="var(--river-lily-flower)" />
          </g>
        )),
      )}
      {stage(
        "kingfisher",
        <g>
          <line x1={734} y1={470} x2={734} y2={432} stroke="var(--river-wood)" strokeWidth={3} />
          <ellipse cx={734} cy={428} rx={6} ry={4.5} fill="var(--river-kingfisher)" />
          <ellipse cx={733} cy={431} rx={4} ry={2.6} fill="var(--river-kingfisher-breast)" />
          <circle cx={739} cy={424} r={3} fill="var(--river-kingfisher)" />
          <path d="M741 423 l7 1 l-7 1 Z" fill="var(--river-wood-dark)" />
        </g>,
      )}
      {/* The footbridge: broken until it's mended. */}
      {has("bridge") ? (
        stage(
          "bridge",
          <g>
            <path d="M536 392 Q590 372 650 388" stroke="var(--river-wood)" strokeWidth={7} fill="none" strokeLinecap="round" />
            <path d="M538 380 Q590 360 648 376" stroke="var(--river-wood)" strokeWidth={2} fill="none" />
            {[548, 568, 590, 612, 634].map((bx) => (
              <line key={bx} x1={bx} y1={round(384 - 10 * Math.sin(((bx - 536) / 114) * Math.PI))} x2={bx} y2={round(372 - 10 * Math.sin(((bx - 536) / 114) * Math.PI))} stroke="var(--river-wood)" strokeWidth={1.6} />
            ))}
          </g>,
        )
      ) : (
        <g>
          <path d="M536 392 Q556 382 574 380" stroke="var(--river-wood)" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M616 378 Q634 380 650 388" stroke="var(--river-wood)" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M586 396 L604 400" stroke="var(--river-wood)" strokeWidth={5} strokeLinecap="round" opacity={0.6} />
        </g>
      )}
      {stage("second-boat", <g data-fx="bob" style={{ animationDelay: "-2s" }}><Boat x={606} y={404} s={0.55} rower={false} /></g>)}
      {stage(
        "heron",
        <g>
          <line x1={760} y1={478} x2={756} y2={456} stroke="var(--river-heron)" strokeWidth={2} />
          <line x1={767} y1={478} x2={763} y2={456} stroke="var(--river-heron)" strokeWidth={2} />
          <ellipse cx={762} cy={448} rx={15} ry={8} fill="var(--river-heron)" />
          <path d="M771 444 Q782 424 774 412" stroke="var(--river-heron)" strokeWidth={4} fill="none" strokeLinecap="round" />
          <circle cx={774} cy={410} r={4.5} fill="var(--river-heron)" />
          <path d="M778 409 l12 2 l-12 2 Z" fill="var(--river-heron)" />
        </g>,
      )}
      {stage(
        "ducks",
        <g>
          {[
            [590, 446, 1, false],
            [610, 452, 0.6, false],
            [622, 456, 0.6, false],
            [634, 452, 0.6, false],
          ].map(([dx, dy, s, f], i) => (
            <g key={i} data-fx="bob" style={{ animationDelay: `${i * -0.8}s` }}>
              <Duck x={Number(dx)} y={Number(dy)} s={Number(s)} flip={Boolean(f)} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "flowers",
        FLOWERS.map((f, i) => (
          <g key={i}>
            <line x1={round(f.x)} y1={round(f.y)} x2={round(f.x)} y2={round(f.y - 7 - f.r * 6)} stroke="var(--river-leaf)" strokeWidth={1.3} />
            <circle cx={round(f.x)} cy={round(f.y - 8 - f.r * 6)} r={round(2.2 + f.r * 1.4)} fill={`var(--river-flower-${(i % 3) + 1})`} />
          </g>
        )),
      )}
      {stage(
        "foxgloves",
        [150, 176, 196].map((fx, i) => (
          <g key={fx}>
            <line x1={fx} y1={446 + i * 4} x2={fx} y2={406 + i * 4} stroke="var(--river-leaf)" strokeWidth={2} />
            {[0, 1, 2, 3, 4].map((k) => (
              <ellipse key={k} cx={fx + (k % 2 ? 3 : -3)} cy={412 + i * 4 + k * 6} rx={2.6} ry={3.6} fill="var(--river-flower-3)" />
            ))}
          </g>
        )),
      )}
      {stage(
        "trout",
        <g>
          <ellipse data-fx="ripple" cx={640} cy={520} rx={20} ry={4} fill="none" stroke="var(--river-shine)" strokeWidth={1.2} />
          <path d="M628 512 Q640 498 652 512" fill="var(--river-fish)" />
        </g>,
      )}
      {stage(
        "stepping",
        [
          [508, 470],
          [552, 476],
          [598, 474],
          [644, 478],
          [688, 472],
        ].map(([sx, sy]) => (
          <g key={sx}>
            <ellipse cx={sx} cy={sy + 3} rx={16} ry={6} fill="var(--river-stone-dark)" />
            <ellipse cx={sx} cy={sy} rx={14} ry={5} fill="var(--river-stone)" />
          </g>
        )),
      )}
      {stage(
        "otters",
        <g fill="var(--river-otter)">
          {[
            [560, 500, 0],
            [584, 508, -1.6],
          ].map(([ox, oy, d], i) => (
            <g key={i} data-fx="bob" style={{ animationDelay: `${d}s` }}>
              <ellipse cx={ox} cy={oy} rx={10} ry={4} />
              <circle cx={ox + 9} cy={oy - 4} r={4} />
            </g>
          ))}
        </g>,
      )}
      {stage("boat", <g data-fx="bob"><Boat x={620} y={452} s={0.85} /></g>)}
      {stage(
        "butterflies",
        [
          [260, 420, 0],
          [860, 410, -2],
          [900, 440, -3.4],
        ].map(([bx, by, d], i) => (
          <g key={i} data-fx="glide" style={{ animationDelay: `${d}s` }}>
            <ellipse cx={bx - 4} cy={by - 2} rx={5} ry={3.4} transform={`rotate(-20 ${bx - 4} ${by - 2})`} fill="var(--river-butterfly)" />
            <ellipse cx={bx + 4} cy={by - 2} rx={5} ry={3.4} transform={`rotate(20 ${bx + 4} ${by - 2})`} fill="var(--river-butterfly)" />
          </g>
        )),
      )}
      {stage(
        "swans",
        <g fill="var(--river-swan)">
          {[
            [540, 530, 1],
            [566, 536, -1],
          ].map(([sx, sy, f], i) => (
            <g key={i} transform={`translate(${sx} ${sy}) scale(${f} 1)`}>
              <g data-fx="bob" style={{ animationDelay: `${i * -1.5}s` }}>
                <ellipse cx={0} cy={0} rx={12} ry={5} />
                <path d="M8 -2 Q14 -14 9 -20" stroke="var(--river-swan)" strokeWidth={3} fill="none" strokeLinecap="round" />
                <path d="M9 -21 l5 2 l-5 1 Z" fill="var(--river-flower-2)" />
              </g>
            </g>
          ))}
        </g>,
      )}
      {stage(
        "fisher",
        <g>
          <Person x={800} y={480} tone={1} />
          <path d="M804 466 Q760 420 712 430" stroke="var(--river-wood-dark)" strokeWidth={1.4} fill="none" />
          <line x1={712} y1={430} x2={712} y2={470} stroke="var(--river-shine)" strokeWidth={0.8} />
        </g>,
      )}
      {stage(
        "children",
        <g>
          <g data-fx="bob">
            <Person x={470} y={526} s={0.7} tone={3} />
          </g>
          <g data-fx="bob" style={{ animationDelay: "-1.3s" }}>
            <Person x={492} y={534} s={0.7} tone={2} />
          </g>
          <ellipse data-fx="ripple" cx={482} cy={534} rx={18} ry={3} fill="none" stroke="var(--river-shine)" strokeWidth={1} />
        </g>,
      )}
      {stage(
        "picnic",
        <g>
          <path d="M210 440 L290 436 L300 454 L216 458 Z" fill="var(--river-cloth-2)" />
          <path d="M230 438 L236 456 M256 437 L262 455 M276 436 L282 454" stroke="var(--river-cloth-light)" strokeWidth={3} opacity={0.6} />
          <rect x={246} y={436} width={14} height={9} rx={2} fill="var(--river-wood)" />
          <circle cx={278} cy={444} r={3} fill="var(--river-apple)" />
        </g>,
      )}
      {stage(
        "clear",
        <g>
          {[
            [596, 420],
            [612, 500],
          ].map(([cx, cy]) => (
            <ellipse key={cx} data-fx="shimmer" cx={cx} cy={cy} rx={24} ry={2} fill="var(--river-glint)" opacity={0.6} />
          ))}
        </g>,
      )}
      {["murk-1", "murk-2", "murk-3", "murk-4"].map((id, i) =>
        stage(
          id,
          <ellipse cx={[630, 590, 610, 570][i]} cy={[350, 410, 470, 530][i]} rx={14 + i * 6} ry={2} fill="var(--river-shine)" opacity={0.35} />,
        ),
      )}
      {stage(
        "clear-sky",
        <rect width="1200" height="560" fill="var(--river-sun)" opacity={0.06} pointerEvents="none" />,
      )}

      {/* The rain, until it stops. */}
      {raining && (
        <g stroke="var(--river-rain)" strokeWidth={1.2} strokeLinecap="round" opacity={has("rain-eases") ? 0.3 : 0.6}>
          {RAIN.filter((_, i) => !has("rain-eases") || i % 2 === 0).map((drop, i) => (
            <line key={i} data-fx="rain" x1={round(drop.x)} y1={round(drop.y)} x2={round(drop.x - 4)} y2={round(drop.y + 14)} style={{ animationDelay: `${(drop.r * -0.7).toFixed(2)}s` }} />
          ))}
        </g>
      )}
    </SceneSvg>
  );
}
