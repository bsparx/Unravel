"use client";

import { useSyncExternalStore } from "react";

import {
  getServerTheme,
  getTheme,
  resolveTheme,
  setTheme,
  subscribe,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

/**
 * The theme, and a way to change it.
 *
 * `useSyncExternalStore` rather than context + `useState`: the source of truth
 * is `localStorage` plus a media query, both of which are external stores that
 * can change without React doing anything. It also gives an explicit server
 * snapshot, so there is no hydration mismatch and no setState-in-an-effect —
 * the pattern the lint rule rejects, and rightly.
 *
 * There is no provider component to mount. Nothing needs one: the store
 * installs its own listeners on first subscribe, and the class is already on
 * `<html>` before this file has even been fetched, courtesy of `ThemeScript`.
 */
export function useTheme(): {
  /** The preference, which may be "system". */
  theme: Theme;
  /** What "system" currently resolves to. Always concrete. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
} {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  return {
    theme,
    // Safe during SSR: resolveTheme falls back to "light" without a window.
    resolvedTheme: resolveTheme(theme),
    setTheme,
  };
}

/**
 * Whether the client has taken over.
 *
 * Anything that *renders* the current theme has to gate on this, because the
 * server genuinely cannot know it — rendering "Dark" on the server for someone
 * whose preference is dark would be right by luck and wrong by hydration.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
