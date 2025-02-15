import gsap from 'gsap'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type TooltipProps = {
  text: string
  children: React.ReactNode
}

export default function Tooltip({ text, children }: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false)

  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const portalContainer =
      document.getElementById('portal-root') || document.body
    setContainer(portalContainer)
  }, [])

  useEffect(() => {
    if (isHovered && tooltipRef.current && triggerRef.current) {
      // Force a render cycle to get correct measurements
      const tooltipHeight = tooltipRef.current.offsetHeight
      const rect = triggerRef.current.getBoundingClientRect()

      const top = rect.top - tooltipHeight - 20
      const left = rect.left + rect.width / 2

      // Position the tooltip at the icon's position initially
      tooltipRef.current.style.top = `${rect.top}px`
      tooltipRef.current.style.left = `${left}px`
      tooltipRef.current.style.opacity = '0'
      tooltipRef.current.style.transform = 'translate(-50%, 0) scale(0.8)'

      // Animate to final position
      requestAnimationFrame(() => {
        gsap.to(tooltipRef.current, {
          top,
          opacity: 1,
          scale: 1,
          duration: 0.25,
          ease: 'back.out(1.2)',
        })
      })
    }
  }, [isHovered])

  return (
    <div className="relative inline-block">
      <div
        id="tooltip-icon"
        ref={triggerRef}
        className={`flex justify-center items-center cursor-pointer h-6 w-6 bg-white rounded-full font-GoodTimes text-black text-xl pl-[1.5px] ${
          isHovered ? 'opacity-100' : 'opacity-50'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
        }}
      >
        {children}
      </div>

      {isHovered &&
        container &&
        createPortal(
          <div
            id="tooltip"
            ref={tooltipRef}
            className="fixed pointer-events-none text-sm"
            style={{
              position: 'fixed',
              opacity: 0,
              transformOrigin: 'bottom center',
            }}
          >
            <div className="bg-white text-black px-3 py-2 rounded-[1vmax] max-w-[250px] md:max-w-[500px]">
              <p>{text}</p>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[-1]">
                <svg width="32" height="24" viewBox="0 0 32 24" fill="white">
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
          </div>,
          container
        )}
    </div>
  )
}
