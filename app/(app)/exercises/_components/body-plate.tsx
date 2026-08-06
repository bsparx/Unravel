import { bodyPartLabel } from "@/lib/exercise-labels";

import {
  BACK_ANCHORS,
  BACK_REGIONS,
  BODY_BASE,
  BODY_DETAIL,
  FRONT_ANCHORS,
  FRONT_REGIONS,
  VIEW_BOX,
  type RegionAnchor,
} from "./body-map-paths";

/**
 * One figure of the anatomy plate — the read-only twin of `BodyMap`.
 *
 * The explorer's figure is a control: it has counts, a selection, hover
 * states and a focus ring, because you point at it to ask a question. The
 * plate answers one instead — this exercise works these muscles — so it is
 * a drawing, not a set of buttons. Sharing the geometry and nothing else is
 * deliberate: the previous attempt reused the control here and had to invent
 * a count of 1 for every muscle to stop it behaving like one, which left a
 * dozen focusable regions in the dialog announcing a number that wasn't true.
 *
 * Annotated, it runs a hairline from each lit muscle out to its name in the
 * margin, front figure leftward and back figure rightward, so the pair reads
 * outward-symmetric. Unannotated, it is just the figure — the caller names
 * the muscles some other way. The caller drops the annotations when the
 * plate gets too narrow to set type in, because SVG text at 10px is not a
 * label, it's a texture.
 */

/** User units. The figure is a fixed 200 wide, so bigger type here buys
    more rendered pixels at the cost of the figure's share of the box. */
const LABEL_FONT_SIZE = 26;
/** 1.25x the type size: enough white between two names to read as a list. */
const MIN_LABEL_GAP = 32;
const LABEL_MIN_Y = 26;
const LABEL_MAX_Y = 440;

const PLATE_VIEW_BOX = {
  front: "-190 0 400 460",
  back: "-10 0 400 460",
} as const;

type Placed = { part: string; anchor: RegionAnchor; labelY: number };

/**
 * Where each name sits vertically.
 *
 * Leaders want to be near-horizontal, so a name starts level with its own
 * muscle and only moves when it would land on the one above it. Sorting by
 * anchor is what keeps the lines from crossing each other: two leaders cross
 * exactly when their label order inverts their anchor order.
 *
 * Six names need 160 of the 460 units available, so the backward sweep is a
 * guard that keeps the function total rather than a working part.
 */
function placeLabels(entries: { part: string; anchor: RegionAnchor }[]): Placed[] {
  const sorted = [...entries].sort((a, b) => a.anchor.y - b.anchor.y);
  const ys = sorted.map((entry) => entry.anchor.y);

  for (let i = 1; i < ys.length; i++) {
    ys[i] = Math.max(ys[i], ys[i - 1] + MIN_LABEL_GAP);
  }
  for (let i = ys.length - 1; i >= 0; i--) {
    const ceiling = i === ys.length - 1 ? LABEL_MAX_Y : ys[i + 1] - MIN_LABEL_GAP;
    ys[i] = Math.min(ys[i], ceiling);
  }
  if (ys.length > 0) ys[0] = Math.max(ys[0], LABEL_MIN_Y);
  for (let i = 1; i < ys.length; i++) {
    ys[i] = Math.max(ys[i], ys[i - 1] + MIN_LABEL_GAP);
  }

  return sorted.map((entry, i) => ({ ...entry, labelY: ys[i] }));
}

