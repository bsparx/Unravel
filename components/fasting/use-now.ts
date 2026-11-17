"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared clock for the fasting ring: one interval for every reader, read
 * through `useSyncExternalStore` so nothing sets state from an effect.
 *
 * The server snapshot is the instant the page was rendered, so hydration
 * paints exactly what the server did; React then swaps in the live value.
 * Fifteen seconds is plenty for a readout in minutes, and returning to the
 * tab ticks at once so a phone woken after hours isn't stale.
 */
const TICK_MS = 15_000;

const listeners = new Set<() => void>();
let current = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function onVisible() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = Date.now();
    timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

const getSnapshot = () => current;

/** Milliseconds since the epoch, live on the client, `serverNow` on the server. */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverNow);
}
