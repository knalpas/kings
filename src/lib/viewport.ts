import { useSyncExternalStore } from 'react'
import { zoomIdentity, type ZoomTransform } from 'd3-zoom'

export type ViewportState = {
  transform: ZoomTransform
  width: number
  height: number
}

/** Shares the chart's pan/zoom with the rail and year ruler without re-rendering the chart. */
export function createViewport() {
  let state: ViewportState = { transform: zoomIdentity, width: 0, height: 0 }
  const listeners = new Set<() => void>()
  let frame = 0
  return {
    get: () => state,
    set(next: Partial<ViewportState>) {
      state = { ...state, ...next }
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        listeners.forEach((l) => l())
      })
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type Viewport = ReturnType<typeof createViewport>

export function useViewport(viewport: Viewport): ViewportState {
  return useSyncExternalStore(viewport.subscribe, viewport.get)
}
