/**
 * Cookie backing the collapsible right-hand side panel on `/calendar`
 * (mini-month navigator + "Not on the day yet" list).
 *
 * Kept in a plain module with no `"use client"` directive so both the server
 * page (which reads the cookie on SSR to avoid layout shift) and the client
 * toggle (which writes it on interaction) share one definition.
 */
export const CALENDAR_PANEL_COOKIE = "calendar_panel_state";

/** One year — the panel preference should stick across sessions. */
export const CALENDAR_PANEL_MAX_AGE = 60 * 60 * 24 * 365;

/** DOM id shared by the `<aside>` and the header toggle's `aria-controls`. */
export const CALENDAR_PANEL_ID = "calendar-side-panel";

/**
 * Collapsed by default so `/calendar` opens at 100% width; only an explicit
 * `"true"` opens the right-hand panel.
 */
export function parseCalendarPanelCookie(value: string | undefined): boolean {
  return value === "true";
}

export function formatCalendarPanelCookie(open: boolean): string {
  return `${CALENDAR_PANEL_COOKIE}=${open}; path=/; max-age=${CALENDAR_PANEL_MAX_AGE}; samesite=lax`;
}
