import { THEME_STORAGE_KEY } from "@/lib/theme";

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
 * bundle has loaded, so it cannot import from `lib/theme.ts`. The one thing
 * shared with that module is the storage key, imported above rather than
 * retyped — a drift between the two would present as "my theme resets on every
 * reload", with nothing obviously wrong at either site.
 */
export function ThemeScript() {
  const script = `
try {
  var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  var theme = stored === "light" || stored === "dark" ? stored
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
} catch (error) {}
`.trim();

  return (
    // suppressHydrationWarning because the script mutates <html> before React
    // sees it, so the class it finds is not the one the server sent.
    <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />
  );
}
