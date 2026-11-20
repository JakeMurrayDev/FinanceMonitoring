import { useSyncExternalStore } from 'react'

/**
 * Subscribe to a CSS media query. Used where a layout should render a
 * different component (not just restyle one) at a breakpoint, so the DOM
 * contains one version for screen readers, not two with one hidden.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => {
        list.removeEventListener('change', onChange)
      }
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}
