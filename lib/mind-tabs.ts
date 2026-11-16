/**
 * The /mind tabs, in order. Daily pages first: they're opened every day.
 *
 * Its own plain module on purpose: the page (a Server Component) and the
 * board (a Client Component) both need the list, and a value exported from
 * a "use client" file reaches the server as a client reference, not as the
 * array, so `MIND_TABS.filter` would not exist there.
 */
export const MIND_TABS = ["gratitude", "dua", "wishes", "disputations"] as const;
export type MindTab = (typeof MIND_TABS)[number];
