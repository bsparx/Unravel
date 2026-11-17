/**
 * The two figures, as flat vector anatomy — front and back.
 *
 * Original stylised drawing, not traced from anyone else's artwork. The body
 * is a mannequin built symmetric about x=100 on a 200x460 grid: rounded,
 * tapered segments rather than rendered muscle, which suits a page made of
 * hairline borders and flat surfaces and stays legible at the ~120px each
 * figure actually gets on a phone.
 *
 * Three layers, drawn back to front:
 *   BODY_BASE — every segment of the body, the ground the rest sits on
 *   DETAIL    — head, hands, feet: never interactive, because no exercise
 *               in the catalog targets them (upper arms were promoted to the
 *               ARMS region, forearms and shins to FOREARMS and CALVES)
 *   REGIONS   — the muscle groups, one entry per `BodyPart` code
 *
 * A muscle that exists on both sides of the body is two paths under one
 * `part`, so the pair lights up together. `SHOULDERS` deliberately appears on
 * both figures — front delts and rear delts are the same catalog code, and
 * clicking either selects it.
 *
 * `SPINE` is a back-only strip, and `FULL_BODY` has no region at all: it
 * isn't a place on the body, and drawing it would make the per-muscle counts
 * lie. The back figure is mirrored at render time, since seen from behind a
 * person's left is on your right.
 */

export const VIEW_BOX = "0 0 200 460";

export type MuscleRegion = {
  /** A `BodyPart` enum code from the schema. */
  part: string;
  d: string;
};

/** Every segment of the body, front and back alike. */
export const BODY_BASE: string[] = [
  "M100 20a21 24 0 1 0 0.1 0Z",
  "M94 62H106Q112 62 112 68L115 78Q115 84 109 84H91Q85 84 85 78L88 68Q88 62 94 62Z",
  "M78 80H122Q138 80 138 96L131 192Q131 208 115 208H85Q69 208 69 192L62 96Q62 80 78 80Z",
  "M85 200H115Q133 200 133 218L131 240Q131 258 113 258H87Q69 258 69 240L67 218Q67 200 85 200Z",
  "M75 250H83Q96 250 96 263L94 331Q94 344 81 344H81Q68 344 68 331L62 263Q62 250 75 250Z",
  "M125 250H117Q104 250 104 263L106 331Q106 344 119 344H119Q132 344 132 331L138 263Q138 250 125 250Z",
  "M77.5 336H84.5Q94 336 94 345.5L91 414.5Q91 424 81.5 424H81.5Q72 424 72 414.5L68 345.5Q68 336 77.5 336Z",
  "M122.5 336H115.5Q106 336 106 345.5L109 414.5Q109 424 118.5 424H118.5Q128 424 128 414.5L132 345.5Q132 336 122.5 336Z",
  "M78 418H85Q93 418 93 426L95 434Q95 442 87 442H74Q66 442 66 434L70 426Q70 418 78 418Z",
  "M122 418H115Q107 418 107 426L105 434Q105 442 113 442H126Q134 442 134 434L130 426Q130 418 122 418Z",
  "M49 92H51Q62 92 62 103L57 185Q57 196 46 196H44Q33 196 33 185L38 103Q38 92 49 92Z",
  "M151 92H149Q138 92 138 103L143 185Q143 196 154 196H156Q167 196 167 185L162 103Q162 92 151 92Z",
  "M43 190H45Q55 190 55 200L50 264Q50 274 40 274H39Q29 274 29 264L33 200Q33 190 43 190Z",
  "M157 190H155Q145 190 145 200L150 264Q150 274 160 274H161Q171 274 171 264L167 200Q167 190 157 190Z",
  "M38.5 268H41.5Q50 268 50 276.5L49 297.5Q49 306 40.5 306H40.5Q32 306 32 297.5L30 276.5Q30 268 38.5 268Z",
  "M161.5 268H158.5Q150 268 150 276.5L151 297.5Q151 306 159.5 306H159.5Q168 306 168 297.5L170 276.5Q170 268 161.5 268Z",
];