export function BodyPlate({
  side,
  lit,
  annotated,
}: {
  side: "front" | "back";
  /** The `BodyPart` codes this exercise works. */
  lit: string[];
  /** Draw the leader lines and names, or just the figure. */
  annotated: boolean;
}) {
  const front = side === "front";
  const regions = front ? FRONT_REGIONS : BACK_REGIONS;
  const anchors = front ? FRONT_ANCHORS : BACK_ANCHORS;

  const worked = new Set(lit);
  const litPaths = regions.filter((region) => worked.has(region.part));
  const unlitPaths = regions.filter((region) => !worked.has(region.part));

  // A muscle only gets a name on the figure that draws it. The deltoids are
  // the exception the catalog builds in: one code, both figures, named twice
  // — which is honest, since that is one muscle seen from two sides.
  const placed = annotated
    ? placeLabels(
        [...new Set(litPaths.map((region) => region.part))]
          .filter((part) => anchors[part] !== undefined)
          .map((part) => ({ part, anchor: anchors[part] })),
      )
    : [];

  // Where the leader levels off, where it stops, and where the name starts.
  const kneeX = front ? -18 : 218;
  const endX = front ? -32 : 232;
  const textX = front ? -38 : 238;
  const leaderPath = ({ anchor, labelY }: Placed) =>
    `M${anchor.x} ${anchor.y}L${kneeX} ${labelY}L${endX} ${labelY}`;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* overflow-visible, and nothing clips this: both figures set their
          names away from the pair — front to the left, back to the right —
          so a name wider than its margin spills into the dialog's own
          gutter instead of colliding with the other figure. */}
      <svg
        viewBox={annotated ? PLATE_VIEW_BOX[side] : VIEW_BOX}
        aria-hidden
        className={
          annotated
            ? "h-auto w-full overflow-visible"
            : "h-auto w-full max-w-[7rem] overflow-visible"
        }
      >
        {/* Seen from behind, the person's left is on your right. */}
        <g transform={front ? undefined : "translate(200,0) scale(-1,1)"}>
          <g className="fill-secondary">
            {BODY_BASE.map((d, index) => (
              <path key={index} d={d} />
            ))}
          </g>

          <g className="fill-secondary stroke-muted-foreground/25 [stroke-width:1]">
            {BODY_DETAIL.map((d, index) => (
              <path key={index} d={d} />
            ))}
          </g>

          {/* Two states, not the explorer's four. A wash there means "you're
              pointing at this"; here there is nothing to point at, so a
              worked muscle is solid and the rest are outlines. */}
          <g className="fill-none stroke-muted-foreground/20 [stroke-width:0.75]">
            {unlitPaths.map((region, index) => (
              <path key={index} d={region.d} />
            ))}
          </g>

          <g className="fill-primary">
            {litPaths.map((region, index) => (
              <path key={index} d={region.d} />
            ))}
          </g>
        </g>

        {/* Outside the mirror on purpose: inside it a dot would land on the
            other side of the body and every name would render backwards. */}
        {placed.length > 0 && (
          <g>
            {/* Every leader twice — a gutter in the card's own colour, then
                the line. Some crossings can't be routed away: the spine sits
                dead centre with the upper back on both sides of it, and the
                front deltoids sit inboard of the arms. Knocking a gap
                through whatever a line passes over is what makes an
                engraved plate readable, and it retires the whole problem. */}
            <g
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-card [stroke-width:3]"
            >
              {placed.map((entry) => (
                <path key={entry.part} d={leaderPath(entry)} />
              ))}
            </g>
            <g
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-primary/70 [stroke-width:1]"
            >
              {placed.map((entry) => (
                <path key={entry.part} d={leaderPath(entry)} />
              ))}
            </g>

            {placed.map(({ part, anchor, labelY }) => (
              <g key={part}>
                {/* r=2: the tightest muscle leaves 2.5 units of clearance,
                    and a dot straddling the fill edge reads as a smudge. */}
                <circle cx={anchor.x} cy={anchor.y} r={2} className="fill-primary" />
                <text
                  x={textX}
                  y={labelY}
                  textAnchor={front ? "end" : "start"}
                  dominantBaseline="middle"
                  fontSize={LABEL_FONT_SIZE}
                  className="fill-foreground font-sans"
                >
                  {bodyPartLabel(part)}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>

      <span className="text-micro text-muted-foreground tracking-wider uppercase">
        {front ? "Front" : "Back"}
      </span>
    </div>
  );
}
