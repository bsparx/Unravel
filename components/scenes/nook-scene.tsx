import { SCENES } from "@/lib/scenes";

import { SceneSvg, onCurve, scatter, stager, type SceneProps } from "./scene-frame";

const SCENE = SCENES.reading;

const OUT_STARS = scatter(9, 14, { x: [372, 568], y: [124, 250] });

// Books: [x, width, height, colour, lean in degrees].
type Book = [number, number, number, string, number];
const FIRST_BOOKS: Book[] = [
  [778, 16, 58, "var(--nook-book-1)", 0],
  [795, 12, 50, "var(--nook-book-2)", 0],
  [808, 18, 62, "var(--nook-book-3)", 0],
  [827, 14, 54, "var(--nook-book-4)", 0],
  [842, 16, 60, "var(--nook-book-5)", 0],
];
const MORE_BOOKS: Book[] = [
  [870, 14, 56, "var(--nook-book-3)", 0],
  [885, 18, 62, "var(--nook-book-1)", 0],
  [904, 12, 48, "var(--nook-book-5)", 0],
  [917, 16, 58, "var(--nook-book-2)", 0],
  [944, 15, 56, "var(--nook-book-4)", 18],
];
const SECOND_SHELF: Book[] = [
  [776, 14, 56, "var(--nook-book-2)", 0],
  [791, 18, 60, "var(--nook-book-4)", 0],
  [810, 12, 52, "var(--nook-book-1)", 0],
  [823, 16, 58, "var(--nook-book-5)", 0],
  [840, 14, 50, "var(--nook-book-3)", 0],
  [855, 20, 62, "var(--nook-book-2)", 0],
  [876, 12, 54, "var(--nook-book-1)", 0],
  [889, 16, 60, "var(--nook-book-4)", 0],
  [906, 14, 52, "var(--nook-book-5)", 0],
  [921, 18, 58, "var(--nook-book-3)", 0],
  [940, 12, 50, "var(--nook-book-2)", 0],
  [953, 16, 60, "var(--nook-book-1)", 0],
  [970, 14, 56, "var(--nook-book-4)", 0],
  [985, 18, 62, "var(--nook-book-5)", 0],
  [1004, 14, 54, "var(--nook-book-3)", 0],
];

function Books({ books, shelf }: { books: Book[]; shelf: number }) {
  return (
    <>
      {books.map(([x, w, h, colour, lean]) => (
        <g key={x} transform={lean ? `rotate(${lean} ${x} ${shelf})` : undefined}>
          <rect x={x} y={shelf - h} width={w} height={h} rx={1.5} fill={colour} />
          <rect x={x + 2} y={shelf - h + 8} width={w - 4} height={2} fill="var(--nook-gilt)" opacity={0.7} />
          <rect x={x + 2} y={shelf - 12} width={w - 4} height={2} fill="var(--nook-gilt)" opacity={0.5} />
        </g>
      ))}
    </>
  );
}

// The string of lights, in two sagging spans.
const LIGHT_SPANS = [
  { from: [110, 72], via: [330, 128], to: [600, 70] },
  { from: [600, 70], via: [850, 126], to: [1090, 72] },
] as const;

/**
 * The reading nook. A quiet room in the evening, a window and an empty shelf,
 * and fourteen things that make it a place to read: a lamp, books, a chair,
 * tea, a plant, a cat, the moon at the window, and at last the fire, one for
 * each day of the last two weeks you read.
 */