/** Head, hands and feet — nothing in the catalog targets these. */
export const BODY_DETAIL: string[] = [
  "M100 20a21 24 0 1 0 0.1 0Z",
  "M38.5 268H41.5Q50 268 50 276.5L49 297.5Q49 306 40.5 306H40.5Q32 306 32 297.5L30 276.5Q30 268 38.5 268Z",
  "M161.5 268H158.5Q150 268 150 276.5L151 297.5Q151 306 159.5 306H159.5Q168 306 168 297.5L170 276.5Q170 268 161.5 268Z",
  "M78 418H85Q93 418 93 426L95 434Q95 442 87 442H74Q66 442 66 434L70 426Q70 418 78 418Z",
  "M122 418H115Q107 418 107 426L105 434Q105 442 113 442H126Q134 442 134 434L130 426Q130 418 122 418Z",
];

export const FRONT_REGIONS: MuscleRegion[] = [
  { part: "SHOULDERS", d: "M62 84H64Q76 84 76 96L74 110Q74 122 62 122H60Q48 122 48 110L50 96Q50 84 62 84Z" },
  { part: "SHOULDERS", d: "M138 84H136Q124 84 124 96L126 110Q126 122 138 122H140Q152 122 152 110L150 96Q150 84 138 84Z" },
  { part: "CHEST", d: "M78 96H85Q97 96 97 108L97 136Q97 148 85 148H76Q64 148 64 136L66 108Q66 96 78 96Z" },
  { part: "CHEST", d: "M122 96H115Q103 96 103 108L103 136Q103 148 115 148H124Q136 148 136 136L134 108Q134 96 122 96Z" },
  { part: "CORE", d: "M87 150H113Q127 150 127 164L124 196Q124 210 110 210H90Q76 210 76 196L73 164Q73 150 87 150Z" },
  { part: "HIP_FLEXORS", d: "M82.5 206H86.5Q97 206 97 216.5L97 239.5Q97 250 86.5 250H86.5Q76 250 76 239.5L72 216.5Q72 206 82.5 206Z" },
  { part: "HIP_FLEXORS", d: "M117.5 206H113.5Q103 206 103 216.5L103 239.5Q103 250 113.5 250H113.5Q124 250 124 239.5L128 216.5Q128 206 117.5 206Z" },
  { part: "QUADS", d: "M76 252H84Q96 252 96 264L94 322Q94 334 82 334H82Q70 334 70 322L64 264Q64 252 76 252Z" },
  { part: "QUADS", d: "M124 252H116Q104 252 104 264L106 322Q106 334 118 334H118Q130 334 130 322L136 264Q136 252 124 252Z" },
  { part: "ARMS", d: "M49 92H51Q62 92 62 103L57 185Q57 196 46 196H44Q33 196 33 185L38 103Q38 92 49 92Z" },
  { part: "ARMS", d: "M151 92H149Q138 92 138 103L143 185Q143 196 154 196H156Q167 196 167 185L162 103Q162 92 151 92Z" },
  { part: "ADDUCTORS", d: "M86 248H100Q108 248 108 258L104 322Q104 330 96 330H86Q78 330 78 322L72 258Q72 248 86 248Z" },
  { part: "ADDUCTORS", d: "M114 248H100Q92 248 92 258L96 322Q96 330 104 330H114Q122 330 122 322L128 258Q128 248 114 248Z" },
  { part: "ANKLES", d: "M77 398H84Q92 398 92 406L90 426Q90 434 82 434H76Q68 434 68 426L66 406Q66 398 77 398Z" },
  { part: "ANKLES", d: "M123 398H116Q108 398 108 406L110 426Q110 434 118 434H124Q132 434 132 426L134 406Q134 398 123 398Z" },
  { part: "FOREARMS", d: "M43 190H45Q55 190 55 200L50 264Q50 274 40 274H39Q29 274 29 264L33 200Q33 190 43 190Z" },
  { part: "FOREARMS", d: "M157 190H155Q145 190 145 200L150 264Q150 274 160 274H161Q171 274 171 264L167 200Q167 190 157 190Z" },
];

