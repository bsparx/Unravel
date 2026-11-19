/**
 * The /heart tabs, in order. A plain module, not part of the "use client"
 * board, for the same reason as lib/mind-tabs.ts: a value exported from a
 * client file reaches the server page as a reference, not as the array.
 */
export const HEART_TABS = ["gratitude", "dua", "recitation"] as const;
export type HeartTab = (typeof HEART_TABS)[number];

export type HeartEnabled = Record<HeartTab, boolean>;

/** The tabs that are switched on, in order. */
export function enabledHeartTabs(enabled: HeartEnabled): HeartTab[] {
  return HEART_TABS.filter((tab) => enabled[tab]);
}
