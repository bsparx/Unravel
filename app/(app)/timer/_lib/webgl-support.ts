/**
 * Whether this browser will give the timer face a WebGL context.
 *
 * A store rather than component state, for the same reason the theme is one:
 * it's a fact about the platform that React doesn't own, it's answered once
 * per document, and it can be revoked from the outside when the GPU takes a
 * context back. Reading it through `useSyncExternalStore` also keeps it out of
 * an effect, which is the pattern this codebase rejects — see the note in
 * `components/theme-provider.tsx`.
 */

const listeners = new Set<() => void>();

/** null until probed. Probing is a real context, so it happens exactly once. */
let cached: boolean | null = null;

export function getWebglSupport(): boolean {
  if (cached === null) cached = probe();
  return cached;
}

/**
 * The server has no GPU and renders no canvas, so it always answers no — which
 * is what makes the SVG arc the server render and the pre-hydration paint.
 */
export const getServerWebglSupport = (): boolean => false;

/**
 * Called when a live context is lost. There is no way back within the page's
 * lifetime, so this is one-directional on purpose.
 */
export function markWebglUnavailable(): void {
  if (cached === false) return;
  cached = false;
  for (const listener of listeners) listener();
}

export function subscribeWebglSupport(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Probe with a throwaway context rather than sniffing the user agent.
 *
 * The throwaway is explicitly released: browsers cap how many live contexts
 * they will hand out, and leaking one here would eventually cost the face the
 * context it actually wants.
 */
function probe(): boolean {
  if (typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
