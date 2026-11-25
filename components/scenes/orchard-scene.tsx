import { SCENES } from "@/lib/scenes";

import { SceneSvg, onCurve, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.fasting;

const STARS = scatter(73, 52, { x: [16, 1184], y: [14, 240] });
const FIREFLIES = scatter(89, 18, { x: [140, 1060], y: [360, 520] });
const HERBS = scatter(61, 24, { x: [560, 940], y: [462, 544] });
const GROVE_TREES: [number, number, number][] = [
  [210, 444, 0.84],
  [934, 434, 0.82],
  [1046, 456, 0.94],
];
const MILKY = scatter(47, 100, { x: [0, 1], y: [0, 1] }).map((p) => {
  const x = p.x * 1200;
  return { x: round(x), y: round(220 - x * 0.14 + (p.y - 0.5) * 60), r: p.r };
});
const POPPIES = scatter(101, 26, { x: [20, 1180], y: [510, 556] });
const VILLAGE_LIGHTS = scatter(13, 14, { x: [560, 760], y: [296, 312] });
/** Terraced rows climbing the hill on the right: y of each row. */
const ROWS = { "row-1": 418, "row-2": 396, "row-3": 374 } as const;

/** A young olive, small, for the terraced rows. */
function Sapling({ x, y, s = 0.32 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-6 0 C-5 -30 -8 -60 0 -84 L6 -84 C10 -60 7 -30 8 0 Z" fill="var(--orchard-trunk)" />
      <ellipse cx={0} cy={-104} rx={52} ry={34} fill="var(--orchard-leaf)" />
      <ellipse cx={-14} cy={-110} rx={30} ry={18} fill="var(--orchard-leaf-lit)" opacity={0.7} />
    </g>
  );
}

function Person({ x, y, s = 1, tone = 1 }: { x: number; y: number; s?: number; tone?: 1 | 2 | 3 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-6 0 L6 0 L5 -18 C5 -23 -5 -23 -5 -18 Z" fill={`var(--orchard-cloth-${tone})`} />
      <circle cx={0} cy={-26} r={4.6} fill="var(--orchard-skin)" />
    </g>
  );
}

const CYPRESSES: [number, number, number][] = [
  [112, 338, 1.05],
  [144, 344, 0.85],
  [850, 326, 0.95],
  [878, 330, 1.1],
  [904, 336, 0.8],
];

function OliveTree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g data-fx="sway">
      {/* Gnarled trunk and spreading boughs */}
      <path d="M-11 0 C-10 -34 -14 -64 -4 -92 C-18 -106 -34 -116 -46 -122 L-40 -128 C-26 -122 -14 -112 -2 -102 C10 -116 26 -126 42 -130 L45 -122 C30 -116 16 -106 8 -90 C14 -62 12 -32 13 0 Z" fill="var(--orchard-trunk)" />
      {/* Silver-green olive crown */}
      <ellipse cx={-38} cy={-130} rx={44} ry={28} fill="var(--orchard-leaf-shade)" />
      <ellipse cx={36} cy={-136} rx={46} ry={30} fill="var(--orchard-leaf-shade)" />
      <ellipse cx={0} cy={-152} rx={58} ry={36} fill="var(--orchard-leaf)" />
      <ellipse cx={-22} cy={-144} rx={36} ry={22} fill="var(--orchard-leaf-lit)" opacity={0.78} />
      <ellipse cx={24} cy={-148} rx={34} ry={22} fill="var(--orchard-leaf-lit)" opacity={0.7} />
      </g>
    </g>
  );
}

function Cypress({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-2} y={-8} width={4} height={12} fill="var(--orchard-trunk)" />
      <path d="M0 -84 C8 -56 12 -24 9 0 L-9 0 C-12 -24 -8 -56 0 -84 Z" fill="var(--orchard-cypress)" />
    </g>
  );
}

