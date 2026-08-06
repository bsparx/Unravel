"use client";

import { useMediaQuery } from "@/hooks/use-mobile";
import { bodyPartLabel } from "@/lib/exercise-labels";

import { BodyPlate } from "./body-plate";
import { MAPPED_PARTS } from "./body-map-paths";

/**
 * The dialog's picture of what an exercise targets: the page's own two
 * figures, front and back, with the worked muscles filled solid and named
 * in the margin by a hairline leader.
 *
 * The page is built on the idea that the body is the navigation, so the
 * dialog answers with the same drawing rather than a second, unrelated one.
 */

/** An exercise that names this works the whole body, not one place on it. */
const FULL_BODY = "FULL_BODY";

/**
 * Below this the plate is too narrow to set type in. Names need ~12px to
 * read, which needs a ~185px column; under the `sm` breakpoint the dialog
 * is the viewport less 64px, so that lands at about 446px of viewport.
 */
const ANNOTATED_FROM = "(min-width: 28rem)";

export function ExerciseFigure({
  name,
  parts,
}: {
  name: string;
  parts: string[];
}) {
  // Below 28rem this swaps the names for a chip row. Radix keeps the dialog
  // unmounted until it opens, so the plate never renders on the server and
  // there is no hydration flash to design around.
  const wide = useMediaQuery(ANNOTATED_FROM);

  if (parts.length === 0) return null;

  // What gets filled and what gets said are different questions. FULL_BODY
  // lights every region, because it names the whole body — but the exercise
  // is still called by the two or three parts it lists, not by a recital of
  // every muscle in the catalog.
  const whole = parts.includes(FULL_BODY);
  const lit = whole ? MAPPED_PARTS : parts;
  const named = parts;

  // A whole-body exercise would need ten leaders across two figures, which
  // is a hairball; and with no leaders the margin is dead space that shrinks
  // the figures for nothing. It takes the plain route and the chip row.
  const annotated = wide && !whole;

  return (
    <div className="border-border bg-card overflow-visible rounded-lg border px-3 py-4">
      <div
        role="img"
        aria-label={`${name} targets ${named.map(bodyPartLabel).join(", ")}`}
        className="grid grid-cols-2 items-end gap-3"
      >
        <BodyPlate side="front" lit={lit} annotated={annotated} />
        <BodyPlate side="back" lit={lit} annotated={annotated} />
      </div>

      {/* The names the plate isn't carrying. aria-hidden because the figure
          above already says them, and once is enough. */}
      {!annotated && (
        <ul
          aria-hidden
          className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1"
        >
          {named.map((part) => (
            <li
              key={part}
              className="text-muted-foreground text-label flex items-center gap-1.5"
            >
              <span className="bg-primary size-1.5 rounded-full" />
              {bodyPartLabel(part)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
