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

  // Reset refs array when children change
  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, children.length)
  }, [children])

  // Animation function
  const animateCards = (nextIndex: number, scrollingDown: boolean) => {
    if (!containerRef.current || isAnimating.current) return

    const currentCard = cardRefs.current[currentIndex]
    const nextCard = cardRefs.current[nextIndex]

    if (!currentCard || !nextCard) return

    isAnimating.current = true

    if (scrollingDown) {
      // Sliding animation for scrolling down
      gsap.set(nextCard, {
        x: '100%',
        opacity: 0,
        scale: 0.8,
        display: 'block',
      })

      gsap.to(currentCard, {
        x: '0%',
        opacity: 0,
        scale: 0.8,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
          gsap.set(currentCard, { display: 'none' })
        },
      })

      gsap.to(nextCard, {
        x: '0%',
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
          isAnimating.current = false
        },
      })
    } else {
      // Fade animation for scrolling up
      gsap.set(nextCard, {
        x: '0%',
        opacity: 0,
        scale: 1,
        display: 'block',
      })

      gsap.to(currentCard, {
        x: '100%',
        opacity: 0,
        scale: 0.8,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
          gsap.set(currentCard, { display: 'none' })
        },
      })

      gsap.to(nextCard, {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
          isAnimating.current = false
        },
      })
    }

    setCurrentIndex(nextIndex)
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
    const activationThreshold = viewportHeight * 0.4

    return {
      rect,
      viewportHeight,
      elementCenter,
      distanceFromCenter,
      activationThreshold,
      isNearCenter: distanceFromCenter < activationThreshold,
    }
  }

  const handleStackNavigation = async (
    scrollingDown: boolean,
    deltaY: number = 0
  ) => {
    const isLastCard = currentIndex === children.length - 1
    const isFirstCard = currentIndex === 0

    // Handle exiting the stack
    if ((isLastCard && scrollingDown) || (isFirstCard && !scrollingDown)) {
      if (isLastCard && scrollingDown) {
        hasCompletedStack.current = true
      }

      // Create a promise that resolves when animation is complete
      const waitForAnimation = new Promise<void>((resolve) => {
        const checkAnimation = () => {
          if (!isAnimating.current) {
            resolve()
          } else {
            requestAnimationFrame(checkAnimation)
          }
        }
        checkAnimation()
      })

      // Wait for any ongoing animation to complete
      await waitForAnimation

      setIsActive(false)
      unlockScroll()
      return true
    }

    // Handle card navigation
    if (deltaY === 0 || Math.abs(deltaY) > 50) {
      if (scrollingDown && !isLastCard) {
        animateCards(currentIndex + 1, true)
        return true
      } else if (!scrollingDown && !isFirstCard) {
        animateCards(currentIndex - 1, false)
        return true
      }
    }

    return false
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

        if (position.isNearCenter && !hasCompletedStack.current) {
          setIsActive(true)
          lockScroll()
        } else if (
          position.distanceFromCenter >= position.activationThreshold &&
          !scrollingUp
        ) {
          setIsActive(false)
          unlockScroll()
        }
      }, 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeout) clearTimeout(scrollTimeout)
      unlockScroll()
    }
  }, [])

  // Update wheel handler to handle async navigation
  useEffect(() => {
    const handleWheel = async (e: WheelEvent) => {
      if (!isActive || isAnimating.current) return
      e.preventDefault()
      e.stopPropagation()

      await handleStackNavigation(e.deltaY > 0)
    }

    if (isActive) {
      window.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => window.removeEventListener('wheel', handleWheel)
  }, [isActive, currentIndex, children.length])

  // Update touch handler to handle async navigation
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (!containerRef.current) return
      touchStart.current = e.touches[0].clientY

      const position = checkComponentPosition()
      if (position?.isNearCenter && !hasCompletedStack.current) {
        setIsActive(true)
        lockScroll()
      }
    }

    const handleTouchMove = async (e: TouchEvent) => {
      if (!containerRef.current || !touchStart.current) return

      const touchY = e.touches[0].clientY
      const deltaY = touchStart.current - touchY
      const scrollingDown = deltaY > 0

      const position = checkComponentPosition()
      if (!position) return

      if (!scrollingDown && position.isNearCenter) {
        hasCompletedStack.current = false
      }

      if (isActive) {
        e.preventDefault()
        const navigationComplete = await handleStackNavigation(
          scrollingDown,
          deltaY
        )
        if (navigationComplete) {
          touchStart.current = touchY
        }
      }
    }

    const handleTouchEnd = () => {
      touchStart.current = null
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isActive, currentIndex, children.length])

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
        className="relative w-full overflow-hidden"
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
