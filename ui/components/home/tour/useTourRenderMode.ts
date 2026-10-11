import { useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

export type TourRenderMode = 'globe' | 'still'

// Whether this visitor gets the live scene or a still per stop. The scene is
// a 16 km terrain patch with PBR hardware and a bloom chain, which is too much
// for a phone or a low-core machine, and a flying camera is exactly what
// reduced motion asks us not to do. `?globe=1` forces the live scene for
// testing on those devices.
//
// Null until mounted, so the server render and the first client render agree
// on showing the still.
export default function useTourRenderMode(): TourRenderMode | null {
  const reduceMotion = useReducedMotion()
  const [mode, setMode] = useState<TourRenderMode | null>(null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('globe')) {
      setMode('globe')
      return
    }
    const narrow = window.matchMedia('(max-width: 768px)').matches
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4
    setMode(reduceMotion || narrow || weak ? 'still' : 'globe')
  }, [reduceMotion])

  return mode
}
