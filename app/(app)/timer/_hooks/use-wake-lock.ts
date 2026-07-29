"use client";

import { useEffect } from "react";

type WakeLockSentinel = { release: () => Promise<void> };

/**
 * Keep the screen on while the timer runs, so a glanceable clock stays
 * glanceable. Unsupported browsers and denied requests are both fine — this is
 * a nicety, and the timer's accuracy never depends on the tab staying awake.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      }
    ).wakeLock;

    if (!wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        sentinel = await wakeLock.request("screen");
      } catch {
        // Denied, or the document isn't visible. Nothing to do.
      }
    };

    // The lock is dropped whenever the tab is hidden; take it again on return.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !released) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
