import { RefObject, useEffect, useState } from 'react'

type UseElementVisibilityOptions = {
  threshold?: number | number[]
  rootMargin?: string
  visibilityThreshold?: number // Minimum intersection ratio to consider visible
}

/**
 * Hook to detect when an element is visible in the viewport using Intersection Observer
 * @param ref - React ref to the element to observe
 * @param options - IntersectionObserver options
 * @returns Object with isVisible boolean
 */
export function useElementVisibility(
  ref: RefObject<HTMLElement>,
  options: UseElementVisibilityOptions = {}
): { isVisible: boolean } {
  const {
    threshold = [0, 0.2, 0.5, 1.0],
    rootMargin = '-100px 0px 0px 0px',
    visibilityThreshold = 0.75,
  } = options

  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const currentRef = ref.current
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Element is considered visible if intersectionRatio exceeds the threshold
        setIsVisible(entry.intersectionRatio > visibilityThreshold)
      },
      {
        threshold,
        rootMargin,
      }
    )

    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [ref, threshold, rootMargin, visibilityThreshold])

  return { isVisible }
}