export function NookScene({ level, fresh = [], className, label = true }: SceneProps) {
  const { has, stage } = stager(SCENE, level, fresh);
  const lit = has("lamp");
  const fire = has("fire");

  return (
    <SceneSvg
      scene={SCENE}
      level={level}
      label={label}
      className={className}
      defs={
        <>
          <linearGradient id="nook-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--nook-wall-1)" />
            <stop offset="100%" stopColor="var(--nook-wall-2)" />
          </linearGradient>
          <linearGradient id="nook-out" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--nook-out-1)" />
            <stop offset="100%" stopColor="var(--nook-out-2)" />
          </linearGradient>
          <radialGradient id="nook-glow">
            <stop offset="0%" stopColor="var(--nook-light)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--nook-light)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nook-fire-glow">
            <stop offset="0%" stopColor="var(--nook-fire)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--nook-fire)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nook-moon-halo">
            <stop offset="0%" stopColor="var(--nook-moon)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--nook-moon)" stopOpacity="0" />
          </radialGradient>
          <clipPath id="nook-window">
            <rect x={366} y={116} width={208} height={230} rx={4} />
          </clipPath>
          <radialGradient id="nook-vignette" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="var(--nook-dark)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--nook-dark)" stopOpacity="0.5" />
          </radialGradient>
        </>
      }
    >
      {/* The room. */}
      <g>
        <title>{SCENE.base}</title>
        <rect width="1200" height="560" fill="url(#nook-wall)" />
        <rect x={0} y={388} width={1200} height={84} fill="var(--nook-panel)" />
        <rect x={0} y={384} width={1200} height={6} fill="var(--nook-trim)" />
        {[60, 240, 420, 600, 780, 960, 1140].map((x) => (
          <rect key={x} x={x - 70} y={402} width={140} height={56} rx={3} fill="none" stroke="var(--nook-trim)" strokeWidth={2} opacity={0.5} />
        ))}

        {/* The window and what's outside it. */}
        <rect x={354} y={104} width={232} height={254} rx={8} fill="var(--nook-trim)" />
        <g clipPath="url(#nook-window)">
          <rect x={366} y={116} width={208} height={230} fill="url(#nook-out)" />
          {OUT_STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={0.6 + s.r} fill="var(--nook-star)" opacity={0.6} data-fx="twinkle" style={{ animationDelay: `${s.r * 4}s` }} />
          ))}
          {stage(
            "moon",
            <>
              <circle cx={520} cy={168} r={80} fill="url(#nook-moon-halo)" />
              <circle cx={520} cy={168} r={22} fill="var(--nook-moon)" />
              <circle cx={512} cy={162} r={4} fill="var(--nook-moon-shade)" opacity={0.4} />
            </>,
          )}
          <path d="M366 300 C420 286 470 296 520 290 S560 284 574 290 L574 346 L366 346 Z" fill="var(--nook-out-hill)" />
          {[392, 430, 470, 520, 552].map((x, i) => (
            <path key={x} d={`M${x} ${300 - (i % 2) * 6} l7 -24 l7 24 z`} fill="var(--nook-out-tree)" />
          ))}
        </g>
        <rect x={466} y={116} width={8} height={230} fill="var(--nook-trim)" />
        <rect x={366} y={226} width={208} height={8} fill="var(--nook-trim)" />
        <rect x={340} y={352} width={260} height={12} rx={2} fill="var(--nook-trim)" />
        <path d="M356 108 C340 180 356 280 346 352 L366 352 L366 116 Z" fill="var(--nook-curtain)" opacity={0.9} />
        <path d="M584 108 C600 180 584 280 594 352 L574 352 L574 116 Z" fill="var(--nook-curtain)" opacity={0.9} />

        {/* The fireplace, cold until the end. */}
        <rect x={112} y={292} width={196} height={180} fill="var(--nook-stone)" />
        <rect x={100} y={282} width={220} height={14} rx={2} fill="var(--nook-trim)" />
        <path d="M150 472 L150 380 Q210 340 270 380 L270 472 Z" fill="var(--nook-hearth)" />
        <rect x={140} y={466} width={140} height={8} fill="var(--nook-trim)" opacity={0.8} />

        {/* The empty shelf. */}
        <rect x={764} y={220} width={300} height={10} rx={2} fill="var(--nook-shelf)" />
        <path d="M784 230 l0 18 l14 -18 z M1040 230 l0 18 l-14 -18 z" fill="var(--nook-shelf)" />
      </g>

      {stage(
        "lights",
        LIGHT_SPANS.map((span, s) => (
          <g key={s}>
            <path
              d={`M${span.from[0]} ${span.from[1]} Q${span.via[0]} ${span.via[1]} ${span.to[0]} ${span.to[1]}`}
              stroke="var(--nook-wire)"
              strokeWidth={1.4}
              fill="none"
            />
            {[0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.94].map((t, i) => {
              const [x, y] = onCurve(span.from, span.via, span.to, t);
              return (
                <g key={t} data-fx="twinkle" style={{ animationDelay: `${(i + s * 3) * 0.6}s` }}>
                  <circle cx={x} cy={y + 6} r={10} fill="url(#nook-glow)" />
                  <ellipse cx={x} cy={y + 6} rx={3} ry={4.5} fill="var(--nook-light)" />
                </g>
              );
            })}
          </g>
        )),
      )}
      {stage(
        "print",
        <>
          <rect x={164} y={160} width={92} height={110} rx={3} fill="var(--nook-shelf)" />
          <rect x={172} y={168} width={76} height={94} fill="var(--nook-paper)" />
          <path d="M178 244 C196 220 210 236 222 214 S240 220 244 230 L244 256 L178 256 Z" fill="var(--nook-book-2)" opacity={0.75} />
          <circle cx={226} cy={192} r={9} fill="var(--nook-book-1)" opacity={0.75} />
        </>,
      )}
      {stage("books", <Books books={FIRST_BOOKS} shelf={220} />)}
      {stage("more-books", <Books books={MORE_BOOKS} shelf={220} />)}
      {stage(
        "shelf",
        <>
          <rect x={764} y={318} width={300} height={10} rx={2} fill="var(--nook-shelf)" />
          <path d="M784 328 l0 18 l14 -18 z M1040 328 l0 18 l-14 -18 z" fill="var(--nook-shelf)" />
          <Books books={SECOND_SHELF} shelf={318} />
        </>,
      )}
      {stage(
        "plant",
        <>
          <path d="M392 352 L396 326 L432 326 L436 352 Z" fill="var(--nook-pot)" />
          {[
            [414, 326, -40, -38],
            [414, 326, -12, -52],
            [414, 326, 16, -46],
            [414, 326, 36, -30],
            [414, 326, -30, -18],
          ].map(([x, y, dx, dy], i) => (
            <path
              key={i}
              d={`M${x} ${y} Q${x + dx * 0.3} ${y + dy * 0.8} ${x + dx} ${y + dy} Q${x + dx * 0.7} ${y + dy * 0.3} ${x} ${y}`}
              fill="var(--nook-leaf)"
            />
          ))}
        </>,
      )}

      {/* The floor. */}
      <rect x={0} y={472} width={1200} height={88} fill="var(--nook-floor)" />
      <g stroke="var(--nook-floor-line)" strokeWidth={1.2}>
        {[494, 520, 550].map((y) => (
          <line key={y} x1={0} y1={y} x2={1200} y2={y} />
        ))}
        {[80, 260, 470, 640, 830, 1010].map((x, i) => (
          <line key={x} x1={x + (i % 2) * 60} y1={472 + (i % 3) * 22} x2={x + (i % 2) * 60} y2={494 + (i % 3) * 26} />
        ))}
      </g>

      {fire && (
        <>
          <ellipse cx={210} cy={460} rx={320} ry={130} fill="url(#nook-fire-glow)" data-fx="glow" />
        </>
      )}
      {stage(
        "fire",
        <>
          <rect x={172} y={452} width={76} height={10} rx={4} fill="var(--nook-log)" />
          <rect x={180} y={444} width={60} height={9} rx={4} fill="var(--nook-log)" transform="rotate(-8 210 448)" />
          <path data-fx="flicker" d="M182 452 C176 426 196 416 194 392 C206 410 214 404 212 384 C228 404 238 420 236 452 Z" fill="var(--nook-fire)" />
          <path data-fx="flicker" d="M196 452 C194 434 206 428 206 410 C216 424 224 432 222 452 Z" fill="var(--nook-fire-core)" style={{ animationDelay: "-0.6s" }} />
        </>,
      )}

      {stage(
        "rug",
        <>
          <ellipse cx={600} cy={528} rx={250} ry={28} fill="var(--nook-rug)" />
          <ellipse cx={600} cy={528} rx={222} ry={21} fill="none" stroke="var(--nook-rug-2)" strokeWidth={3} />
          <ellipse cx={600} cy={528} rx={150} ry={12} fill="none" stroke="var(--nook-rug-2)" strokeWidth={2} opacity={0.6} />
        </>,
      )}
      {stage(
        "cat",
        <>
          <ellipse cx={500} cy={522} rx={34} ry={12} fill="var(--nook-cat)" />
          <circle cx={472} cy={514} r={10} fill="var(--nook-cat)" />
          <path d="M464 508 l2 -9 l6 6 z M474 506 l5 -7 l2 9 z" fill="var(--nook-cat)" />
          <path d="M532 524 C548 530 540 540 522 534" stroke="var(--nook-cat)" strokeWidth={6} fill="none" strokeLinecap="round" />
        </>,
        { "data-fx": "breathe" },
      )}
      {stage(
        "armchair",
        <>
          <ellipse cx={730} cy={510} rx={100} ry={9} fill="var(--nook-dark)" opacity={0.25} />
          <path d="M660 470 L660 380 Q660 352 690 350 L770 350 Q800 352 800 380 L800 470 Z" fill="var(--nook-chair)" />
          <rect x={644} y={420} width={36} height={78} rx={16} fill="var(--nook-chair-lit)" />
          <rect x={780} y={420} width={36} height={78} rx={16} fill="var(--nook-chair-lit)" />
          <rect x={672} y={446} width={116} height={30} rx={10} fill="var(--nook-chair-lit)" />
          <rect x={656} y={492} width={8} height={18} rx={2} fill="var(--nook-shelf)" />
          <rect x={796} y={492} width={8} height={18} rx={2} fill="var(--nook-shelf)" />
          <path d="M690 380 Q730 372 770 380" stroke="var(--nook-chair-lit)" strokeWidth={3} fill="none" opacity={0.6} />
        </>,
      )}
      {stage(
        "stack",
        [
          [846, 500, 46, "var(--nook-book-2)"],
          [850, 488, 40, "var(--nook-book-5)"],
          [844, 476, 48, "var(--nook-book-1)"],
          [852, 465, 36, "var(--nook-book-3)"],
        ].map(([x, y, w, colour]) => (
          <rect key={y as number} x={x as number} y={y as number} width={w as number} height={11} rx={1.5} fill={colour as string} />
        )),
      )}
      {stage(
        "tea",
        <>
          <rect x={584} y={448} width={44} height={6} rx={2} fill="var(--nook-shelf)" />
          <rect x={603} y={454} width={6} height={52} fill="var(--nook-shelf)" />
          <rect x={592} y={504} width={30} height={5} rx={2} fill="var(--nook-shelf)" />
          <path d="M597 436 L615 436 L613 448 L599 448 Z" fill="var(--nook-cup)" />
          <path d="M615 439 q6 1 2 7" stroke="var(--nook-cup)" strokeWidth={1.6} fill="none" />
          <path data-fx="steam" d="M604 430 q-5 -9 0 -16 q5 -7 0 -14" stroke="var(--nook-steam)" strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <path data-fx="steam" d="M610 428 q-4 -8 0 -13 q4 -6 0 -11" stroke="var(--nook-steam)" strokeWidth={1.4} fill="none" strokeLinecap="round" style={{ animationDelay: "-1.2s" }} />
        </>,
      )}
      {stage(
        "lamp",
        <>
          <circle cx={900} cy={300} r={170} fill="url(#nook-glow)" data-fx="glow" />
          <path d="M870 300 L930 300 L1000 520 L800 520 Z" fill="var(--nook-light)" opacity={0.08} />
          <rect x={897} y={300} width={6} height={210} fill="var(--nook-lamp-pole)" />
          <ellipse cx={900} cy={512} rx={26} ry={6} fill="var(--nook-lamp-pole)" />
          <path d="M872 262 L928 262 L942 304 L858 304 Z" fill="var(--nook-shade)" />
          <path d="M872 262 L928 262 L942 304 L858 304 Z" fill="var(--nook-light)" opacity={0.35} />
        </>,
      )}

      {/* The room in the dark, until a lamp is lit. */}
      <rect width="1200" height="560" fill="var(--nook-dark)" style={{ opacity: lit ? 0 : 0.28 }} pointerEvents="none" />
      <rect width="1200" height="560" fill="url(#nook-vignette)" pointerEvents="none" />
    </SceneSvg>
  );
}
