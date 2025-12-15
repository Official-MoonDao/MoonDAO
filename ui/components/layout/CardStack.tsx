import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'

interface CardStackProps {
  children: React.ReactNode[]
}

export default function CardStack({ children }: CardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const isAnimating = useRef(false)
  const [isActive, setIsActive] = useState(false)
  const hasCompletedStack = useRef(false)
  const touchStart = useRef<number | null>(null)
  const [isPageVisible, setIsPageVisible] = useState(true)

  // For scroll-linked animation
  const targetProgress = useRef(0)
  const currentProgress = useRef(0)
  const lastDirection = useRef<'up' | 'down'>('down')
  const nextIndex = useRef<number>(0)
  const animationContext = useRef({
    current: null as HTMLDivElement | null,
    next: null as HTMLDivElement | null,
  })
  const animationFrame = useRef<number | null>(null)
  const directionChangeTimeout = useRef<NodeJS.Timeout | null>(null)

  // Add these refs at the top of the component with other refs
  const lastScrollInputTime = useRef<number>(0)
  const isInTransition = useRef<boolean>(false)
  const transitionCooldown = useRef<boolean>(false)
  const forcedCardProgression = useRef<boolean>(false)

  // Reset refs array when children change
  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, children.length)
  }, [children])

  // Page Visibility API - pause animations when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden)
      
      // Cancel animation frame when page is hidden
      if (document.hidden && animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null
      }
      // Resume animation when page becomes visible
      else if (!document.hidden && animationFrame.current === null && targetProgress.current !== currentProgress.current) {
        animationFrame.current = requestAnimationFrame(animateFrame)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Clean up animation frame on unmount
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [])

  // Smooth animation function that runs on each frame
  const animateFrame = () => {
    // Pause animations when page is not visible
    if (!isPageVisible) {
      animationFrame.current = null
      return
    }

    // Calculate the new progress with damping for smoothness
    // The damping factor controls the smoothing - lower = smoother but slower
    const progressDiff = targetProgress.current - currentProgress.current

    // Use a variable damping factor based on the size of the difference
    // This makes small adjustments smoother and large jumps more responsive
    const minDampingFactor = 0.08 // Slower for small changes (smoother)
    const maxDampingFactor = 0.2 // Faster for large changes (more responsive)

    // Calculate a dynamic damping factor based on the progress difference
    const dampingFactor = Math.min(
      maxDampingFactor,
      minDampingFactor + Math.abs(progressDiff) * 0.5
    )

    currentProgress.current += progressDiff * dampingFactor

    updateCardPositions(currentProgress.current)

    // Check if we've reached the target
    if (
      Math.abs(progressDiff) < 0.001 &&
      Math.abs(targetProgress.current - currentProgress.current) < 0.01
    ) {
      // We're close enough to the target
      currentProgress.current = targetProgress.current
      updateCardPositions(currentProgress.current)

      // If we've completed the animation, handle the transition
      if (targetProgress.current >= 0.99 && !isAnimating.current) {
        completeTransition()
      } else if (targetProgress.current <= 0.01) {
        // Reset if we went back to the start
        resetAnimation()
      }

      // Stop the animation loop
      animationFrame.current = null
      return
    }

    // Continue the animation loop
    animationFrame.current = requestAnimationFrame(animateFrame)
  }

  // Update the target progress and start the animation if needed
  const setTargetProgress = (progress: number) => {
    targetProgress.current = Math.max(0, Math.min(1, progress))

    // Start the animation loop if it's not already running and page is visible
    if (animationFrame.current === null && isPageVisible) {
      animationFrame.current = requestAnimationFrame(animateFrame)
    }
  }

  // Simple function to update card positions based on progress
  const updateCardPositions = (progress: number) => {
    const { current, next } = animationContext.current
    if (!current || !next) return

    // Ensure progress is between 0 and 1
    const clampedProgress = Math.max(0, Math.min(1, progress))

    if (lastDirection.current === 'down') {
      // Current card moves left and fades - use transform for better performance
      gsap.set(current, {
        x: '0%',
        opacity: 1 - clampedProgress * 2,
        scale: 1 - clampedProgress * 0.2,
        force3D: true, // Enable hardware acceleration
      })

      // Next card comes in from right
      gsap.set(next, {
        x: (1 - clampedProgress) * 100 + '%',
        opacity: clampedProgress,
        scale: 0.8 + clampedProgress * 0.2,
        force3D: true,
      })
    } else {
      // Current card moves right
      gsap.set(current, {
        x: clampedProgress * 100 + '%',
        opacity: 1 - clampedProgress * 0.7,
        scale: 1 - clampedProgress * 0.2,
        force3D: true,
      })

      // Next card fades in
      gsap.set(next, {
        x: '0%',
        opacity: clampedProgress,
        scale: 0.8 + clampedProgress * 0.2,
        force3D: true,
      })
    }
  }

  // Reset the animation state
  const resetAnimation = () => {
    currentProgress.current = 0
    targetProgress.current = 0

    // Reset card positions
    if (animationContext.current.current && animationContext.current.next) {
      if (lastDirection.current === 'down') {
        gsap.set(animationContext.current.current, {
          x: '0%',
          opacity: 1,
          scale: 1,
        })
        gsap.set(animationContext.current.next, {
          x: '100%',
          opacity: 0,
          scale: 0.8,
        })
      } else {
        gsap.set(animationContext.current.current, {
          x: '0%',
          opacity: 1,
          scale: 1,
        })
        gsap.set(animationContext.current.next, {
          x: '0%',
          opacity: 0,
          scale: 0.8,
        })
      }
    }
  }

  // Handle direction change safely
  const handleDirectionChange = (newDirection: 'up' | 'down') => {
    // Clear any existing timeout
    if (directionChangeTimeout.current) {
      clearTimeout(directionChangeTimeout.current)
    }

    // Get current cards
    const current = animationContext.current.current
    const next = animationContext.current.next

    if (!current || !next) {
      // If no animation is in progress, just update the direction
      lastDirection.current = newDirection
      return
    }

    // Cancel any running animation frame
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current)
      animationFrame.current = null
    }

    // Smoothly transition to the initial state for the new direction
    const progress = currentProgress.current

    // If we've barely started the animation, just reset
    if (progress < 0.1) {
      resetAnimation()
      lastDirection.current = newDirection
      animationContext.current.current = null
      animationContext.current.next = null
      return
    }
    // Animate back to initial positions
    gsap.to(current, {
      x: '0%',
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => {
        // Update direction after animation completes
        lastDirection.current = newDirection
        currentProgress.current = 0
        targetProgress.current = 0

        // Reset animation context
        animationContext.current.current = null
        animationContext.current.next = null

        // Clear the timeout
        if (directionChangeTimeout.current) {
          clearTimeout(directionChangeTimeout.current)
          directionChangeTimeout.current = null
        }
      },
    })

    // Animate next card back to its initial position
    if (lastDirection.current === 'down') {
      gsap.to(next, {
        x: '100%',
        opacity: 0,
        scale: 0.8,
        duration: 0.3,
        ease: 'power2.out',
      })
    } else {
      gsap.to(next, {
        x: '0%',
        opacity: 0,
        scale: 0.8,
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    // Add a small delay before allowing new animations
    directionChangeTimeout.current = setTimeout(() => {
      directionChangeTimeout.current = null
    }, 350) // Slightly longer than the animation duration
  }

  // Prepare cards for animation
  const prepareAnimation = (direction: 'up' | 'down') => {
    if (isAnimating.current) return false

    const isLastCard = currentIndex === children.length - 1
    const isFirstCard = currentIndex === 0

    // Don't proceed if we're at the edges
    if (
      (isLastCard && direction === 'down') ||
      (isFirstCard && direction === 'up')
    ) {
      if (isLastCard && direction === 'down') {
        hasCompletedStack.current = true
        setIsActive(false)
        unlockScroll()
      }
      return false
    }

    // Calculate next index
    nextIndex.current =
      direction === 'down'
        ? Math.min(children.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1)

    // Get card elements
    const current = cardRefs.current[currentIndex]
    const next = cardRefs.current[nextIndex.current]

    if (!current || !next) return false

    // Store in context
    animationContext.current.current = current
    animationContext.current.next = next

    // Make sure next card is visible
    gsap.set(next, { display: 'block' })

    // Set initial positions based on direction
    if (direction === 'down') {
      gsap.set(next, {
        x: '100%',
        opacity: 0,
        scale: 0.8,
      })
    } else {
      gsap.set(next, {
        x: '0%',
        opacity: 0,
        scale: 0.8,
      })
    }

    lastDirection.current = direction
    currentProgress.current = 0
    targetProgress.current = 0

    return true
  }

  // Complete the transition to the next card
  const completeTransition = () => {
    isAnimating.current = true

    // Update the current index
    setCurrentIndex(nextIndex.current)

    // Reset after a short delay
    setTimeout(() => {
      isAnimating.current = false
      currentProgress.current = 0
      targetProgress.current = 0

      // Hide the previous card
      if (animationContext.current.current) {
        gsap.set(animationContext.current.current, { display: 'none' })
      }

      // Reset animation context
      animationContext.current.current = null
      animationContext.current.next = null
    }, 50)
  }

  const unlockScroll = () => {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.height = ''
  }

  const lockScroll = () => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'relative'
    document.body.style.height = '100%'
  }

  const checkComponentPosition = () => {
    if (!containerRef.current) return null

    const rect = containerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const elementCenter = rect.top + rect.height / 2
    const viewportCenter = viewportHeight / 2
    const distanceFromCenter = Math.abs(elementCenter - viewportCenter)

    // Make this threshold stricter to ensure better centering
    const activationThreshold = viewportHeight * 0.25

    // Check if component is fully visible in viewport
    const isFullyVisible = rect.top >= 0 && rect.bottom <= viewportHeight

    return {
      rect,
      viewportHeight,
      elementCenter,
      distanceFromCenter,
      activationThreshold,
      isNearCenter: distanceFromCenter < activationThreshold && isFullyVisible,
    }
  }

  // Handle scroll events
  const handleScrollInput = (deltaY: number) => {
    if (!isActive || isAnimating.current || directionChangeTimeout.current)
      return false

    const now = Date.now()

    // Debounce rapid consecutive scrolls
    // Minimum time between scroll inputs (in ms)
    // Reduce debounce time to make scrolling more responsive
    const scrollDebounceTime = 30 // Reduced from 50ms
    if (now - lastScrollInputTime.current < scrollDebounceTime) {
      return false
    }

    lastScrollInputTime.current = now

    const direction = deltaY > 0 ? 'down' : 'up'

    // Check if we're at the first card and trying to scroll up
    const isFirstCard = currentIndex === 0
    if (isFirstCard && direction === 'up' && currentProgress.current < 0.05) {
      // Unlock scroll to allow page scrolling
      setIsActive(false)
      unlockScroll()
      return false
    }

    // If direction changed, handle it safely
    if (
      lastDirection.current !== direction &&
      (currentProgress.current > 0.05 || animationContext.current.current)
    ) {
      handleDirectionChange(direction)
      return false
    }

    // Setup animation if needed
    if (!animationContext.current.current || !animationContext.current.next) {
      const prepared = prepareAnimation(direction)
      if (!prepared) return false
    }

    // Calculate new progress
    // Adjust sensitivity here - higher number = less sensitive
    const progressDelta = Math.abs(deltaY) / 300 // Increased sensitivity from 500 to 300

    // Limit the maximum progress change per input to prevent skipping
    const maxProgressDelta = 0.25 // Increased from 0.15 to 0.25
    const limitedProgressDelta = Math.min(progressDelta, maxProgressDelta)

    const newTarget = Math.max(
      0,
      Math.min(1, targetProgress.current + limitedProgressDelta)
    )

    // Update target progress
    setTargetProgress(newTarget)

    return true
  }

  useEffect(() => {
    if (!containerRef.current) return

    let lastScrollY = window.scrollY
    let scrollTimeout: NodeJS.Timeout | null = null

    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout)

      scrollTimeout = setTimeout(() => {
        const currentScrollY = window.scrollY
        const scrollingUp = currentScrollY < lastScrollY
        lastScrollY = currentScrollY

        const position = checkComponentPosition()
        if (!position) return

        // Handle scroll activation/deactivation
        if (scrollingUp && position.rect.bottom < 0) {
          setIsActive(false)
          unlockScroll()
          return
        }

        if (scrollingUp && position.isNearCenter) {
          hasCompletedStack.current = false
        }

        // Only activate when truly centered and fully visible
        if (position.isNearCenter && !hasCompletedStack.current) {
          setIsActive(true)
          lockScroll()
        } else {
          // Deactivate if not centered or if scrolling down past threshold
          setIsActive(false)
          unlockScroll()
        }
      }, 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // Also check position on resize to handle orientation changes
    window.addEventListener('resize', handleScroll, { passive: true })

    // Initial check
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      if (scrollTimeout) clearTimeout(scrollTimeout)
      unlockScroll()
    }
  }, [])

  // Wheel event handler
  useEffect(() => {
    let accumulatedDelta = 0
    let lastWheelTime = 0
    let consecutiveUpScrolls = 0
    let lastWheelDirection: 'up' | 'down' | null = null

    const handleWheel = (e: WheelEvent) => {
      // First check if component is properly centered
      const position = checkComponentPosition()
      if (!position?.isNearCenter) {
        // Don't handle wheel events if not centered
        return
      }

      if (!isActive) {
        // If component is centered but not active yet, activate it
        if (!hasCompletedStack.current) {
          setIsActive(true)
          lockScroll()
        }
        return
      }

      const now = Date.now()
      const isScrollingUp = e.deltaY < 0
      const currentDirection = isScrollingUp ? 'up' : 'down'

      // Detect direction change
      if (
        lastWheelDirection !== null &&
        lastWheelDirection !== currentDirection
      ) {
        // Direction changed, reset state
        accumulatedDelta = 0
      }

      lastWheelDirection = currentDirection

      // Reset accumulated delta if there's been a pause
      // Reduce this time to make scrolling more responsive
      if (now - lastWheelTime > 100) {
        // Reduced from 150ms
        accumulatedDelta = 0
        consecutiveUpScrolls = 0
      }

      lastWheelTime = now

      // Track consecutive up scrolls at the first card
      if (
        isScrollingUp &&
        currentIndex === 0 &&
        currentProgress.current < 0.05
      ) {
        consecutiveUpScrolls++

        // After 3 consecutive up scrolls at the first card, unlock vertical scrolling
        if (consecutiveUpScrolls >= 3) {
          setIsActive(false)
          unlockScroll()
          return
        }
      } else if (!isScrollingUp) {
        consecutiveUpScrolls = 0
      }

      e.preventDefault()
      e.stopPropagation()

      // Throttle fast scrolling by capping the delta value
      // Increase max delta to allow faster scrolling
      const maxDeltaY = 150 // Increased from 100
      const throttledDeltaY =
        Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), maxDeltaY)

      // Accumulate delta for smoother control with a cap to prevent large jumps
      accumulatedDelta += throttledDeltaY

      // Apply a maximum accumulated delta to prevent skipping
      const maxAccumulatedDelta = 200
      accumulatedDelta =
        Math.sign(accumulatedDelta) *
        Math.min(Math.abs(accumulatedDelta), maxAccumulatedDelta)

      const sensitivityMultiplier = isScrollingUp ? 1.8 : 1.2

      // Use a fixed step size for more consistent scrolling
      // Increase step size for faster progression
      const scrollStep = 25
      const direction = accumulatedDelta > 0 ? 1 : -1

      if (Math.abs(targetProgress.current - currentProgress.current) < 0.4) {
        // Increased from 0.3
        handleScrollInput(direction * scrollStep * sensitivityMultiplier)
      }
    }

    if (isActive) {
      window.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      window.removeEventListener('wheel', handleWheel)
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null
      }
      if (directionChangeTimeout.current !== null) {
        clearTimeout(directionChangeTimeout.current)
        directionChangeTimeout.current = null
      }
    }
  }, [isActive, currentIndex, children.length])

  // Touch event handlers
  useEffect(() => {
    let lastTouchY = 0
    let touchVelocity = 0
    let lastTouchTime = 0
    let consecutiveUpSwipes = 0
    let lastTouchDirection: 'up' | 'down' | null = null
    let touchEventCount = 0
    let touchEventTimer: NodeJS.Timeout | null = null

    const handleTouchStart = (e: TouchEvent) => {
      if (!containerRef.current) return

      // Check if component is centered before activating
      const position = checkComponentPosition()
      if (!position?.isNearCenter) {
        // Don't activate if not centered
        return
      }

      touchStart.current = e.touches[0].clientY
      lastTouchY = e.touches[0].clientY
      touchVelocity = 0
      lastTouchTime = Date.now()
      consecutiveUpSwipes = 0
      lastTouchDirection = null
      touchEventCount = 0

      if (!hasCompletedStack.current) {
        setIsActive(true)
        lockScroll()
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current || touchStart.current === null) return

      // Count touch events in a short time period to detect fast swiping
      touchEventCount++

      // Reset the counter after a delay
      if (touchEventTimer) clearTimeout(touchEventTimer)
      touchEventTimer = setTimeout(() => {
        touchEventCount = 0
        // Disable forced progression after a period of no touch events
        forcedCardProgression.current = false
      }, 300)

      // If user is swiping very quickly, enable forced card progression
      if (touchEventCount > 4 && !isInTransition.current) {
        forcedCardProgression.current = true
      }

      const now = Date.now()
      const touchY = e.touches[0].clientY
      const deltaY = lastTouchY - touchY
      const deltaTime = now - lastTouchTime
      const isSwipingUp = deltaY < 0
      const currentDirection = isSwipingUp ? 'up' : 'down'

      // Detect direction change
      if (
        lastTouchDirection !== null &&
        lastTouchDirection !== currentDirection
      ) {
        // Direction changed, reset state
        touchVelocity = 0
      }

      lastTouchDirection = currentDirection

      // Track consecutive up swipes at the first card
      if (isSwipingUp && currentIndex === 0 && currentProgress.current < 0.05) {
        consecutiveUpSwipes++

        // After 3 consecutive up swipes at the first card, unlock vertical scrolling
        if (consecutiveUpSwipes >= 3) {
          setIsActive(false)
          unlockScroll()
          return
        }
      } else if (!isSwipingUp) {
        consecutiveUpSwipes = 0
      }

      // Calculate velocity (pixels per ms)
      if (deltaTime > 0) {
        // Cap the velocity to prevent extremely fast swipes
        // Increase max velocity to allow faster swiping
        const maxVelocity = 1.5 // Increased from 1.0
        const rawVelocity = deltaY / deltaTime
        touchVelocity =
          Math.sign(rawVelocity) * Math.min(Math.abs(rawVelocity), maxVelocity)
      }

      lastTouchY = touchY
      lastTouchTime = now

      // Only prevent default if we're actively handling the card stack
      if (isActive) {
        e.preventDefault()

        // Throttle fast swipes by capping the delta value
        // Increase max delta to allow faster swiping
        const maxDeltaY = 25 // Increased from 15
        const throttledDeltaY =
          Math.sign(deltaY) * Math.min(Math.abs(deltaY), maxDeltaY)

        const sensitivityMultiplier = 1
        const adjustedDeltaY = throttledDeltaY * sensitivityMultiplier

        if (
          Math.abs(targetProgress.current - currentProgress.current) < 0.3 &&
          !transitionCooldown.current &&
          !isInTransition.current
        ) {
          handleScrollInput(adjustedDeltaY > 0 ? 20 : -20)
        }
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStart.current === null) return

      // Use velocity to determine if we should complete the animation
      const velocityThreshold = 0.4
      const isSwipingUp = touchVelocity < 0

      // Lower threshold for upward swipes
      const adjustedThreshold = 0.4

      if (Math.abs(touchVelocity) > adjustedThreshold) {
        // Fast swipe - complete in the direction of the swipe
        setTargetProgress(touchVelocity > 0 ? 1 : 0)
      } else if (
        currentProgress.current > 0.1 &&
        currentProgress.current < 0.9
      ) {
        // For upward swipes, make it easier to complete the animation
        const midPoint = 0.5
        setTargetProgress(currentProgress.current > midPoint ? 1 : 0)
      }

      // If we're more than halfway through a transition, force it to complete
      if (currentProgress.current > 0.5 && !isInTransition.current) {
        setTimeout(() => {
          setTargetProgress(1.0)
        }, 50)
      }

      touchStart.current = null

      // Reset touch event counter
      touchEventCount = 0
      if (touchEventTimer) {
        clearTimeout(touchEventTimer)
      }
    }

    // Use passive: true for touchstart to improve performance
    window.addEventListener('touchstart', handleTouchStart, { passive: true })

    // Use passive: false for touchmove to allow preventDefault when needed
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    // Use passive: true for touchend as we don't need to prevent default
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      if (touchEventTimer) clearTimeout(touchEventTimer)
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null
      }
      if (directionChangeTimeout.current !== null) {
        clearTimeout(directionChangeTimeout.current)
        directionChangeTimeout.current = null
      }
    }
  }, [isActive, currentIndex, children.length])

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null
      }
      if (directionChangeTimeout.current !== null) {
        clearTimeout(directionChangeTimeout.current)
        directionChangeTimeout.current = null
      }
    }
  }, [])

  // Initialize cards
  useEffect(() => {
    if (!containerRef.current) return

    // Hide all cards except the first one
    cardRefs.current.forEach((card, index) => {
      if (!card) return
      gsap.set(card, {
        position: 'absolute',
        top: 0,
        left: 0,
        opacity: index === 0 ? 1 : 0,
        scale: index === 0 ? 1 : 0.8,
        display: index === 0 ? 'block' : 'none',
      })
    })
  }, [])

  return (
    <div className="flex items-center justify-center py-20">
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden transition-all duration-300`}
        style={{
          minHeight: '500px',
          maxHeight: '800px',
        }}
      >
        {children.map((child, index) => (
          <div
            key={index}
            ref={(el: HTMLDivElement | null) => {
              cardRefs.current[index] = el
            }}
            className="w-full absolute top-0 left-0 h-full"
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
