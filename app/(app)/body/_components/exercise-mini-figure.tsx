"use client";

import { BodyPlate } from "./body-plate";
import { FRONT_REGIONS, MAPPED_PARTS } from "./body-map-paths";

/** An exercise that names this works the whole body, not one place on it. */
const FULL_BODY = "FULL_BODY";

/** Every `BodyPart` code the front figure can draw. */
const FRONT_PARTS = new Set(FRONT_REGIONS.map((region) => region.part));

/**
 * The week's thumbnail: one plate, no names, lit with the muscles the
 * exercise works — the same drawing the dialog answers with, shrunk to the
 * size of a row.
 *
 * One figure per exercise, chosen by where it lives: front when any named
 * part is drawn there, back only when the whole exercise is. The body stays
 * the navigation — a week of these reads as a week of bodies, and pointing
 * at one still lights the explorer's figures through the same hover channel
 * as before.
 */
export function ExerciseMiniFigure({
  parts,
}: {
  parts: string[];
}) {
  if (parts.length === 0) return null;

  const lit = parts.includes(FULL_BODY) ? MAPPED_PARTS : parts;
  const side = lit.some((part) => FRONT_PARTS.has(part)) ? "front" : "back";

  return (
    <span aria-hidden className="w-8 shrink-0 self-center sm:w-9">
      <BodyPlate side={side} lit={lit} annotated={false} caption={false} />
    </span>
  );
}
