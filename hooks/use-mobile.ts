import * as React from "react"

/**
 * A media query as React state, subscribing to it rather than polling.
 *
 * `useSyncExternalStore` keeps the value correct during hydration (server
 * snapshot: false) without a setState-in-effect cascade. The MediaQueryList
 * and the subscribe function are both held across renders — a fresh
 * subscribe identity would make React tear down and re-add the listener on
 * every single render.
 */
export function useMediaQuery(query: string) {
  const mql = React.useMemo(
    () => (typeof window === "undefined" ? null : window.matchMedia(query)),
    [query],
  )

  const subscribe = React.useCallback(
    (onChange: () => void) => {
      mql?.addEventListener("change", onChange)
      return () => mql?.removeEventListener("change", onChange)
    },
    [mql],
  )

  return React.useSyncExternalStore(
    subscribe,
    () => mql?.matches ?? false,
    () => false,
  )
}

export const MOBILE_BREAKPOINT = 768

/** True below the 768px breakpoint. */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}
