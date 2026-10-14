import { useReducedMotion } from 'framer-motion'
import { RefObject, useEffect } from 'react'

/**
 * Drives a silent, looping background video (a hero plate or a film's live
 * poster). The element should carry `autoPlay muted loop playsInline`, so it
 * starts straight from the server HTML without waiting for hydration. Once
 * hydrated, this pauses it while `targetRef` is off screen, and stops it under
 * prefers-reduced-motion (the poster frame shows instead).
 */
export function useAmbientVideo(
  videoRef: RefObject<HTMLVideoElement>,
  targetRef: RefObject<HTMLElement>,
  active = true
) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const video = videoRef.current
    const target = targetRef.current
    if (!active || !video || !target) return
    if (reduceMotion) {
      video.pause()
      return
    }
    video.muted = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay refused (e.g. low-power mode): the poster stays up.
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [active, reduceMotion, videoRef, targetRef])
}
