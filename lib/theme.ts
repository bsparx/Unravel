/**
 * The theme store. No React — see `components/theme-provider.tsx` for the hook.
 *
 * Why this exists rather than `next-themes`: that library renders its
 * before-paint script *inside a client provider*, which predates RSC. React 19
 * warns about it, correctly — a `<script>` rendered by a Client Component is
 * never executed on the client. It happens not to matter (the tag is in the
 * server-rendered HTML, so the browser runs it on first paint), but the warning
 * has no upstream fix: it's still present in next-themes 1.0.0-beta.0.
 *
 * Under Next 16 the blocking script belongs in the Server Component layout,
 * where rendering a script is the documented pattern. That's the only real
 * change here; everything below is the same behaviour next-themes provided.
 */

export type Theme = "light" | "dark" | "eggplant" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEMES: Theme[] = ["light", "dark", "eggplant", "system"];

/** Shared with the inline script in `theme-script.tsx`. Keep them in step. */
export const THEME_STORAGE_KEY = "theme";

/** The marker the eggplant theme puts on `<html>` — see globals.css. */
export const EGGPLANT_THEME_ATTR = "data-theme";
export const EGGPLANT_THEME_VALUE = "eggplant";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const isTheme = (value: unknown): value is Theme =>
  value === "light" ||
  value === "dark" ||
  value === "eggplant" ||
  value === "system";

// ---------------------------------------------------------------- store

const listeners = new Set<() => void>();

/**
 * Cached, because `useSyncExternalStore` calls `getSnapshot` on every render
 * and reading `localStorage` each time is a synchronous disk-backed hit.
 */
let cached: Theme | null = null;

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Storage can throw outright in a locked-down or private context. A theme
    // preference is not worth taking the page down for.
    return "system";
  }
}

export function getTheme(): Theme {
  if (cached === null) cached = readStored();
  return cached;
}

/**
 * The server has no way to know the preference — it lives in the browser. So
 * SSR always renders as if "system", and the inline script fixes the class
 * before paint. Anything that *displays* the current theme has to wait for
 * mount; see `useMounted` in the toggle.
 */
export const getServerTheme = (): Theme => "system";

export function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" &&
    window.matchMedia(DARK_QUERY).matches
    ? "dark"
    : "light";
}

/**
 * A concrete light/dark answer to any preference. Eggplant resolves to dark:
 * it IS the dark theme with a violet palette — the `.dark` class is what every
 * `dark:` variant, sonner, chart and timer face already keys off, so eggplant
 * inherits all of that for free and only swaps tokens on top.
 */
export const resolveTheme = (theme: Theme): ResolvedTheme =>
  theme === "system" ? systemTheme() : theme === "eggplant" ? "dark" : theme;

export function setTheme(next: Theme): void {
  if (!isTheme(next)) return;
  cached = next;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Same as above: an unwritable store means the choice doesn't persist,
    // not that it doesn't apply.
  }

  applyTheme(next, { animate: false });
  emit();
}

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Subscribe to theme changes, from anywhere: this tab, another tab, or the OS.
 *
 * The two platform listeners are installed on the first subscriber and torn
 * down with the last, so nothing is attached on a page that never asks.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1) attachPlatformListeners();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detachPlatformListeners();
  };
}

let media: MediaQueryList | null = null;

const onSystemChange = () => {
  // Only meaningful while following the system, but re-applying an explicit
  // theme is a no-op, so there's nothing to branch on.
  if (getTheme() === "system") {
    applyTheme("system", { animate: false });
    emit();
  }
};

const onStorage = (event: StorageEvent) => {
  if (event.key !== THEME_STORAGE_KEY) return;
  cached = null;
  applyTheme(getTheme(), { animate: false });
  emit();
};

function attachPlatformListeners(): void {
  if (typeof window === "undefined") return;
  media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
}

function detachPlatformListeners(): void {
  if (typeof window === "undefined") return;
  media?.removeEventListener("change", onSystemChange);
  media = null;
  window.removeEventListener("storage", onStorage);
}

// ---------------------------------------------------------------- the DOM

/**
 * Put the theme on `<html>`.
 *
 * The `.dark` class is the darkness switch — the whole app keys off it. The
 * eggplant theme sets it AND marks `data-theme="eggplant"`, and globals.css
 * overrides the palette tokens for that combination. Clearing the marker when
 * leaving eggplant matters: a stale attribute would keep the violet palette
 * on a plain dark theme.
 *
 * `color-scheme` matters as much as the class: it's what makes native form
 * controls, scrollbars and the `<input type="date">` picker match — all of
 * which this app uses, and all of which look broken in a light widget on a
 * dark page.
 */
export function applyTheme(
  theme: Theme,
  { animate = false }: { animate?: boolean } = {},
): void {
  if (typeof document === "undefined") return;

  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  const restore = animate ? null : suppressTransitions();

  root.classList.toggle("dark", resolved === "dark");
  if (theme === "eggplant") {
    root.setAttribute(EGGPLANT_THEME_ATTR, EGGPLANT_THEME_VALUE);
  } else {
    root.removeAttribute(EGGPLANT_THEME_ATTR);
  }
  root.style.colorScheme = resolved;

  restore?.();
}

/**
 * Kill transitions for one frame across the switch.
 *
 * Without this every element with `transition-colors` — which is most of them
 * — cross-fades independently, and the page appears to dissolve rather than
 * change. Reading `getComputedStyle` forces the style flush that makes the
 * removal land on the *next* frame rather than being batched away.
 */
function suppressTransitions(): () => void {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important;animation:none!important}",
    ),
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    setTimeout(() => style.remove(), 1);
  };
}
