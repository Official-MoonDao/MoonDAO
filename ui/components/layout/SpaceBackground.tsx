import React, { useEffect, useRef, useMemo, useState } from 'react'
import { useAnimationFrameWithVisibility } from '@/lib/utils/hooks/usePageVisibility'

interface ShootingStar {
  id: number
  startX: number
  startY: number
  angle: number
}

export default function SpaceBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const { isPageVisible, rafRef, cancelRAF } = useAnimationFrameWithVisibility()
  const lastScrollY = useRef(0)
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([])
  const shootingStarIdRef = useRef(0)
  const typedSequenceRef = useRef('')
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!isPageVisible) return

    const handleScroll = () => {
      if (!containerRef.current || !isPageVisible) return

      const scrolled = window.scrollY

      if (Math.abs(scrolled - lastScrollY.current) < 2) {
        rafRef.current = requestAnimationFrame(handleScroll)
        return
      }

      lastScrollY.current = scrolled

      if (gridRef.current) {
        const yPos = scrolled * 0.15
        gridRef.current.style.transform = `translate3d(0, ${yPos}px, 0)`
      }

      rafRef.current = requestAnimationFrame(handleScroll)
    }

    rafRef.current = requestAnimationFrame(handleScroll)

    return () => {
      cancelRAF()
    }
  }, [isPageVisible, cancelRAF, rafRef])

  const createShootingStar = (baseX?: number, baseY?: number, baseAngle?: number) => {
    const side = Math.floor(Math.random() * 4)
    let startX = 0
    let startY = 0
    let angle = 0

    if (baseX !== undefined && baseY !== undefined && baseAngle !== undefined) {
      startX = baseX + (Math.random() - 0.5) * 15
      startY = baseY + (Math.random() - 0.5) * 15
      angle = baseAngle + (Math.random() - 0.5) * 20
    } else {
      if (side === 0) {
        startX = Math.random() * 100
        startY = -5
        angle = 135 + Math.random() * 30
      } else if (side === 1) {
        startX = 105
        startY = Math.random() * 100
        angle = 225 + Math.random() * 30
      } else if (side === 2) {
        startX = Math.random() * 100
        startY = 105
        angle = 315 + Math.random() * 30
      } else {
        startX = -5
        startY = Math.random() * 100
        angle = 45 + Math.random() * 30
      }
    }

    const newShootingStar: ShootingStar = {
      id: shootingStarIdRef.current++,
      startX,
      startY,
      angle,
    }

    setShootingStars((prev) => [...prev, newShootingStar])

    setTimeout(() => {
      setShootingStars((prev) => prev.filter((star) => star.id !== newShootingStar.id))
    }, 2800)
  }

  useEffect(() => {
    if (!isPageVisible) return

    const scheduleNext = () => {
      if (!isPageVisible) return

      const delay = 60000 + Math.random() * 60000
      const timeoutId = setTimeout(() => {
        if (!isPageVisible) return

        const isShower = Math.random() < 0.04
        const count = isShower ? 2 : 1

        if (isShower) {
          const side = Math.floor(Math.random() * 4)
          let baseX = 0
          let baseY = 0
          let baseAngle = 0

          if (side === 0) {
            baseX = Math.random() * 100; baseY = -5; baseAngle = 135 + Math.random() * 30
          } else if (side === 1) {
            baseX = 105; baseY = Math.random() * 100; baseAngle = 225 + Math.random() * 30
          } else if (side === 2) {
            baseX = Math.random() * 100; baseY = 105; baseAngle = 315 + Math.random() * 30
          } else {
            baseX = -5; baseY = Math.random() * 100; baseAngle = 45 + Math.random() * 30
          }

          for (let i = 0; i < count; i++) {
            setTimeout(() => {
              if (isPageVisible) createShootingStar(baseX, baseY, baseAngle)
            }, i * (150 + Math.random() * 200))
          }
        } else {
          createShootingStar()
        }

        scheduleNext()
      }, delay)

      return () => clearTimeout(timeoutId)
    }

    const cleanup = scheduleNext()
    return cleanup
  }, [isPageVisible])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!e.key) return
      const key = e.key.toLowerCase()

      if (key.length === 1 && /[a-z]/.test(key)) {
        typedSequenceRef.current += key

        if (sequenceTimeoutRef.current) {
          clearTimeout(sequenceTimeoutRef.current)
        }

        if (typedSequenceRef.current === 'moondao') {
          createShootingStar()
          typedSequenceRef.current = ''
        } else if (typedSequenceRef.current.length >= 7) {
          typedSequenceRef.current = typedSequenceRef.current.slice(-6)
        }

        sequenceTimeoutRef.current = setTimeout(() => {
          typedSequenceRef.current = ''
        }, 2000)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      style={{
        width: '100vw',
        height: '100vh',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#050505',
      }}
    >
      {/* Retro perspective grid floor */}
      <div
        ref={gridRef}
        className="absolute w-full"
        style={{
          bottom: '-20vh',
          left: 0,
          right: 0,
          height: '70vh',
          perspective: '400px',
          perspectiveOrigin: '50% 0%',
          willChange: 'transform',
          transition: 'transform 0.1s ease-out',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '200%',
            height: '200%',
            left: '-50%',
            top: '0',
            transform: 'rotateX(65deg)',
            transformOrigin: 'center top',
            backgroundImage: `
              linear-gradient(rgba(0, 255, 200, 0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 200, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 20%, rgba(0,0,0,1) 60%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 20%, rgba(0,0,0,1) 60%)',
          }}
        />
        {/* Horizon glow line */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(0, 255, 200, 0.4) 20%, rgba(0, 229, 255, 0.6) 50%, rgba(0, 255, 200, 0.4) 80%, transparent)',
            boxShadow: '0 0 30px rgba(0, 255, 200, 0.3), 0 0 60px rgba(0, 229, 255, 0.15)',
          }}
        />
      </div>

      {/* Ambient vertical grid lines (subtle, fixed) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(0, 255, 200, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '120px 100%',
        }}
      />

      {/* Ambient horizontal scan reference lines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(0deg, rgba(0, 255, 200, 0.015) 1px, transparent 1px)
          `,
          backgroundSize: '100% 200px',
        }}
      />

      {/* Shooting stars */}
      {isPageVisible &&
        shootingStars.map((shootingStar) => (
          <div
            key={shootingStar.id}
            className="absolute inset-0 w-full h-full shooting-star"
            style={
              {
                '--start-x': `${shootingStar.startX}%`,
                '--start-y': `${shootingStar.startY}%`,
                '--angle': `${shootingStar.angle}deg`,
              } as React.CSSProperties & {
                '--start-x': string
                '--start-y': string
                '--angle': string
              }
            }
          >
            <div className="shooting-star-trail" />
            <div className="shooting-star-head" />
          </div>
        ))}

      {/* Retro nebula - subtle colored atmospheric glow */}
      <div
        className="absolute w-full h-full opacity-40"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 20%, rgba(123, 47, 255, 0.08) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 30%, rgba(0, 229, 255, 0.06) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 50% 80%, rgba(255, 42, 109, 0.05) 0%, transparent 70%),
            radial-gradient(ellipse 50% 30% at 10% 70%, rgba(0, 255, 200, 0.04) 0%, transparent 60%)
          `,
        }}
      />

      {/* Top fade to pure black */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: '30vh',
          background: 'linear-gradient(180deg, #050505 0%, transparent 100%)',
        }}
      />

      {/* ===== HUD OVERLAY ELEMENTS ===== */}

      {/* Bottom-left: animated bar graph */}
      <div
        className="absolute hidden lg:flex items-end gap-[3px]"
        style={{
          bottom: '40px',
          left: '30px',
          height: '60px',
          opacity: 0.25,
        }}
      >
        {[6.5, 4.2, 8.1, 5.5, 7.3, 3.8, 9.0, 6.0, 4.8, 7.8, 5.2, 8.5, 3.5, 6.8, 7.0, 4.5].map((_, i) => (
          <div
            key={`bar-${i}`}
            style={{
              width: '3px',
              backgroundColor: i % 3 === 0 ? '#ff9f1c' : '#00ffc8',
              animation: `hud-bar-cycle${i % 3 === 0 ? '-2' : i % 3 === 1 ? '-3' : ''} ${5 + i * 0.7}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              borderRadius: '1px 1px 0 0',
            }}
          />
        ))}
      </div>

      {/* Bottom-left: label under bars */}
      <div
        className="absolute hidden lg:block"
        style={{
          bottom: '22px',
          left: '30px',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '8px',
          color: '#00ffc8',
          opacity: 0.2,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          animation: 'hudBlink 6s ease-in-out infinite',
        }}
      >
        SYS.TELEMETRY
      </div>

      {/* Bottom-right: waveform SVG */}
      <svg
        className="absolute hidden lg:block"
        style={{
          bottom: '35px',
          right: '30px',
          opacity: 0.2,
        }}
        width="120"
        height="40"
        viewBox="0 0 120 40"
      >
        <path
          d="M0,20 Q5,5 10,20 T20,20 T30,20 T40,20 T50,20 T60,20 T70,20 T80,20 T90,20 T100,20 T110,20 T120,20"
          fill="none"
          stroke="#00ffc8"
          strokeWidth="1"
          style={{
            animation: 'hud-graph-wave 6s ease-in-out infinite',
          }}
        />
        <path
          d="M0,20 Q8,12 16,20 T32,20 T48,20 T64,20 T80,20 T96,20 T112,20 T120,20"
          fill="none"
          stroke="#ff2a6d"
          strokeWidth="0.5"
          opacity="0.5"
          style={{
            animation: 'hud-graph-wave 8s ease-in-out infinite reverse',
          }}
        />
        {/* baseline */}
        <line x1="0" y1="20" x2="120" y2="20" stroke="#00ffc8" strokeWidth="0.3" opacity="0.3" />
      </svg>

      {/* Bottom-right: waveform label */}
      <div
        className="absolute hidden lg:block"
        style={{
          bottom: '22px',
          right: '30px',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '8px',
          color: '#ff2a6d',
          opacity: 0.2,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          animation: 'hudBlink 5s ease-in-out infinite',
          animationDelay: '1s',
        }}
      >
        FREQ.ANALYSIS
      </div>

      {/* Top-right: rotating ring indicator */}
      <svg
        className="absolute hidden xl:block"
        style={{
          top: '80px',
          right: '30px',
          opacity: 0.12,
        }}
        width="50"
        height="50"
        viewBox="0 0 50 50"
      >
        <circle cx="25" cy="25" r="20" fill="none" stroke="#00ffc8" strokeWidth="0.5" opacity="0.4" />
        <circle cx="25" cy="25" r="15" fill="none" stroke="#00ffc8" strokeWidth="0.3" opacity="0.3" strokeDasharray="4 3" style={{ animation: 'hud-ring-rotate 12s linear infinite' , transformOrigin: '25px 25px' }} />
        <circle cx="25" cy="25" r="10" fill="none" stroke="#ff9f1c" strokeWidth="0.3" opacity="0.3" strokeDasharray="2 4" style={{ animation: 'hud-ring-rotate 8s linear infinite reverse', transformOrigin: '25px 25px' }} />
        <circle cx="25" cy="5" r="1.5" fill="#00ffc8" style={{ animation: 'hud-dot-pulse 3s ease-in-out infinite', transformOrigin: '25px 25px' }} />
        <line x1="25" y1="15" x2="25" y2="18" stroke="#00ffc8" strokeWidth="0.5" opacity="0.5" />
        <line x1="25" y1="32" x2="25" y2="35" stroke="#00ffc8" strokeWidth="0.5" opacity="0.5" />
        <line x1="15" y1="25" x2="18" y2="25" stroke="#00ffc8" strokeWidth="0.5" opacity="0.5" />
        <line x1="32" y1="25" x2="35" y2="25" stroke="#00ffc8" strokeWidth="0.5" opacity="0.5" />
      </svg>

      {/* Top-right: status readout */}
      <div
        className="absolute hidden xl:block"
        style={{
          top: '140px',
          right: '25px',
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: '7px',
          color: '#00ffc8',
          opacity: 0.15,
          letterSpacing: '1px',
          lineHeight: '1.8',
          textAlign: 'right',
        }}
      >
        <div style={{ animation: 'hud-number-blink 4s ease-in-out infinite' }}>AZ 127.4°</div>
        <div style={{ animation: 'hud-number-blink 4s ease-in-out infinite', animationDelay: '0.5s' }}>EL 34.8°</div>
        <div style={{ color: '#ff9f1c', animation: 'hud-number-blink 5s ease-in-out infinite', animationDelay: '1s' }}>RNG 384400 KM</div>
      </div>

      {/* Slow horizontal scan line that sweeps down the viewport */}
      <div
        className="absolute left-0 right-0"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 255, 200, 0.15) 20%, rgba(0, 255, 200, 0.3) 50%, rgba(0, 255, 200, 0.15) 80%, transparent 100%)',
          boxShadow: '0 0 10px rgba(0, 255, 200, 0.1), 0 0 30px rgba(0, 255, 200, 0.05)',
          animation: 'hud-scanline 12s linear infinite',
        }}
      />

      {/* Corner brackets - top left */}
      <div
        className="absolute hidden lg:block"
        style={{
          top: '70px',
          left: '20px',
          width: '30px',
          height: '30px',
          borderLeft: '1px solid rgba(0, 255, 200, 0.15)',
          borderTop: '1px solid rgba(0, 255, 200, 0.15)',
          animation: 'hud-crosshair-pulse 6s ease-in-out infinite',
        }}
      />

      {/* Corner brackets - bottom right */}
      <div
        className="absolute hidden lg:block"
        style={{
          bottom: '100px',
          right: '20px',
          width: '30px',
          height: '30px',
          borderRight: '1px solid rgba(0, 255, 200, 0.15)',
          borderBottom: '1px solid rgba(0, 255, 200, 0.15)',
          animation: 'hud-crosshair-pulse 6s ease-in-out infinite',
          animationDelay: '3s',
        }}
      />
    </div>
  )
}
