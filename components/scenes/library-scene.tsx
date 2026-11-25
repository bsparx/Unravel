import { SCENES } from "@/lib/scenes";

import { SceneSvg, round, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.reading;

const FLOOR_Y = 440;
const GALLERY_Y = 200;

/** Where each shelf of the lower wall sits: x, width, plank y. */
const SHELVES = {
  // The one bare shelf there from the start, and what fills it.
  "first-books": [215, 170, 335],
  novels: [215, 170, 280],
  poetry: [215, 170, 390],
  history: [30, 170, 335],
  science: [30, 170, 280],
  travel: [30, 170, 390],
  philosophy: [815, 170, 335],
  tafsir: [815, 170, 280],
  biography: [815, 170, 390],
  mathematics: [1000, 170, 335],
  "art-books": [1000, 170, 280],
  languages: [1000, 170, 390],
} as const satisfies Record<string, readonly [number, number, number]>;

const BOOK_COLOURS = [1, 2, 3, 4, 5, 6].map((n) => `var(--library-book-${n})`);

/** A run of books standing on a plank: widths, heights and colours from a seed. */
function Books({ x, w, y, seed, maxH = 40, lean = false }: { x: number; w: number; y: number; seed: number; maxH?: number; lean?: boolean }) {
  const picks = scatter(seed, 40, { x: [0, 1], y: [0, 1] });
  const books: { x: number; w: number; h: number; c: string }[] = [];
  let at = x + 4;
  for (const p of picks) {
    const bw = 6 + Math.round(p.x * 7);
    if (at + bw > x + w - 4) break;
    books.push({ x: at, w: bw, h: Math.round(maxH * (0.62 + p.y * 0.38)), c: BOOK_COLOURS[Math.floor(p.r * BOOK_COLOURS.length)] });
    at += bw + (p.r > 0.85 ? 4 : 0.6);
  }
  const last = books.at(-1);
  return (
    <g>
      {books.map((b, i) => (
        <g key={i}>
          <rect x={round(b.x)} y={y - b.h} width={b.w} height={b.h} rx={1} fill={b.c} />
          <rect x={round(b.x + 1)} y={y - b.h + 5} width={b.w - 2} height={2} fill="var(--library-gilt)" opacity={0.7} />
        </g>
      ))}
      {lean && last && (
        <rect x={round(last.x + last.w + 6)} y={y - maxH * 0.8} width={7} height={maxH * 0.8} rx={1} fill={BOOK_COLOURS[seed % 6]} transform={`rotate(-14 ${round(last.x + last.w + 6)} ${y})`} />
      )}
    </g>
  );
}

function Plank({ x, w, y }: { x: number; w: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={7} fill="var(--library-shelf)" />
      <rect x={x} y={y + 7} width={w} height={3} fill="var(--library-shelf-dark)" />
    </g>
  );
}

/** A full shelf: plank and books. */
function Shelf({ id, seed }: { id: keyof typeof SHELVES; seed: number }) {
  const [x, w, y] = SHELVES[id];
  return (
    <g>
      <Plank x={x} w={w} y={y} />
      <Books x={x} w={w} y={y} seed={seed} lean={seed % 2 === 0} />
    </g>
  );
}

function Armchair({ x, colour = "var(--library-chair)" }: { x: number; colour?: string }) {
  return (
    <g transform={`translate(${x} ${FLOOR_Y + 40})`}>
      <path d="M-34 -10 L-34 -62 Q-34 -76 -20 -76 L20 -76 Q34 -76 34 -62 L34 -10 Z" fill={colour} />
      <rect x={-42} y={-36} width={16} height={36} rx={7} fill={colour} />
      <rect x={26} y={-36} width={16} height={36} rx={7} fill={colour} />
      <rect x={-28} y={-28} width={56} height={18} rx={5} fill="var(--library-chair-lit)" />
      <path d="M-34 0 L-30 10 M30 0 L34 10" stroke="var(--library-shelf-dark)" strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

function GreenLamp({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y - 14} r={30} fill="url(#library-glow)" data-fx="glow" />
      <rect x={x - 2} y={y - 14} width={4} height={14} fill="var(--library-brass)" />
      <rect x={x - 8} y={y - 2} width={16} height={3} rx={1} fill="var(--library-brass)" />
      <path d={`M${x - 14} ${y - 12} Q${x} ${y - 24} ${x + 14} ${y - 12} Z`} fill="var(--library-green-lamp)" />
    </g>
  );
}

/**
 * The growing library (reading). An empty room with one bare shelf, and sixty
 * things that come into it, one more for each day you read: a lamp and the
 * first books, a chair and a cup of tea, then a shelf for each subject, a
 * fireplace, a gallery and its spiral stair, a chandelier, and at the last a
 * painted dome over every shelf full.
 */
export function LibraryScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="library-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--library-wall-1)" />
            <stop offset="100%" stopColor="var(--library-wall-2)" />
          </linearGradient>
          <linearGradient id="library-out" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--library-out-1)" />
            <stop offset="100%" stopColor="var(--library-out-2)" />
          </linearGradient>
          <radialGradient id="library-glow">
            <stop offset="0%" stopColor="var(--library-light)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--library-light)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="library-fire-glow">
            <stop offset="0%" stopColor="var(--library-fire)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--library-fire)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="library-warm" cx="0.5" cy="0.7" r="0.8">
            <stop offset="0%" stopColor="var(--library-light)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--library-light)" stopOpacity="0" />
          </radialGradient>
          <clipPath id="library-window">
            <path d="M548 420 L548 290 A52 52 0 0 1 652 290 L652 420 Z" />
          </clipPath>
          <clipPath id="library-skylight">
            <rect x={530} y={6} width={140} height={44} rx={6} />
          </clipPath>
        </>
      }
    >
      {/* The room: wall, ceiling, panelling, floor. */}
      <g>
        <title>{SCENE.base}</title>
        <rect width="1200" height={FLOOR_Y} fill="url(#library-wall)" />
        <rect width="1200" height={56} fill="var(--library-ceiling)" />
        <rect y={52} width="1200" height={6} fill="var(--library-trim)" />
        <rect y={FLOOR_Y - 50} width="1200" height={50} fill="var(--library-panel)" opacity={0.5} />
        <rect y={FLOOR_Y - 52} width="1200" height={3} fill="var(--library-trim)" />
        <rect y={FLOOR_Y} width="1200" height={560 - FLOOR_Y} fill="var(--library-floor)" />
        {Array.from({ length: 13 }, (_, i) => (
          <line key={i} x1={-200 + i * 120} y1={FLOOR_Y} x2={-420 + i * 160} y2={560} stroke="var(--library-floor-line)" strokeWidth={2} />
        ))}
        <rect y={FLOOR_Y} width="1200" height={5} fill="var(--library-trim)" />
      </g>

      {/* The ceiling: a skylight, then a painted dome round it. */}
      {stage(
        "dome",
        <g>
          <path d="M380 56 Q600 -40 820 56 Z" fill="var(--library-dome)" />
          <path d="M410 56 Q600 -24 790 56" stroke="var(--library-gilt)" strokeWidth={3} fill="none" />
          {[470, 535, 600, 665, 730].map((dx) => (
            <circle key={dx} cx={dx} cy={dx === 600 ? 10 : 32 - Math.abs(dx - 600) / 12} r={4} fill="var(--library-gilt)" />
          ))}
        </g>,
      )}
      {stage(
        "skylight",
        <g>
          <rect x={526} y={2} width={148} height={52} rx={8} fill="var(--library-shelf)" />
          <rect x={530} y={6} width={140} height={44} rx={6} fill="url(#library-out)" />
          <line x1={600} y1={6} x2={600} y2={50} stroke="var(--library-shelf)" strokeWidth={3} />
        </g>,
      )}
      <g clipPath="url(#library-skylight)">
        {stage(
          "stars",
          scatter(5, 14, { x: [534, 666], y: [10, 46] }).map((s, i) => (
            <circle key={i} data-fx="twinkle" cx={round(s.x)} cy={round(s.y)} r={round(0.6 + s.r)} fill="var(--library-star)" style={{ animationDelay: `${(s.r * 4).toFixed(2)}s` }} />
          )),
        )}
        {stage(
          "moon",
          <g>
            <circle cx={640} cy={26} r={12} fill="var(--library-moon)" />
            <circle cx={636} cy={23} r={2.4} fill="var(--library-moon-shade)" opacity={0.4} />
          </g>,
        )}
      </g>

      {/* The window, with what's outside it. */}
      <path d="M540 424 L540 290 A60 60 0 0 1 660 290 L660 424 Z" fill="var(--library-trim)" />
      <path d="M548 420 L548 290 A52 52 0 0 1 652 290 L652 420 Z" fill="url(#library-out)" />
      <g clipPath="url(#library-window)">
        <path d="M548 380 Q600 350 652 372 L652 420 L548 420 Z" fill="var(--library-out-hill)" />
        <circle cx={622} cy={292} r={10} fill="var(--library-moon)" opacity={0.9} />
        {stage(
          "stained-glass",
          <g opacity={0.55}>
            <path d="M548 290 A52 52 0 0 1 600 238 L600 290 Z" fill="var(--library-stained-1)" />
            <path d="M600 238 A52 52 0 0 1 652 290 L600 290 Z" fill="var(--library-stained-2)" />
            <circle cx={600} cy={276} r={14} fill="var(--library-stained-3)" />
          </g>,
        )}
      </g>
      <path d="M600 238 L600 420 M548 330 L652 330" stroke="var(--library-trim)" strokeWidth={4} />
      <rect x={534} y={418} width={132} height={8} rx={2} fill="var(--library-trim)" />
      {stage(
        "plant",
        <g>
          <path d="M586 418 L614 418 L610 400 L590 400 Z" fill="var(--library-pot)" />
          <path d="M600 400 C590 384 578 380 570 384 M600 400 C606 380 620 374 630 378 M600 400 C600 386 598 374 602 362" stroke="var(--library-leaf)" strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>,
      )}
      {stage(
        "cushions",
        <g>
          <rect x={552} y={404} width={30} height={14} rx={6} fill="var(--library-rug)" />
          <rect x={618} y={404} width={30} height={14} rx={6} fill="var(--library-book-2)" />
        </g>,
      )}

      {/* The fireplace and what's on its mantel. */}
      {stage(
        "fireplace",
        <g>
          <rect x={410} y={250} width={110} height={130} fill="var(--library-stone)" opacity={0.6} />
          <rect x={400} y={376} width={130} height={10} rx={2} fill="var(--library-trim)" />
          <rect x={410} y={386} width={110} height={54} fill="var(--library-stone)" />
          <path d="M428 440 L428 410 A37 26 0 0 1 502 410 L502 440 Z" fill="var(--library-hearth)" />
        </g>,
      )}
      {stage(
        "fire",
        <g>
          <circle cx={465} cy={428} r={60} fill="url(#library-fire-glow)" data-fx="glow" />
          <path d="M444 438 L486 434 M446 432 L486 438" stroke="var(--library-log)" strokeWidth={5} strokeLinecap="round" />
          <g data-fx="flicker">
            <path d="M465 404 C476 416 478 428 465 436 C452 428 454 416 465 404 Z" fill="var(--library-fire)" />
            <path d="M465 416 C470 422 470 428 465 432 C460 428 460 422 465 416 Z" fill="var(--library-fire-core)" />
          </g>
        </g>,
      )}
      {stage(
        "candles",
        <g>
          {[418, 512].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={358} r={14} fill="url(#library-glow)" data-fx="glow" />
              <rect x={cx - 2.5} y={360} width={5} height={16} fill="var(--library-paper)" />
              <path d={`M${cx} 352 C${cx + 3} 356 ${cx + 2} 360 ${cx} 361 C${cx - 2} 360 ${cx - 3} 356 ${cx} 352 Z`} fill="var(--library-fire-core)" data-fx="flicker" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "scrolls",
        <g>
          <rect x={428} y={262} width={74} height={74} fill="var(--library-shelf)" />
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((c) => (
              <g key={`${r}-${c}`}>
                <rect x={432 + c * 23} y={266 + r * 23} width={20} height={20} fill="var(--library-shelf-dark)" />
                <circle cx={442 + c * 23} cy={276 + r * 23} r={6} fill="var(--library-paper)" />
                <circle cx={442 + c * 23} cy={276 + r * 23} r={2} fill="var(--library-gilt)" />
              </g>
            )),
          )}
        </g>,
      )}

      {/* The map, the clock, the cabinet and the bust between window and shelves. */}
      {stage(
        "map",
        <g>
          <rect x={682} y={262} width={108} height={70} fill="var(--library-map)" />
          <path d="M694 300 Q716 280 736 296 T778 290 M700 316 Q728 306 760 320" stroke="var(--library-map-ink)" strokeWidth={2} fill="none" />
          <rect x={682} y={262} width={108} height={70} fill="none" stroke="var(--library-shelf)" strokeWidth={3} />
        </g>,
      )}
      {stage(
        "clock",
        <g>
          <circle cx={736} cy={236} r={16} fill="var(--library-paper)" stroke="var(--library-brass)" strokeWidth={3} />
          <path d="M736 236 L736 226 M736 236 L743 240" stroke="var(--library-ink)" strokeWidth={1.6} strokeLinecap="round" />
        </g>,
      )}
      {stage(
        "cabinet",
        <g>
          <rect x={690} y={372} width={92} height={68} fill="var(--library-shelf)" />
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((c) => (
              <g key={`${r}-${c}`}>
                <rect x={694 + c * 29} y={376 + r * 21} width={26} height={18} fill="var(--library-shelf-dark)" />
                <rect x={704 + c * 29} y={384 + r * 21} width={6} height={3} fill="var(--library-brass)" />
              </g>
            )),
          )}
        </g>,
      )}
      {stage(
        "bust",
        <g>
          <path d="M724 372 L748 372 L744 358 L728 358 Z" fill="var(--library-marble)" />
          <ellipse cx={736} cy={356} rx={12} ry={6} fill="var(--library-marble)" />
          <circle cx={736} cy={344} r={8} fill="var(--library-marble)" />
        </g>,
      )}

      {/* The shelves: one bare at first, then a subject at a time. */}
      <Plank x={SHELVES["first-books"][0]} w={SHELVES["first-books"][1]} y={SHELVES["first-books"][2]} />
      {stage(
        "first-books",
        <Books x={SHELVES["first-books"][0]} w={SHELVES["first-books"][1] * (has("stack") ? 1 : 0.55)} y={SHELVES["first-books"][2]} seed={1} lean />,
      )}
      {(["novels", "poetry", "history", "science", "travel", "philosophy", "tafsir", "biography", "mathematics", "languages"] as const).map((id, i) =>
        stage(id, <Shelf id={id} seed={i * 7 + 3} />),
      )}
      {stage(
        "art-books",
        <g>
          <Plank x={1000} w={170} y={280} />
          {[1008, 1046, 1084, 1122].map((bx, i) => (
            <rect key={bx} x={bx} y={236} width={34} height={44} rx={2} fill={BOOK_COLOURS[(i * 2 + 1) % 6]} />
          ))}
        </g>,
      )}
      {stage(
        "bookcase-left",
        <g fill="var(--library-shelf-dark)">
          <rect x={22} y={228} width={8} height={212} />
          <rect x={200} y={228} width={15} height={212} />
          <rect x={385} y={228} width={8} height={212} />
          <rect x={16} y={220} width={384} height={10} fill="var(--library-shelf)" />
        </g>,
      )}
      {stage(
        "bookcase-right",
        <g fill="var(--library-shelf-dark)">
          <rect x={807} y={228} width={8} height={212} />
          <rect x={985} y={228} width={15} height={212} />
          <rect x={1170} y={228} width={8} height={212} />
          <rect x={801} y={220} width={384} height={10} fill="var(--library-shelf)" />
        </g>,
      )}
      {stage(
        "owl",
        <g transform="translate(1150 220)">
          <path d="M-8 0 L8 0 L7 -16 C7 -22 -7 -22 -7 -16 Z" fill="var(--library-shelf)" />
          <circle cx={-3} cy={-14} r={2.6} fill="var(--library-gilt)" />
          <circle cx={3} cy={-14} r={2.6} fill="var(--library-gilt)" />
        </g>,
      )}
      {stage(
        "bookmarks",
        <g>
          {[
            [240, 335],
            [320, 280],
            [96, 390],
            [870, 335],
            [1060, 390],
            [150, 280],
          ].map(([bx, by], i) => (
            <path key={i} d={`M${bx} ${by - 6} l0 16 l3 -3 l3 3 l0 -16`} fill={`var(--library-stained-${(i % 3) + 1})`} />
          ))}
        </g>,
      )}

      {/* The gallery: floor, books, railing, lamps. */}
      {stage(
        "gallery-books",
        <g>
          {[
            [70, 150],
            [70, 100],
            [880, 150],
            [880, 100],
          ].map(([gx, gy], i) => (
            <g key={i}>
              <Plank x={gx} w={250} y={gy} />
              <Books x={gx} w={250} y={gy} seed={40 + i} maxH={34} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "upper-shelves",
        <g>
          {[
            [330, 150],
            [330, 100],
            [640, 150],
            [640, 100],
          ].map(([gx, gy], i) => (
            <g key={i}>
              <Plank x={gx} w={230} y={gy} />
              <Books x={gx} w={230} y={gy} seed={60 + i} maxH={34} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "gallery",
        <g>
          <rect x={0} y={GALLERY_Y} width={1200} height={14} fill="var(--library-shelf)" />
          <rect x={0} y={GALLERY_Y + 14} width={1200} height={4} fill="var(--library-shelf-dark)" />
          {[120, 360, 840, 1080].map((bx) => (
            <path key={bx} d={`M${bx - 10} ${GALLERY_Y + 18} L${bx + 10} ${GALLERY_Y + 18} L${bx} ${GALLERY_Y + 34} Z`} fill="var(--library-shelf-dark)" />
          ))}
        </g>,
      )}
      {stage(
        "railing",
        <g stroke="var(--library-brass)" strokeWidth={2}>
          <line x1={0} y1={GALLERY_Y - 22} x2={1200} y2={GALLERY_Y - 22} strokeWidth={3} />
          {Array.from({ length: 40 }, (_, i) => i * 30 + 15).map((rx) => (
            <line key={rx} x1={rx} y1={GALLERY_Y - 22} x2={rx} y2={GALLERY_Y} />
          ))}
        </g>,
      )}
      {stage(
        "gallery-lamps",
        <g>
          {[240, 480, 720, 960].map((lx) => (
            <g key={lx}>
              <circle cx={lx} cy={GALLERY_Y - 36} r={22} fill="url(#library-glow)" data-fx="glow" />
              <rect x={lx - 4} y={GALLERY_Y - 42} width={8} height={12} rx={2} fill="var(--library-light)" />
              <line x1={lx} y1={GALLERY_Y - 30} x2={lx} y2={GALLERY_Y - 22} stroke="var(--library-brass)" strokeWidth={2} />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "chandelier",
        <g>
          <line x1={600} y1={56} x2={600} y2={110} stroke="var(--library-brass)" strokeWidth={2} />
          <circle cx={600} cy={130} r={60} fill="url(#library-glow)" data-fx="glow" />
          <path d="M556 124 Q600 146 644 124" stroke="var(--library-brass)" strokeWidth={3} fill="none" />
          <line x1={600} y1={110} x2={600} y2={136} stroke="var(--library-brass)" strokeWidth={3} />
          {[556, 578, 600, 622, 644].map((cx) => (
            <g key={cx}>
              <rect x={cx - 2} y={112 + Math.abs(cx - 600) / 4} width={4} height={10} fill="var(--library-paper)" />
              <circle cx={cx} cy={110 + Math.abs(cx - 600) / 4} r={3} fill="var(--library-fire-core)" data-fx="flicker" />
            </g>
          ))}
        </g>,
      )}
      {stage(
        "stair",
        <g>
          <rect x={1112} y={GALLERY_Y} width={8} height={FLOOR_Y - GALLERY_Y + 20} fill="var(--library-brass)" />
          {Array.from({ length: 11 }, (_, i) => {
            const y = FLOOR_Y + 8 - i * 22;
            const left = i % 2 === 0;
            return <path key={i} d={left ? `M1116 ${y} L1074 ${y + 6} L1076 ${y + 11} L1116 ${y + 6} Z` : `M1116 ${y} L1160 ${y + 6} L1158 ${y + 11} L1116 ${y + 6} Z`} fill="var(--library-shelf)" />;
          })}
          <path d={`M1076 ${FLOOR_Y + 6} Q1180 ${FLOOR_Y - 60} 1074 ${FLOOR_Y - 120} T1076 ${GALLERY_Y + 10}`} stroke="var(--library-brass)" strokeWidth={2} fill="none" />
        </g>,
      )}

      {/* The floor: rug, table, chairs, and the life of the room. */}
      {stage("rug", <g><ellipse cx={600} cy={506} rx={240} ry={36} fill="var(--library-rug)" /><ellipse cx={600} cy={506} rx={212} ry={28} fill="none" stroke="var(--library-rug-2)" strokeWidth={4} /></g>)}
      {stage(
        "children",
        <g>
          <rect x={30} y={470} width={90} height={40} fill="var(--library-shelf)" />
          <Books x={30} w={90} y={490} seed={88} maxH={18} />
          <Books x={30} w={90} y={508} seed={89} maxH={16} />
          <ellipse cx={150} cy={528} rx={26} ry={14} fill="var(--library-book-3)" />
        </g>,
      )}
      {stage(
        "atlas",
        <g>
          <path d="M156 470 L170 520 M184 470 L170 520" stroke="var(--library-shelf-dark)" strokeWidth={3} />
          <path d="M140 470 L170 476 L200 470 L200 460 L170 466 L140 460 Z" fill="var(--library-map)" />
          <line x1={170} y1={466} x2={170} y2={476} stroke="var(--library-map-ink)" strokeWidth={1.2} />
        </g>,
      )}
      {stage(
        "ladder",
        <g stroke="var(--library-shelf-dark)" strokeWidth={3} strokeLinecap="round">
          <line x1={196} y1={236} x2={226} y2={FLOOR_Y + 30} />
          <line x1={220} y1={236} x2={250} y2={FLOOR_Y + 30} />
          {Array.from({ length: 10 }, (_, i) => {
            const t = (i + 0.5) / 10;
            return <line key={i} x1={round(196 + 30 * t)} y1={round(236 + (FLOOR_Y + 30 - 236) * t)} x2={round(220 + 30 * t)} y2={round(236 + (FLOOR_Y + 30 - 236) * t)} strokeWidth={2} />;
          })}
        </g>,
      )}
      {stage(
        "lamp",
        <g>
          <circle cx={270} cy={378} r={58} fill="url(#library-glow)" data-fx="glow" />
          <line x1={270} y1={392} x2={270} y2={FLOOR_Y + 44} stroke="var(--library-brass)" strokeWidth={3} />
          <ellipse cx={270} cy={FLOOR_Y + 46} rx={14} ry={4} fill="var(--library-brass)" />
          <path d="M252 392 L288 392 L280 366 L260 366 Z" fill="var(--library-shade)" />
        </g>,
      )}
      {stage("chair", <Armchair x={330} />)}
      {stage(
        "tea",
        <g>
          <rect x={392} y={462} width={40} height={5} rx={2} fill="var(--library-shelf)" />
          <line x1={412} y1={467} x2={412} y2={FLOOR_Y + 44} stroke="var(--library-shelf-dark)" strokeWidth={4} />
          <path d="M404 462 L420 462 L418 450 L406 450 Z" fill="var(--library-cup)" />
          <path d="M420 453 q5 2 0 6" stroke="var(--library-cup)" strokeWidth={1.6} fill="none" />
          <path data-fx="steam" d="M410 446 q-4 -8 2 -14 q4 -6 0 -12" stroke="var(--library-steam)" strokeWidth={1.6} fill="none" />
        </g>,
      )}
      {stage(
        "stack",
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={250 + (i % 2) * 4} y={538 - i * 9} width={52 - i * 3} height={8} rx={1.5} fill={BOOK_COLOURS[i % 6]} />
          ))}
        </g>,
      )}
      {stage(
        "long-table",
        <g>
          <rect x={470} y={468} width={260} height={10} rx={2} fill="var(--library-shelf)" />
          {[482, 718].map((lx) => (
            <rect key={lx} x={lx - 4} y={478} width={8} height={44} fill="var(--library-shelf-dark)" />
          ))}
          <rect x={530} y={462} width={30} height={6} fill="var(--library-paper)" />
          <rect x={640} y={461} width={36} height={7} fill="var(--library-book-4)" />
        </g>,
      )}
      {stage(
        "table-lamps",
        <g>
          <GreenLamp x={510} y={468} />
          <GreenLamp x={700} y={468} />
        </g>,
      )}
      {stage(
        "readers",
        <g>
          <path d="M594 468 L612 468 L610 440 C610 432 596 432 596 440 Z" fill="var(--library-cloth)" />
          <circle cx={603} cy={426} r={7} fill="var(--library-skin)" />
          <path d="M588 462 L606 456 L622 462" stroke="var(--library-paper)" strokeWidth={3} fill="none" />
        </g>,
      )}
      {stage(
        "cat",
        <g transform="translate(560 520)" fill="var(--library-cat)">
          <ellipse cx={0} cy={-6} rx={14} ry={7} />
          <circle cx={11} cy={-11} r={5.5} />
          <path d="M8 -15 l2 -5 l2 4 Z M13 -15 l2 -4 l1 5 Z" />
          <path d="M-14 -4 q-10 4 -4 10" stroke="var(--library-cat)" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </g>,
      )}
      {stage(
        "telescope",
        <g>
          <path d="M650 520 L664 470 M678 520 L664 470 M664 520 L664 470" stroke="var(--library-shelf-dark)" strokeWidth={2.4} />
          <rect x={650} y={452} width={46} height={10} rx={4} fill="var(--library-brass)" transform="rotate(-24 664 466)" />
        </g>,
      )}
      {stage(
        "globe",
        <g>
          <line x1={770} y1={480} x2={770} y2={FLOOR_Y + 44} stroke="var(--library-shelf-dark)" strokeWidth={3} />
          <ellipse cx={770} cy={FLOOR_Y + 46} rx={14} ry={4} fill="var(--library-shelf-dark)" />
          <circle cx={770} cy={462} r={18} fill="var(--library-globe-sea)" />
          <path d="M760 452 q8 -2 10 6 q-4 6 -10 2 Z M772 466 q6 -4 10 2 q-2 8 -8 6 Z" fill="var(--library-globe-land)" />
          <path d="M752 462 A18 18 0 0 0 788 462" stroke="var(--library-brass)" strokeWidth={2} fill="none" />
        </g>,
      )}
      {stage(
        "desk",
        <g>
          <rect x={820} y={456} width={130} height={10} rx={2} fill="var(--library-shelf)" />
          <rect x={826} y={466} width={34} height={44} fill="var(--library-shelf-dark)" />
          <rect x={940} y={466} width={6} height={44} fill="var(--library-shelf-dark)" />
          <rect x={832} y={476} width={22} height={4} fill="var(--library-brass)" />
        </g>,
      )}
      {stage(
        "ink",
        <g>
          <rect x={872} y={446} width={10} height={10} rx={2} fill="var(--library-ink)" />
          <path d="M886 454 L904 432" stroke="var(--library-paper)" strokeWidth={2} />
          <rect x={890} y={450} width={34} height={6} fill="var(--library-paper)" />
        </g>,
      )}
      {stage("green-lamp", <GreenLamp x={934} y={456} />)}
      {stage(
        "manuscripts",
        <g>
          <rect x={960} y={500} width={90} height={8} fill="var(--library-shelf)" />
          <rect x={964} y={478} width={82} height={22} fill="var(--library-glass)" opacity={0.5} />
          <rect x={972} y={488} width={30} height={10} fill="var(--library-paper)" />
          <rect x={1008} y={488} width={30} height={10} fill="var(--library-map)" />
          <path d="M970 508 L970 540 M1040 508 L1040 540" stroke="var(--library-shelf-dark)" strokeWidth={4} />
        </g>,
      )}
      {stage("second-chair", <Armchair x={1080} colour="var(--library-rug)" />)}
      {stage(
        "palm",
        <g>
          <path d="M1142 548 L1176 548 L1172 520 L1146 520 Z" fill="var(--library-brass)" />
          {[-60, -30, 0, 30, 60].map((a) => (
            <path key={a} d={`M1159 520 q${a / 3} -40 ${a / 1.4} -56`} stroke="var(--library-leaf)" strokeWidth={5} fill="none" strokeLinecap="round" />
          ))}
        </g>,
      )}
      {stage("warm-light", <rect width="1200" height="560" fill="url(#library-warm)" pointerEvents="none" />)}
      {stage(
        "complete",
        <g>
          <Books x={20} w={170} y={220} seed={99} maxH={22} />
          <Books x={805} w={170} y={220} seed={98} maxH={22} />
          <Books x={208} w={180} y={220} seed={97} maxH={20} />
          <Books x={995} w={170} y={220} seed={96} maxH={20} />
        </g>,
      )}
    </SceneSvg>
  );
}
