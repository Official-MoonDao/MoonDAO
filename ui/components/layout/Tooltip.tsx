import gsap from 'gsap'
import { useState, useEffect, useRef } from 'react'

export type TooltipProps = {
  text: string
  children: React.ReactNode
  disabled?: boolean
  buttonClassName?: string
  wrap?: boolean
}

export default function Tooltip({
  text,
  children,
  disabled,
  buttonClassName,
  wrap = false,
}: TooltipProps) {
  const [isHovered, setIsHovered] = useState(false)

  const tooltipRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHovered && tooltipRef.current) {
      gsap.fromTo(
        tooltipRef.current,
        {
          scale: 0.7,
          opacity: 0,
          y: -10,
        },
        {
          scale: 1,
          opacity: 1,
          y: -20,
          duration: 0.3,
          ease: 'back.out(1.7)',
        }
      )
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

      {!disabled && isHovered && (
        <div
          id="tooltip"
          ref={tooltipRef}
          className="absolute bottom-full pointer-events-none text-sm max-w-[300px] md:max-w-[500px]"
          style={{
            opacity: 1,
            zIndex: 1000,
            transform: 'translateX(-50%) translateY(-20px)',
            left: '50%',
            transformOrigin: 'top center',
          }}
        >
          <div className="w-max max-w-[300px] md:max-w-[400px] bg-white text-black px-3 py-2 rounded-[1vmax] break-words inline-block">
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
        </div>
      )}
      {wrap && children}
    </div>
  )
}
