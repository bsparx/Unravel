"use client";

import { useSyncExternalStore } from "react";

import {
  getTheme,
  resolveTheme,
  subscribe,
  type ResolvedTheme,
} from "@/lib/theme";

/** 0..1 RGB, which is what a `vec3` uniform wants. */
export type Rgb = [number, number, number];

export type FaceColors = {
  /** The calm blue. Focus, and only focus. */
  running: Rgb;
  /** Teal. The live colour during a break. */
  rest: Rgb;
  /** The spent groove. */
  track: Rgb;
};

/**
 * Light-mode values, used until the document can be read.
 *
 * Frozen at module scope so `getServerSnapshot` returns the same reference
 * every time — `useSyncExternalStore` compares identity, and a fresh object
 * per call is an infinite render.
 */
const FALLBACK: FaceColors = {
  running: [0.231, 0.435, 0.690],
  rest: [0.184, 0.435, 0.416],
  track: [0.914, 0.886, 0.839],
};

/**
 * The palette, read off the document rather than written into the shader.
 *
 * The running-colour reservation — "work is on the clock, and nothing else" —
 * is the most load-bearing rule in `design-notes.md`, and it holds because all
 * of it
 * shares one set of tokens in `globals.css`. Hard-coding hexes into a GLSL
 * string would put the timer's colours somewhere nobody would think to grep,
 * and the rule would rot the first time the palette moved.
 *
 * Modelled on `lib/theme.ts`: the CSS custom properties on `<html>` are an
 * external store that changes without React's involvement, so this reads them
 * through `useSyncExternalStore` rather than mirroring them into state from an
 * effect. The tokens under `.dark` are different colours, not merely darker
 * ones, so the snapshot is invalidated whenever the resolved theme moves.
 */
export function useFaceColors(): FaceColors {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

let cache: { theme: ResolvedTheme; colors: FaceColors } | null = null;

function getSnapshot(): FaceColors {
  const theme = resolveTheme(getTheme());
  // Cached because `getSnapshot` runs on every render and `getComputedStyle`
  // forces a style flush.
  if (cache?.theme === theme) return cache.colors;

  const colors = readColors();
  cache = { theme, colors };
  return colors;
}

/** The server cannot know the theme, and a canvas renders nothing there. */
const getServerSnapshot = (): FaceColors => FALLBACK;

function readColors(): FaceColors {
  if (typeof document === "undefined") return FALLBACK;

  const styles = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: Rgb): Rgb =>
    parseColor(styles.getPropertyValue(token).trim()) ?? fallback;

  return {
    running: read("--running", FALLBACK.running),
    rest: read("--primary", FALLBACK.rest),
    track: read("--arc-track", FALLBACK.track),
  };
}

/**
 * Parse whatever `getComputedStyle` hands back for a custom property.
 *
 * A custom property is not a computed colour — the browser returns the token
 * text as written, so what comes out is the hex from `globals.css`. The
 * `rgb()` branch is there because that is not guaranteed. Anything else falls
 * back rather than rendering the face black.
 */
function parseColor(value: string): Rgb | null {
  if (!value) return null;

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    if (full.length < 6) return null;
    const n = Number.parseInt(full.slice(0, 6), 16);
    if (Number.isNaN(n)) return null;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  const numbers = value.match(/[\d.]+/g);
  if (!numbers || numbers.length < 3) return null;
  const [r, g, b] = numbers.map(Number);
  return [r / 255, g / 255, b / 255];
}
