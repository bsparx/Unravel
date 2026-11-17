/**
 * The /body tabs, in order. A plain module, not part of the "use client"
 * board, for the same reason as lib/mind-tabs.ts: a value exported from a
 * client file reaches the server page as a reference, not as the array.
 */
export const BODY_TABS = ["exercises", "fasting"] as const;
export type BodyTab = (typeof BODY_TABS)[number];

export type BodyEnabled = Record<BodyTab, boolean>;

/** The tabs that are switched on, in order. */
export function enabledBodyTabs(enabled: BodyEnabled): BodyTab[] {
  return BODY_TABS.filter((tab) => enabled[tab]);
}
