/**
 * The 20 hues a task may wear on the calendar — the Google Calendar idea of
 * identity-by-colour, tuned to this app's paper-and-ink palette.
 *
 * The hues are mid-chroma on purpose: blocks render them as alpha tints
 * (12% fill, 45% border) over the theme's background, so one hex works in
 * both light and dark — the same trick the kind colours already use
 * (`bg-primary/12`). Nothing here is a full-strength colour on its own.
 *
 * "teal" is the first entry and the schema default: an uncoloured task is
 * indistinguishable from the calendar's work colour, which is exactly how a
 * fresh calendar should read.
 */
export const CALENDAR_COLORS = {
  teal: "#2f6f6a",
  blue: "#3b6fb0",
  slate: "#5a7f8c",
  navy: "#45527a",
  steel: "#5a6b8c",
  sky: "#4a8db8",
  seafoam: "#3f8c85",
  forest: "#41694a",
  mint: "#6f9a63",
  olive: "#75803e",
  mustard: "#a8832b",
  tangerine: "#c56e2f",
  coral: "#c25f4d",
  rose: "#b85c7e",
  purple: "#7a5ca8",
  lavender: "#8d7bb8",
  sand: "#a08a5a",
  brown: "#8c6a4a",
  charcoal: "#666f7a",
  magenta: "#a0559e",
} as const;

export type CalendarColor = keyof typeof CALENDAR_COLORS;

/** In picker order — the same order every swatch row shows. */
export const CALENDAR_COLOR_NAMES = Object.keys(
  CALENDAR_COLORS,
) as CalendarColor[];

/** A value off the wire or the database, checked against the palette. */
export function isCalendarColor(value: string): value is CalendarColor {
  return value in CALENDAR_COLORS;
}

/** The tinted fill and border a task-coloured block wears on the grid. */
export function calendarChipStyle(color: CalendarColor): {
  backgroundColor: string;
  borderColor: string;
} {
  const hex = CALENDAR_COLORS[color];
  // Hex alpha suffixes: `1f` ≈ 12%, `73` ≈ 45% — the chip's existing
  // `bg-primary/12 border-primary/45` reading, per-hue.
  return {
    backgroundColor: `${hex}1f`,
    borderColor: `${hex}73`,
  };
}

/** The solid dot a row wears, when the chip has no room for a fill. */
export function calendarDotStyle(color: CalendarColor): {
  backgroundColor: string;
} {
  return { backgroundColor: CALENDAR_COLORS[color] };
}