export const BACK_REGIONS: MuscleRegion[] = [
  { part: "SHOULDERS", d: "M62 84H64Q76 84 76 96L74 110Q74 122 62 122H60Q48 122 48 110L50 96Q50 84 62 84Z" },
  { part: "SHOULDERS", d: "M138 84H136Q124 84 124 96L126 110Q126 122 138 122H140Q152 122 152 110L150 96Q150 84 138 84Z" },
  { part: "UPPER_BACK", d: "M77 88H81Q94 88 94 101L94 151Q94 164 81 164H75Q62 164 62 151L64 101Q64 88 77 88Z" },
  { part: "UPPER_BACK", d: "M123 88H119Q106 88 106 101L106 151Q106 164 119 164H125Q138 164 138 151L136 101Q136 88 123 88Z" },
  { part: "SPINE", d: "M98.5 88H101.5Q106.5 88 106.5 93L105.5 203Q105.5 208 100.5 208H99.5Q94.5 208 94.5 203L93.5 93Q93.5 88 98.5 88Z" },
  { part: "LOWER_BACK", d: "M84 158H116Q130 158 130 172L126 194Q126 208 112 208H88Q74 208 74 194L70 172Q70 158 84 158Z" },
  { part: "GLUTES", d: "M80 204H83Q97 204 97 218L96 248Q96 262 82 262H82Q68 262 68 248L66 218Q66 204 80 204Z" },
  { part: "GLUTES", d: "M120 204H117Q103 204 103 218L104 248Q104 262 118 262H118Q132 262 132 248L134 218Q134 204 120 204Z" },
  { part: "HAMSTRINGS", d: "M78 260H84Q96 260 96 272L94 322Q94 334 82 334H82Q70 334 70 322L66 272Q66 260 78 260Z" },
  { part: "HAMSTRINGS", d: "M122 260H116Q104 260 104 272L106 322Q106 334 118 334H118Q130 334 130 322L134 272Q134 260 122 260Z" },
  { part: "NECK", d: "M94 62H106Q112 62 112 68L115 78Q115 84 109 84H91Q85 84 85 78L88 68Q88 62 94 62Z" },
  { part: "CALVES", d: "M77.5 336H84.5Q94 336 94 345.5L91 414.5Q91 424 81.5 424H81.5Q72 424 72 414.5L68 345.5Q68 336 77.5 336Z" },
  { part: "CALVES", d: "M122.5 336H115.5Q106 336 106 345.5L109 414.5Q109 424 118.5 424H118.5Q128 424 128 414.5L132 345.5Q132 336 122.5 336Z" },
];

/** Every part the figures can show, for count-building and tests. */
export const MAPPED_PARTS: string[] = [
  ...new Set([...FRONT_REGIONS, ...BACK_REGIONS].map((region) => region.part)),
];

/** Where a leader line touches its muscle, in un-mirrored user units. */
export type RegionAnchor = { x: number; y: number };

/*
 * The anatomy plate in the exercise dialog runs a hairline from each lit
 * muscle out to its name in the margin, and these are the points it starts
 * from. Front names sit in the left margin and back names in the right, so
 * the anchors hug the outer edge of their side.
 *
 * They are given un-mirrored, and the plate draws them outside the back
 * figure's `scale(-1,1)` group — inside it a dot would land on the other
 * side of the body and every label would render backwards. That works only
 * because each muscle's box is symmetric about x=100, so one set of
 * coordinates lands on the muscle either way; verify-logic.ts asserts the
 * symmetry so the day someone draws an asymmetric region, it says so.
 *
 * The y values are spread rather than centred, so the plate's collision
 * pass mostly has nothing to do; when a tight pair does touch, the pass
 * resolves it exactly as designed.
 */
export const FRONT_ANCHORS: Record<string, RegionAnchor> = {
  SHOULDERS: { x: 52, y: 106 },
  CHEST: { x: 68, y: 138 },
  CORE: { x: 77, y: 174 },
  ARMS: { x: 44, y: 150 },
  HIP_FLEXORS: { x: 76, y: 224 },
  QUADS: { x: 68, y: 280 },
  ADDUCTORS: { x: 86, y: 300 },
  ANKLES: { x: 80, y: 416 },
  FOREARMS: { x: 42, y: 232 },
};

// SPINE's anchor sits high on purpose: LOWER_BACK paints over the strip
// below y=158, so the visible spine is only its top half.
export const BACK_ANCHORS: Record<string, RegionAnchor> = {
  SHOULDERS: { x: 145, y: 98 },
  SPINE: { x: 103, y: 128 },
  UPPER_BACK: { x: 134, y: 158 },
  LOWER_BACK: { x: 124, y: 190 },
  GLUTES: { x: 130, y: 232 },
  HAMSTRINGS: { x: 130, y: 292 },
  NECK: { x: 104, y: 72 },
  CALVES: { x: 119, y: 380 },
};
