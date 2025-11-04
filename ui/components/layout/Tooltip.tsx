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
  const [contentOffset, setContentOffset] = useState(0)

  const tooltipRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHovered && contentRef.current && triggerRef.current) {
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

      if (tooltipRef.current) {
        gsap.fromTo(
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
    }
  }, [isHovered])

  return (
    <div
      className={`relative ${wrap ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => {
        if (!wrap) return
        setIsHovered(true)
      }}
      onMouseLeave={() => {
        if (!wrap) return
        setIsHovered(false)
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
            setIsHovered(true)
          }}
          onMouseLeave={() => {
            setIsHovered(false)
          }}
        >
          {children}
        </div>
      )}

      {wrap && <div ref={triggerRef}>{children}</div>}

      {!disabled && isHovered && (
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
            }  bg-white text-black px-3 py-2 rounded-[1vmax] break-words`}
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
