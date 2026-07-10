import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Upraveno oproti shadcn originálu: useSyncExternalStore místo
// useState+useEffect — projde přísným pravidlem react-hooks/set-state-in-effect
// a čte stav přímo z matchMedia (žádné rozjetí při hydrataci; server = false).
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
