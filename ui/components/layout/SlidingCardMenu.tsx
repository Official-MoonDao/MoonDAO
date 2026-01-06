// components/SlidingCardMenu.tsx
import React, { useEffect, useRef, useState } from 'react'

interface SlidingCardMenuProps {
  id?: string
  children: React.ReactNode
}

const SlidingCardMenu: React.FC<SlidingCardMenuProps> = ({ id, children }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isHorizontalScrolling, setIsHorizontalScrolling] = useState(false)
  const [hasStoppedVerticalScroll, setHasStoppedVerticalScroll] =
    useState(false)

  const isElementInViewport = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const container = containerRef.current
      const parent = parentRef.current

      if (!container || !parent) return

      const isDesktopOrTablet = window.innerWidth > 768 // Adjust the width as needed for tablet breakpoint

      const inViewport = isElementInViewport(parent)

      if (isHovered && isDesktopOrTablet && inViewport) {
        if (Math.abs(e.deltaY) === 0) {
          setHasStoppedVerticalScroll(true)
        } else if (isHorizontalScrolling) {
          setHasStoppedVerticalScroll(false)
        }

        if (hasStoppedVerticalScroll) {
          const { scrollLeft, scrollWidth, clientWidth } = container
          const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 2
          const isAtStart = scrollLeft <= 0

          if (
            (e.deltaY > 0 && isAtEnd) || // Scrolling down at the end
            (e.deltaY < 0 && isAtStart) // Scrolling up at the start
          ) {
            // Allow vertical scrolling
            setIsHorizontalScrolling(false)
            return
          }

          // Otherwise, scroll horizontally
          e.preventDefault()
          container.scrollLeft += e.deltaY
          setIsHorizontalScrolling(true)
        }
      } else {
        setIsHorizontalScrolling(false)
      }
    }

    const handleMouseEnter = () => setIsHovered(true)
    const handleMouseLeave = () => {
      setIsHovered(false)
      setIsHorizontalScrolling(false)
      document.body.style.overflowY = 'auto' // Re-enable vertical scrolling when mouse leaves
    }

    const parent = parentRef.current
    if (parent) {
      parent.addEventListener('mouseenter', handleMouseEnter)
      parent.addEventListener('mouseleave', handleMouseLeave)
    }

    document.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      if (parent) {
        parent.removeEventListener('mouseenter', handleMouseEnter)
        parent.removeEventListener('mouseleave', handleMouseLeave)
      }
      document.removeEventListener('wheel', handleWheel)
      document.body.style.overflowY = 'auto' // Ensure vertical scrolling is enabled on cleanup
    }
  }, [isHovered])

  useEffect(() => {
    if (isHorizontalScrolling) {
      document.body.style.overflowY = 'hidden'
    } else {
      document.body.style.overflowY = 'auto'
    }
  }, [isHorizontalScrolling])

  return (
    <div
      id={id}
      ref={parentRef}
      className="flex justify-center md:justify-start relative rounded-tl-[20px] rounded-bl-[5vmax] p-4"
    >
      <div
        ref={containerRef}
        className="pr-8 flex overflow-x-auto overflow-y-hidden"
        style={{ msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  )
}

export default SlidingCardMenu
