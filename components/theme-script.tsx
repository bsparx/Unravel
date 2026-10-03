import {
  DARK_PALETTES,
  EVENING_ENDS_AT,
  EVENING_PALETTE,
  EVENING_STORAGE_KEY,
  THEMES,
  THEME_ATTR,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
/**
 * The before-paint theme script.
 *
 * A **Server Component**, deliberately. This has to run before the browser
 * paints anything, or a dark-theme user gets a full frame of cream paper on
 * every navigation to a fresh document — and the only way to get code to run
 * that early is a synchronous inline `<script>` in the server-rendered HTML.
 *
 * Rendering a `<script>` from a Client Component is what React 19 warns about,
 * and it's the reason this isn't `next-themes`: a script React renders on the
 * client is never executed. Here it's server-rendered, which is the documented
 * pattern and carries no warning.
 *
 * It is intentionally dependency-free and stringified: it runs before any
 * bundle has loaded, so it cannot import from `lib/theme.ts` at runtime. The
 * constants it shares with that module are interpolated at render time rather
 * than retyped — a drift between the two would present as "my theme resets on
 * every reload", with nothing obviously wrong at either site.
 */
export function ThemeScript() {
  const script = `
try {
  var themes = ${JSON.stringify(THEMES)};
  var darkPalettes = ${JSON.stringify(DARK_PALETTES)};
  var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  var palette = themes.indexOf(stored) >= 0 && stored !== "system" ? stored
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  var evening = null;
  try { evening = JSON.parse(localStorage.getItem(${JSON.stringify(EVENING_STORAGE_KEY)}) || "null"); } catch (e) {}
  var hour = new Date().getHours();
  if (evening && evening.on === true && (hour >= evening.from || hour < ${EVENING_ENDS_AT})) palette = ${JSON.stringify(EVENING_PALETTE)};
  var dark = darkPalettes.indexOf(palette) >= 0;
  var root = document.documentElement;
  root.classList.toggle("dark", dark);
  if (palette === "light" || palette === "dark") {
    root.removeAttribute(${JSON.stringify(THEME_ATTR)});
  } else {
    root.setAttribute(${JSON.stringify(THEME_ATTR)}, palette);
  }
  root.style.colorScheme = dark ? "dark" : "light";
} catch (error) {}
`.trim();

  return (
    // suppressHydrationWarning because the script mutates <html> before React
    // sees it, so the class it finds is not the one the server sent.
    <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />
  );
}
