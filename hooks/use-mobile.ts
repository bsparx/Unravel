import * as React from "react"

const MOBILE_BREAKPOINT = 768

const mediaQuery = () =>
  window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

/**
 * True below the 768px breakpoint, subscribing to the media query rather
 * than polling it. `useSyncExternalStore` keeps the value correct during
 * hydration (server snapshot: false) without a setState-in-effect cascade.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mql = mediaQuery()
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => mediaQuery().matches,
    () => false,
  )
}
