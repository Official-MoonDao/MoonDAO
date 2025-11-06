import gsap from 'gsap'
import { useState, useEffect, useRef } from 'react'

export type TooltipProps = {
  text: string
  children: React.ReactNode
  disabled?: boolean
  buttonClassName?: string
  compact?: boolean
  wrap?: boolean
}

export default function Tooltip({
  text,
  children,
  disabled,
  buttonClassName,
  compact,
  wrap = false,
}: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [contentOffset, setContentOffset] = useState(0)

  const tooltipRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<gsap.core.Tween | null>(null)
  const [isTouched, setIsTouched] = useState(false)

  useEffect(() => {
    if (isHovered) {
      setIsVisible(true)
    }
  }, [isHovered])

  // Handle animation and position
  useEffect(() => {
    if (
      isHovered &&
      isVisible &&
      contentRef.current &&
      triggerRef.current &&
      tooltipRef.current
    ) {
      const contentRect = contentRef.current.getBoundingClientRect()
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const padding = 16

      // Calculate how much the content box would overflow
      const triggerCenter = triggerRect.left + triggerRect.width / 2
      const contentLeft = triggerCenter - contentRect.width / 2
      const contentRight = triggerCenter + contentRect.width / 2

      let offset = 0

      // If overflowing left, shift right
      if (contentLeft < padding) {
        offset = padding - contentLeft
      }
      // If overflowing right, shift left
      else if (contentRight > viewportWidth - padding) {
        offset = viewportWidth - padding - contentRight
      }

      setContentOffset(offset)

      if (animationRef.current) {
        animationRef.current.kill()
      }

      animationRef.current = gsap.fromTo(
        tooltipRef.current,
        {
          scale: 0.7,
          opacity: 0,
          y: -10 * (compact ? 0.5 : 1),
        },
        {
          scale: 1,
          opacity: 1,
          y: -20 * (compact ? 0.5 : 1),
          duration: 0.3,
          ease: 'back.out(1.7)',
        }
      )
    }
  }, [isHovered, isVisible, compact])

  // Handle exit animation
  useEffect(() => {
    if (!isHovered && isVisible && tooltipRef.current) {
      // Exit animation
      if (animationRef.current) {
        animationRef.current.kill()
      }

      const yOffset = -20 * (compact ? 0.5 : 1)

      animationRef.current = gsap.to(tooltipRef.current, {
        scale: 0.7,
        opacity: 0,
        y: yOffset - 10,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          setIsVisible(false)
          animationRef.current = null
        },
      })
    }
  }, [isHovered, isVisible, compact])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.kill()
      }
    }
  }, [])

  // Handle click outside to close tooltip when manually opened
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        isTouched &&
        isVisible
      ) {
        setIsHovered(false)
        setIsTouched(false)
      }
    }

    if (isTouched && isVisible) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true)
        document.addEventListener('touchstart', handleClickOutside, true)
      }, 100)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside, true)
        document.removeEventListener('touchstart', handleClickOutside, true)
      }
    }
  }, [isTouched, isVisible])

  // Handle toggle on mobile (touch)
  const handleTriggerTouch = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isHovered && isTouched) {
      setIsHovered(false)
      setIsTouched(false)
    } else {
      // Open if closed
      setIsHovered(true)
      setIsTouched(true)
    }
  }

  // Handle toggle on desktop (click)
  const handleTriggerClick = (e: React.MouseEvent) => {
    const isTouchDevice =
      'ontouchstart' in window || navigator.maxTouchPoints > 0

    if (!isTouchDevice) {
      if (isHovered && isTouched) {
        setIsHovered(false)
        setIsTouched(false)
      } else {
        setIsHovered(true)
        setIsTouched(true)
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${wrap ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => {
        if (!wrap) return
        const isTouchDevice =
          'ontouchstart' in window || navigator.maxTouchPoints > 0
        if (!isTouchDevice || !isTouched) {
          setIsHovered(true)
        }
      }}
      onMouseLeave={() => {
        if (!wrap) return
        if (!isTouched) {
          setIsHovered(false)
        }
      }}
    >
      {!wrap && (
        <div
          id="tooltip-icon"
          ref={triggerRef}
          className={`flex justify-center items-center h-6 w-6 bg-white rounded-full font-GoodTimes text-black pl-[1.5px] ${buttonClassName} ${
            !disabled && isHovered ? 'opacity-100' : 'opacity-50'
          } ${!disabled && 'cursor-pointer'}`}
          onMouseEnter={() => {
            // Only allow hover on non-touch devices or when not manually opened
            const isTouchDevice =
              'ontouchstart' in window || navigator.maxTouchPoints > 0
            if (!isTouchDevice || !isTouched) {
              setIsHovered(true)
            }
          }}
          onMouseLeave={() => {
            // Only close on hover leave if not manually opened
            if (!isTouched) {
              setIsHovered(false)
            }
          }}
          onClick={handleTriggerClick}
          onTouchStart={handleTriggerTouch}
        >
          {children}
        </div>
      )}

      {wrap && (
        <div
          ref={triggerRef}
          onClick={handleTriggerClick}
          onTouchStart={handleTriggerTouch}
        >
          {children}
        </div>
      )}

      {!disabled && isVisible && (
        <div
          id="tooltip"
          ref={tooltipRef}
          className="absolute bottom-full left-1/2 pointer-events-none text-sm"
          style={{
            opacity: 1,
            zIndex: 1000,
            transform: 'translateX(-50%) translateY(-20px)',
            transformOrigin: 'bottom center',
          }}
        >
          <div
            ref={contentRef}
            className={`w-max ${
              compact
                ? 'max-w-[85vw] md:max-w-[400px]'
                : 'max-w-[85vw] md:max-w-[200px]'
            }  bg-white text-black px-3 py-2 rounded-[1vmax] break-words pointer-events-auto`}
            style={{ transform: `translateX(${contentOffset}px)` }}
          >
            <p>{text}</p>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[-1]">
            <svg
              width="32"
              height="24"
              viewBox="0 0 32 24"
              fill="white"
              className={compact ? 'scale-75' : ''}
            >
              <path
                d="M0,4 
                   Q0,0 4,0
                   L28,0
                   Q32,0 32,4
                   L18,22
                   Q16,24 14,22
                   L0,4"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
