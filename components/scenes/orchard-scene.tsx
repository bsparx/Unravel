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
const CYPRESSES: [number, number, number][] = [
  [112, 338, 1.05],
  [144, 344, 0.85],
  [850, 326, 0.95],
  [878, 330, 1.1],
  [904, 336, 0.8],
];

function OliveTree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} data-fx="sway" style={{ transformOrigin: "0px 0px" }}>
      {/* Gnarled trunk and spreading boughs */}
      <path d="M-11 0 C-10 -34 -14 -64 -4 -92 C-18 -106 -34 -116 -46 -122 L-40 -128 C-26 -122 -14 -112 -2 -102 C10 -116 26 -126 42 -130 L45 -122 C30 -116 16 -106 8 -90 C14 -62 12 -32 13 0 Z" fill="var(--orchard-trunk)" />
      {/* Silver-green olive crown */}
      <ellipse cx={-38} cy={-130} rx={44} ry={28} fill="var(--orchard-leaf-shade)" />
      <ellipse cx={36} cy={-136} rx={46} ry={30} fill="var(--orchard-leaf-shade)" />
      <ellipse cx={0} cy={-152} rx={58} ry={36} fill="var(--orchard-leaf)" />
      <ellipse cx={-22} cy={-144} rx={36} ry={22} fill="var(--orchard-leaf-lit)" opacity={0.78} />
      <ellipse cx={24} cy={-148} rx={34} ry={22} fill="var(--orchard-leaf-lit)" opacity={0.7} />
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
 * The olive orchard (Fasting). A quiet hillside at twilight, and fourteen
 * things that arrive on the days you keep your fasts: a stone wall, the first
 * olive tree, a winding stone path, a lit gate lantern, a grove of olives,
 * ridge cypresses, a table beneath the tree, dates and water waiting for
 * sunset, thyme and lavender, branch lanterns, fireflies, the crescent moon,
 * bright stars, and the warm amber glow of dusk.
 */
export function OrchardScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const amber = has("glow");

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

      {/* Stage 6: cypresses on the ridge */}
      {stage(
        "cypress",
        CYPRESSES.map(([x, y, s]) => <Cypress key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}

      {/* Mid hill */}
      <path d="M0 374 Q280 328 580 364 T1200 356 L1200 560 L0 560 Z" fill="var(--orchard-mid)" />

      {/* Stage 5: grove of olive trees across the slope */}
      {stage(
        "grove",
        GROVE_TREES.map(([x, y, s]) => <OliveTree key={`${x}-${y}`} x={x} y={y} s={s} />),
      )}

      {/* Foreground quiet hillside (base) */}
      <g>
        <title>{SCENE.base}</title>
        <path d="M0 442 C240 412 520 422 800 442 S1080 434 1200 448 L1200 560 L0 560 Z" fill="var(--orchard-hill)" />
        <path d="M0 494 C280 476 580 492 860 508 S1100 504 1200 496 L1200 560 L0 560 Z" fill="var(--orchard-near)" />
      </g>

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
