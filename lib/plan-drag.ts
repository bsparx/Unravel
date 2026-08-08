/**
 * The contract between the "not on the day yet" panel and the calendar grid.
 *
 * Native HTML5 drag and drop rather than a drag library, for one reason that
 * matters here: the drop position has to resolve to a *minute*, and `clientY`
 * against the column's bounding box gives that exactly — the same arithmetic
 * the grid already uses to move and resize blocks. A library that reports
 * "which droppable did you land on" would need that math bolted back on, and
 * would run a second drag system alongside the pointer-capture one the blocks
 * already use.
 */

import { PLAN_DEFAULT_MINUTES } from "@/lib/block-math";

/**
 * A private MIME type, so the grid can tell one of our rows apart from a
 * dragged file or a selection of text — `dragover` can inspect `types` but
 * never `getData`, so the type string is the only thing to go on mid-drag.
 */
export const PLAN_ITEM_MIME = "application/x-plan-item";

export type PlanDragItem = {
  id: string;
  title: string;
  /** How the grid sizes its preview: always the 30-minute default. */
  minutes: number;
};

/** How long a block for this thing should be. Always 30 — estimates inform,
 * they don't constrain; the person adjusts after it lands. */
export function planMinutes(): number {
  return PLAN_DEFAULT_MINUTES;
}

/**
 * The item currently in flight.
 *
 * Module-level rather than state, because `dragover` is the only event that
 * knows where the pointer is and the spec forbids reading `getData` there —
 * the payload is deliberately unreadable until drop. The grid needs the item's
 * *length* on every dragover to draw an honest preview, so it has to come from
 * somewhere else. A drag is a singleton by construction, so this is safe.
 */
let active: PlanDragItem | null = null;

export const activePlanItem = (): PlanDragItem | null => active;

export function writePlanItem(
  dataTransfer: DataTransfer,
  item: PlanDragItem,
): void {
  dataTransfer.setData(PLAN_ITEM_MIME, JSON.stringify(item));
  // Firefox refuses to start a drag unless text/plain is set too.
  dataTransfer.setData("text/plain", item.title);
  dataTransfer.effectAllowed = "copy";
  active = item;
}

/** Call on `dragend`, which fires whether the drop landed or was abandoned. */
export function clearPlanItem(): void {
  active = null;
}

export function readPlanItem(dataTransfer: DataTransfer): PlanDragItem | null {
  const raw = dataTransfer.getData(PLAN_ITEM_MIME);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as PlanDragItem).id === "string" &&
      typeof (parsed as PlanDragItem).title === "string" &&
      typeof (parsed as PlanDragItem).minutes === "number"
    ) {
      return parsed as PlanDragItem;
    }
  } catch {
    // Something else was dropped. Not our problem.
  }

  return null;
}

/** Is the thing currently being dragged one of ours? */
export const isPlanItemDrag = (dataTransfer: DataTransfer | null): boolean =>
  dataTransfer?.types.includes(PLAN_ITEM_MIME) ?? false;