/**
 * The olive orchard (Fasting). A quiet hillside at twilight, and sixty things
 * that arrive on the days you keep your fasts: a stone wall and the first
 * olive tree, a well and a gate lantern, terraced rows climbing the hill, a
 * stone house, the olive press and its jars, and a table beneath the tree
 * that fills dish by dish until family and guests sit down to break the fast
 * in the amber light of dusk. Patience, ripening.
 */
export function OrchardScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const amber = has("glow");
  const ripe = has("ripe");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="orchard-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--orchard-sky-1)" />
            <stop offset="56%" stopColor="var(--orchard-sky-2)" />
            <stop offset="100%" stopColor="var(--orchard-sky-3)" />
          </linearGradient>
          <linearGradient id="orchard-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--orchard-amber)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--orchard-amber)" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="orchard-lantern-glow">
            <stop offset="0%" stopColor="var(--orchard-lantern)" stopOpacity="0.82" />
            <stop offset="45%" stopColor="var(--orchard-lantern)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--orchard-lantern)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="orchard-moon-glow">
            <stop offset="0%" stopColor="var(--orchard-moon)" stopOpacity="0.65" />
            <stop offset="45%" stopColor="var(--orchard-moon)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--orchard-moon)" stopOpacity="0" />
          </radialGradient>
        </>
      }
    >
      {/* Twilight sky */}
      <rect width="1200" height="560" fill="url(#orchard-sky)" />

      {/* Stage 14: amber light of dusk along the horizon */}
      {stage("glow", <rect x={0} y={120} width={1200} height={260} fill="url(#orchard-amber)" />)}

      {stage(
        "milky-way",
        <g>
          {MILKY.map((star, i) => (
            <circle key={i} cx={star.x} cy={star.y} r={0.4 + star.r * 0.8} fill="var(--orchard-star)" opacity={0.25 + star.r * 0.4} />
          ))}
        </g>,
      )}
      {stage(
        "planet",
        <g data-fx="twinkle">
          <circle cx={720} cy={88} r={10} fill="url(#orchard-lantern-glow)" opacity={0.5} />
          <circle cx={720} cy={88} r={3} fill="var(--orchard-star)" />
        </g>,
      )}
      {stage(
        "shooting-star",
        <path data-fx="meteor" d="M420 70 l-70 32" stroke="var(--orchard-star)" strokeWidth={2} strokeLinecap="round" opacity={0.7} />,
      )}

      {/* Stage 13: bright stars overhead */}
      {stage(
        "stars",
        <g>
          {STARS.map((star, i) => (
            <circle
              key={i}
              data-fx="twinkle"
              cx={star.x}
              cy={star.y}
              r={0.6 + star.r * 1.5}
              fill="var(--orchard-star)"
              opacity={0.45 + star.r * 0.55}
              style={{ animationDelay: `${(star.r * 5).toFixed(2)}s` }}
            />
          ))}
        </g>,
      )}

      {/* Stage 12: crescent moon */}
      {stage(
        "crescent",
        <g>
          <circle cx={962} cy={112} r={92} fill="url(#orchard-moon-glow)" data-fx="halo" />
          <path
            d="M976 76 A36 36 0 1 0 996 138 A29 29 0 1 1 976 76 Z"
            fill="var(--orchard-moon)"
          />
        </g>,
      )}

      {/* Distant hills */}
      <path d="M0 326 Q220 264 470 310 T960 294 Q1090 284 1200 316 L1200 560 L0 560 Z" fill="var(--orchard-far)" />

      {stage(
        "minaret",
        <g fill="var(--orchard-cypress)">
          <rect x={662} y={262} width={8} height={40} />
          <rect x={659} y={276} width={14} height={3} />
          <path d="M661 262 L666 250 L671 262 Z" />
          <rect x={620} y={290} width={40} height={12} />
          <path d="M624 291 C624 278 656 278 656 291 Z" />
        </g>,
      )}
      {stage(
        "village-lights",
        VILLAGE_LIGHTS.map((l, i) => (
          <circle key={i} data-fx="twinkle" cx={round(l.x)} cy={round(l.y)} r={1.6} fill="var(--orchard-lantern)" style={{ animationDelay: `${(l.r * 4).toFixed(2)}s` }} />
        )),
      )}

      {/* Stage 6: cypresses on the ridge */}
      {stage(
        "cypress",
        CYPRESSES.map(([x, y, s]) => <Cypress key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}

      {/* Mid hill */}
      <path d="M0 374 Q280 328 580 364 T1200 356 L1200 560 L0 560 Z" fill="var(--orchard-mid)" />

      {stage(
        "terraces",
        <g stroke="var(--orchard-stone)" strokeWidth={3} fill="none" opacity={0.75}>
          {Object.values(ROWS).map((y) => (
            <path key={y} d={`M600 ${y + 4} Q900 ${y - 8} 1200 ${y}`} />
          ))}
        </g>,
      )}
      {(Object.keys(ROWS) as (keyof typeof ROWS)[]).map((id, r) =>
        stage(
          id,
          <g>
            {Array.from({ length: 7 }, (_, i) => 660 + i * 80 + r * 20).map((sx) => (
              <Sapling key={sx} x={sx} y={ROWS[id] + 2} s={0.3 - r * 0.04} />
            ))}
          </g>,
        ),
      )}
      {stage(
        "goats",
        <g fill="var(--orchard-goat)">
          {[
            [280, 384, 1],
            [310, 388, -1],
            [340, 382, 1],
          ].map(([gx, gy, f], i) => (
            <g key={i} transform={`translate(${gx} ${gy}) scale(${f * 0.8} 0.8)`}>
              <ellipse cx={0} cy={-10} rx={11} ry={6} />
              <path d="M9 -13 L15 -18 L17 -14 L12 -9 Z" />
              <path d="M14 -18 l-2 -5 M16 -18 l1 -5" stroke="var(--orchard-goat)" strokeWidth={1.2} />
              {[-7, -3, 4, 8].map((lx) => (
                <rect key={lx} x={lx} y={-6} width={2} height={6} />
              ))}
            </g>
          ))}
        </g>,
      )}
      {stage("moonlit", <path d="M600 360 Q900 340 1200 350 L1200 440 L600 440 Z" fill="var(--orchard-moon)" opacity={0.07} />)}

      {/* Stage 5: grove of olive trees across the slope */}
      {stage(
        "grove",
        GROVE_TREES.map(([x, y, s]) => <OliveTree key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}

      {stage(
        "harvest-nets",
        <g>
          <ellipse cx={210} cy={448} rx={60} ry={10} fill="var(--orchard-linen)" opacity={0.55} />
          <path d="M160 446 L260 450 M170 442 L250 454 M190 440 L230 456" stroke="var(--orchard-stone)" strokeWidth={0.8} opacity={0.6} />
        </g>,
      )}

      {/* Foreground quiet hillside (base) */}
      <g>
        <title>{SCENE.base}</title>
        <path d="M0 442 C240 412 520 422 800 442 S1080 434 1200 448 L1200 560 L0 560 Z" fill="var(--orchard-hill)" />
        <path d="M0 494 C280 476 580 492 860 508 S1100 504 1200 496 L1200 560 L0 560 Z" fill="var(--orchard-near)" />
      </g>

      {stage(
        "almond",
        <g transform="translate(70 452)">
          <g data-fx="sway">
            <path d="M-3 0 L-2 -60 L2 -60 L3 0 Z" fill="var(--orchard-trunk)" />
            {[
              [0, -72, 22],
              [-16, -60, 14],
              [16, -62, 15],
            ].map(([bx, by, r], i) => (
              <circle key={i} cx={bx} cy={by} r={r} fill="var(--orchard-almond)" />
            ))}
          </g>
        </g>,
      )}
      {stage("sapling", <Sapling x={150} y={456} s={0.42} />)}

      {/* Stage 1: low stone wall */}
      {stage(
        "wall",
        <g>
          <path d="M36 456 Q260 432 514 446 L514 476 Q260 462 36 486 Z" fill="var(--orchard-stone)" />
          {[68, 128, 188, 250, 314, 376, 438, 486].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={round(446 + Math.sin(i * 0.9) * 4)}
              width={44}
              height={12}
              rx={3}
              fill="var(--orchard-stone-lit)"
              opacity={0.7}
            />
          ))}
          {/* Gate post */}
          <rect x={500} y={424} width={24} height={56} rx={3} fill="var(--orchard-stone)" />
          <rect x={496} y={418} width={32} height={8} rx={2} fill="var(--orchard-stone-lit)" />
        </g>,
      )}

      {stage(
        "roses",
        [70, 132, 206, 270].map((rx, i) => (
          <g key={rx}>
            <ellipse cx={rx} cy={444 - (i % 2) * 2} rx={14} ry={6} fill="var(--orchard-leaf)" />
            <circle cx={rx - 4} cy={441} r={3.4} fill="var(--orchard-rose)" />
            <circle cx={rx + 5} cy={443} r={3} fill="var(--orchard-rose)" />
          </g>
        )),
      )}
      {stage(
        "oil-lamps",
        [100, 190, 300, 420].map((lx, i) => (
          <g key={lx}>
            <circle cx={lx} cy={436 - (i % 2) * 2} r={14} fill="url(#orchard-lantern-glow)" data-fx="glow" style={{ animationDelay: `${i * -1.2}s` }} />
            <ellipse cx={lx} cy={440 - (i % 2) * 2} rx={6} ry={3} fill="var(--orchard-clay)" />
            <path data-fx="flicker" d={`M${lx + 4} ${437 - (i % 2) * 2} q2 -6 0 -8 q-2 3 0 8 Z`} fill="var(--orchard-lantern-core)" />
          </g>
        )),
      )}
      {stage(
        "cat",
        <g transform="translate(344 442)" fill="var(--orchard-cat)">
          <ellipse cx={0} cy={-5} rx={10} ry={5} />
          <circle cx={8} cy={-8} r={4} />
          <path d="M5.5 -11 l1.5 -4 l2 3 Z M10 -11 l2 -3 l1 4 Z" />
          <path d="M-10 -4 q-4 6 -10 6" stroke="var(--orchard-cat)" strokeWidth={2} fill="none" />
        </g>,
      )}
      {stage(
        "house",
        <g>
          <rect x={760} y={410} width={84} height={46} fill="var(--orchard-house)" />
          <path d="M752 412 L802 380 L852 412 Z" fill="var(--orchard-roof)" />
          <rect x={790} y={430} width={18} height={26} fill="var(--orchard-wood)" />
          <rect x={768} y={424} width={14} height={12} fill="var(--orchard-window)" />
          <rect x={818} y={424} width={14} height={12} fill="var(--orchard-window)" />
        </g>,
      )}
      {stage(
        "house-light",
        <g>
          {[775, 825].map((wx) => (
            <g key={wx}>
              <circle cx={wx} cy={430} r={18} fill="url(#orchard-lantern-glow)" data-fx="glow" />
              <rect x={wx - 7} y={424} width={14} height={12} fill="var(--orchard-lantern-core)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "vine",
        <g>
          <path d="M786 456 C780 430 790 414 800 410 C810 414 820 430 812 456" stroke="var(--orchard-leaf)" strokeWidth={2.4} fill="none" />
          {[784, 792, 800, 808, 816].map((vx, i) => (
            <circle key={vx} cx={vx} cy={418 + (i % 2) * 6} r={4} fill="var(--orchard-leaf-lit)" />
          ))}
          <circle cx={796} cy={426} r={2.6} fill="var(--orchard-date)" />
          <circle cx={806} cy={428} r={2.6} fill="var(--orchard-date)" />
        </g>,
      )}

      {/* Stage 3: winding stone path */}
      {stage(
        "path",
        <g fill="var(--orchard-stone-lit)" opacity={0.8}>
          {[
            [596, 544, 42, 11],
            [638, 524, 36, 9],
            [670, 504, 30, 8],
            [644, 484, 26, 7],
            [608, 466, 22, 6],
            [576, 452, 18, 5],
          ].map(([cx, cy, rx, ry], i) => (
            <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />
          ))}
        </g>,
      )}

      {/* Stage 2: the main olive tree */}
      {stage("tree", <OliveTree x={372} y={498} s={1.26} />)}

      {stage(
        "olives",
        <g fill={ripe ? "var(--orchard-olive-ripe)" : "var(--orchard-olive)"}>
          {[
            [330, 312],
            [352, 300],
            [384, 296],
            [410, 306],
            [432, 318],
            [318, 328],
            [446, 330],
            [372, 284],
            [398, 288],
            [344, 322],
          ].map(([ox, oy], i) => (
            <ellipse key={i} cx={ox} cy={oy} rx={2.4} ry={3.2} />
          ))}
        </g>,
      )}
      {stage("ripe", <circle cx={372} cy={300} r={70} fill="var(--orchard-olive-ripe)" opacity={0.06} />)}
      {stage(
        "owl",
        <g transform="translate(424 336)">
          <ellipse cx={0} cy={0} rx={8} ry={11} fill="var(--orchard-trunk)" />
          <circle cx={-3} cy={-3} r={2.6} fill="var(--orchard-lantern)" />
          <circle cx={3} cy={-3} r={2.6} fill="var(--orchard-lantern)" />
          <path d="M-6 -10 l2 -5 l2 4 M6 -10 l-2 -5 l-2 4" fill="var(--orchard-trunk)" />
        </g>,
      )}

      {/* Stage 10: string lanterns draped across the branches */}
      {stage(
        "string-lights",
        <g>
          <path d="M294 342 Q372 374 452 338" stroke="var(--orchard-trunk)" strokeWidth={1.6} fill="none" opacity={0.75} />
          {[0.15, 0.33, 0.5, 0.67, 0.85].map((t) => {
            const [lx, ly] = onCurve([294, 342], [372, 374], [452, 338], t);
            return (
              <g key={t}>
                <circle cx={round(lx)} cy={round(ly + 6)} r={16} fill="url(#orchard-lantern-glow)" data-fx="glow" />
                <circle cx={round(lx)} cy={round(ly + 6)} r={4} fill="var(--orchard-lantern)" />
              </g>
            );
          })}
        </g>,
      )}

      {/* Stage 4: gate lantern, lit */}
      {stage(
        "lantern",
        <g>
          <circle cx={512} cy={406} r={54} fill="url(#orchard-lantern-glow)" data-fx="glow" />
          <rect x={504} y={396} width={16} height={22} rx={3} fill="var(--orchard-lantern)" />
          <path d="M501 396 L512 386 L523 396 Z" fill="var(--orchard-trunk)" />
          <rect x={508} y={400} width={8} height={14} rx={2} fill="var(--orchard-lantern-core)" />
        </g>,
      )}

      {stage(
        "rug",
        <g>
          <path d="M360 548 L530 548 L516 508 L374 508 Z" fill="var(--orchard-rug)" />
          <path d="M372 542 L518 542 L506 514 L384 514 Z" fill="none" stroke="var(--orchard-linen)" strokeWidth={2} opacity={0.7} />
        </g>,
      )}
      {stage(
        "cushions",
        <g>
          <rect x={366} y={526} width={26} height={12} rx={5} fill="var(--orchard-cloth-1)" />
          <rect x={500} y={526} width={26} height={12} rx={5} fill="var(--orchard-cloth-2)" />
        </g>,
      )}
      {stage(
        "family",
        <g>
          <Person x={380} y={524} tone={1} />
          <Person x={512} y={524} tone={2} />
          <Person x={540} y={530} s={0.7} tone={3} />
        </g>,
      )}

      {/* Stage 7: wooden table beneath the olive tree */}
      {stage(
        "table",
        <g>
          <rect x={392} y={482} width={104} height={9} rx={3} fill="var(--orchard-wood-lit)" />
          <path d="M402 491 L402 528 M486 491 L486 528 M404 510 L484 510" stroke="var(--orchard-wood)" strokeWidth={5} strokeLinecap="round" />
          {/* Linen runner */}
          <path d="M416 482 L472 482 L476 496 L412 496 Z" fill="var(--orchard-linen)" opacity={0.88} />
        </g>,
      )}

      {/* Stage 8: bowl of dates and clay pitcher of water */}
      {stage(
        "dates",
        <g>
          {/* Clay pitcher */}
          <ellipse cx={428} cy={472} rx={9} ry={11} fill="var(--orchard-clay)" />
          <rect x={424} y={456} width={8} height={8} rx={2} fill="var(--orchard-clay)" />
          <path d="M436 462 Q443 466 436 474" fill="none" stroke="var(--orchard-clay)" strokeWidth={2.2} />
          {/* Bowl of dates */}
          <path d="M448 478 Q460 486 472 478 Z" fill="var(--orchard-stone-lit)" />
          <ellipse cx={455} cy={476} rx={4} ry={2.8} fill="var(--orchard-date)" />
          <ellipse cx={461} cy={475} rx={4} ry={2.8} fill="var(--orchard-date)" />
          <ellipse cx={466} cy={476} rx={4} ry={2.8} fill="var(--orchard-date)" />
          <ellipse cx={458} cy={473} rx={3.5} ry={2.5} fill="var(--orchard-date)" />
          {/* Water cup */}
          <rect x={476} y={472} width={8} height={10} rx={1.5} fill="var(--orchard-water)" opacity={0.9} />
        </g>,
      )}

      {stage(
        "bread",
        <g>
          <ellipse cx={404} cy={478} rx={10} ry={4} fill="var(--orchard-bread)" />
          <path d="M398 476 L402 474 M404 477 L408 475" stroke="var(--orchard-wood)" strokeWidth={1} />
        </g>,
      )}
      {stage(
        "soup",
        <g>
          <path d="M436 470 L456 470 L454 482 L438 482 Z" fill="var(--orchard-clay)" />
          <path data-fx="steam" d="M446 466 q-4 -6 2 -10 q4 -4 0 -8" stroke="var(--orchard-steam)" strokeWidth={1.4} fill="none" />
        </g>,
      )}
      {stage(
        "fruit",
        <g>
          <path d="M484 480 Q494 488 504 480 Z" fill="var(--orchard-stone-lit)" />
          <circle cx={490} cy={477} r={3.4} fill="var(--orchard-pomegranate)" />
          <circle cx={497} cy={476} r={3.4} fill="var(--orchard-lantern)" />
        </g>,
      )}
      {stage(
        "lamps-table",
        <g>
          {[398, 490].map((lx) => (
            <g key={lx}>
              <circle cx={lx} cy={470} r={16} fill="url(#orchard-lantern-glow)" data-fx="glow" />
              <ellipse cx={lx} cy={474} rx={5} ry={2.4} fill="var(--orchard-clay)" />
              <path data-fx="flicker" d={`M${lx + 3} ${472} q2 -5 0 -7 q-2 3 0 7 Z`} fill="var(--orchard-lantern-core)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "tea",
        <g>
          <path d="M462 482 L474 482 L472 470 L464 470 Z" fill="var(--orchard-teapot)" />
          <path d="M474 474 q5 -2 6 -6" stroke="var(--orchard-teapot)" strokeWidth={1.6} fill="none" />
        </g>,
      )}
      {stage(
        "glasses",
        <g fill="var(--orchard-glass)">
          {[416, 428, 476].map((gx) => (
            <rect key={gx} x={gx} y={474} width={4} height={8} rx={1} />
          ))}
        </g>,
      )}
      {stage(
        "full-table",
        <g>
          <rect x={496} y={482} width={60} height={9} rx={3} fill="var(--orchard-wood-lit)" />
          <path d="M550 491 L550 528" stroke="var(--orchard-wood)" strokeWidth={5} strokeLinecap="round" />
          <path d="M500 482 L552 482 L550 492 L502 492 Z" fill="var(--orchard-linen)" opacity={0.88} />
          <ellipse cx={516} cy={478} rx={8} ry={3.4} fill="var(--orchard-bread)" />
          <circle cx={536} cy={477} r={4} fill="var(--orchard-date)" />
        </g>,
      )}
      {stage(
        "guests",
        <g>
          <Person x={630} y={510} s={0.9} tone={3} />
          <Person x={652} y={506} s={0.85} tone={1} />
        </g>,
      )}

      {/* Stage 9: thyme and lavender along the path */}
      {stage(
        "herbs",
        HERBS.map((h, i) => (
          <g key={i}>
            <line x1={h.x} y1={h.y} x2={h.x} y2={h.y - 10 - h.r * 7} stroke="var(--orchard-leaf)" strokeWidth={1.6} />
            <ellipse
              cx={h.x}
              cy={h.y - 11 - h.r * 7}
              rx={2.5}
              ry={4.5}
              fill={i % 2 === 0 ? "var(--orchard-lavender)" : "var(--orchard-thyme)"}
            />
          </g>
        )),
      )}

      {stage(
        "well",
        <g>
          <ellipse cx={262} cy={536} rx={22} ry={7} fill="var(--orchard-stone)" />
          <rect x={240} y={516} width={44} height={20} fill="var(--orchard-stone-lit)" />
          <path d="M244 516 L244 490 L280 490 L280 516" stroke="var(--orchard-wood)" strokeWidth={3} fill="none" />
          <line x1={262} y1={490} x2={262} y2={504} stroke="var(--orchard-wood)" strokeWidth={1.2} />
          <path d="M256 504 L268 504 L266 512 L258 512 Z" fill="var(--orchard-wood)" />
        </g>,
      )}
      {stage(
        "bench",
        <g stroke="var(--orchard-wood)" strokeWidth={3} strokeLinecap="round">
          <line x1={110} y1={512} x2={176} y2={510} />
          <line x1={116} y1={512} x2={116} y2={526} />
          <line x1={170} y1={510} x2={170} y2={524} />
        </g>,
      )}
      {stage("quiet", <Person x={146} y={510} s={0.9} tone={2} />)}
      {stage(
        "baskets",
        <g>
          {[580, 606].map((bx) => (
            <g key={bx}>
              <path d={`M${bx - 11} 540 L${bx + 11} 540 L${bx + 8} 554 L${bx - 8} 554 Z`} fill="var(--orchard-wood-lit)" />
              {[-5, 0, 5].map((dx) => (
                <circle key={dx} cx={bx + dx} cy={538} r={3} fill={ripe ? "var(--orchard-olive-ripe)" : "var(--orchard-olive)"} />
              ))}
            </g>
          ))}
        </g>,
      )}
      {stage(
        "press",
        <g>
          <ellipse cx={760} cy={532} rx={30} ry={9} fill="var(--orchard-stone)" />
          <rect x={742} y={508} width={14} height={26} rx={6} fill="var(--orchard-stone-lit)" />
          <line x1={749} y1={508} x2={790} y2={496} stroke="var(--orchard-wood)" strokeWidth={4} strokeLinecap="round" />
        </g>,
      )}
      {stage(
        "jars",
        <g fill="var(--orchard-clay)">
          {[806, 822, 836].map((jx, i) => (
            <g key={jx}>
              <ellipse cx={jx} cy={536 - i} rx={7} ry={10} />
              <rect x={jx - 3} y={522 - i} width={6} height={5} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "donkey",
        <g transform="translate(700 544)" fill="var(--orchard-donkey)">
          <ellipse cx={0} cy={-14} rx={13} ry={7} />
          <path d="M10 -16 L17 -27 L20 -23 L14 -12 Z" />
          <path d="M16 -27 l-1 -7 M19 -26 l2 -6" stroke="var(--orchard-donkey)" strokeWidth={1.8} />
          {[-8, -4, 5, 9].map((lx) => (
            <rect key={lx} x={lx} y={-9} width={2.4} height={10} />
          ))}
        </g>,
      )}
      {stage(
        "hives",
        <g>
          {[896, 920].map((hx) => (
            <g key={hx}>
              <rect x={hx - 8} y={514} width={16} height={16} rx={2} fill="var(--orchard-wood-lit)" />
              <path d={`M${hx - 9} 515 L${hx} 507 L${hx + 9} 515 Z`} fill="var(--orchard-roof)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "pomegranate",
        <g transform="translate(990 530)">
          <g data-fx="sway">
            <path d="M-3 0 L-2 -30 L2 -30 L3 0 Z" fill="var(--orchard-trunk)" />
            <circle cx={0} cy={-42} r={18} fill="var(--orchard-leaf)" />
            <circle cx={-12} cy={-34} r={11} fill="var(--orchard-leaf)" />
            <circle cx={12} cy={-35} r={12} fill="var(--orchard-leaf)" />
            {[
              [-8, -40],
              [8, -32],
              [10, -46],
              [-4, -30],
            ].map(([fx, fy], i) => (
              <circle key={i} cx={fx} cy={fy} r={3.4} fill="var(--orchard-pomegranate)" />
            ))}
          </g>
        </g>,
      )}
      {stage(
        "fig",
        <g transform="translate(1150 526)">
          <g data-fx="sway">
            <path d="M-4 0 L-3 -36 L3 -36 L4 0 Z" fill="var(--orchard-trunk)" />
            <ellipse cx={0} cy={-52} rx={28} ry={20} fill="var(--orchard-leaf-shade)" />
            <ellipse cx={-6} cy={-58} rx={18} ry={11} fill="var(--orchard-leaf-lit)" opacity={0.6} />
            {[
              [-10, -48],
              [8, -46],
              [2, -60],
            ].map(([fx, fy], i) => (
              <ellipse key={i} cx={fx} cy={fy} rx={3} ry={3.6} fill="var(--orchard-date)" />
            ))}
          </g>
        </g>,
      )}
      {stage(
        "sheep",
        <g>
          <path d="M1040 548 L1040 520 L1110 518 L1110 548" stroke="var(--orchard-wood)" strokeWidth={2} fill="none" />
          {[1056, 1074, 1092].map((sx, i) => (
            <g key={sx}>
              <ellipse cx={sx} cy={538 - (i % 2) * 2} rx={9} ry={6} fill="var(--orchard-sheep)" />
              <circle cx={sx + 7} cy={534 - (i % 2) * 2} r={3} fill="var(--orchard-trunk)" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "wild-flowers",
        POPPIES.map((f, i) => (
          <g key={i}>
            <line x1={round(f.x)} y1={round(f.y)} x2={round(f.x)} y2={round(f.y - 7)} stroke="var(--orchard-leaf)" strokeWidth={1.2} />
            <circle cx={round(f.x)} cy={round(f.y - 8)} r={2.6} fill="var(--orchard-rose)" />
          </g>
        )),
      )}

      {/* Stage 11: fireflies in the grass */}
      {stage(
        "fireflies",
        FIREFLIES.map((f, i) => (
          <circle
            key={i}
            data-fx="firefly"
            cx={f.x}
            cy={f.y}
            r={2 + f.r * 1.8}
            fill="var(--orchard-lantern)"
            style={{ animationDelay: `${(f.r * 6).toFixed(2)}s` }}
          />
        )),
      )}

      {amber && <rect width="1200" height="560" fill="var(--orchard-amber)" opacity={0.08} pointerEvents="none" />}
    </SceneSvg>
  );
}
