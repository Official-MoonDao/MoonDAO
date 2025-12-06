import React, { useEffect, useRef, useMemo, useState } from 'react'

interface Star {
  x: number
  y: number
  size: number
  baseOpacity: number
  twinkleIntensity: number
  twinkleDuration: number
  twinkleDelay: number
}

interface ShootingStar {
  id: number
  startX: number
  startY: number
  angle: number
}

const generateStars = (count: number, sizeRange: [number, number], seed: number = 0): Star[] => {
  const stars: Star[] = []
  const rng = (n: number) => {
    const x = Math.sin(n + seed) * 10000
    return x - Math.floor(x)
  }

  for (let i = 0; i < count; i++) {
    const x = rng(i * 0.1) * 100
    const y = rng(i * 0.1 + 1000) * 100
    const rand = rng(i * 0.1 + 2000)
    const size =
      rand < 0.9
        ? sizeRange[0] + rand * 0.3 * (sizeRange[1] - sizeRange[0])
        : sizeRange[0] + (0.3 + rand * 0.7) * (sizeRange[1] - sizeRange[0])

    const opacityRand = rng(i * 0.1 + 3000)
    const baseOpacity = opacityRand < 0.7 ? 0.3 + opacityRand * 0.4 : 0.7 + opacityRand * 0.3

    const twinkleRand = rng(i * 0.1 + 4000)
    const twinkleIntensity = twinkleRand < 0.85 ? 0.05 + twinkleRand * 0.1 : 0.2 + twinkleRand * 0.2

    const durationRand = rng(i * 0.1 + 5000)
    const twinkleDuration = 3 + durationRand * 5

    const delayRand = rng(i * 0.1 + 6000)
    const twinkleDelay = delayRand * 10

    stars.push({
      x,
      y,
      size,
      baseOpacity,
      twinkleIntensity,
      twinkleDuration,
      twinkleDelay,
    })
  }
  return stars
}

export default function SpaceBackground() {
  const farStars = useMemo(() => generateStars(200, [0.5, 1], 1), [])
  const midStars = useMemo(() => generateStars(150, [1, 1.5], 2), [])
  const nearStars = useMemo(() => generateStars(100, [1.5, 2.5], 3), [])
  const containerRef = useRef<HTMLDivElement>(null)
  const farStarsRef = useRef<HTMLDivElement>(null)
  const midStarsRef = useRef<HTMLDivElement>(null)
  const nearStarsRef = useRef<HTMLDivElement>(null)
  const nebulaRef = useRef<HTMLDivElement>(null)
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([])
  const shootingStarIdRef = useRef(0)
  const typedSequenceRef = useRef('')
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const renderStarLayer = (stars: Star[], layerName: string) => {
    const layerRef =
      layerName === 'far' ? farStarsRef : layerName === 'mid' ? midStarsRef : nearStarsRef
    return (
      <div
        ref={layerRef}
        className="absolute inset-0 w-full h-full"
        style={{
          willChange: 'transform',
          transition: 'transform 0.1s ease-out',
        }}
      >
        {stars.map((star, index) => {
          const minOpacity = Math.max(0, star.baseOpacity - star.twinkleIntensity)
          const maxOpacity = Math.min(1, star.baseOpacity + star.twinkleIntensity)
          const isSubtle = star.twinkleIntensity < 0.15
          const animationName = isSubtle ? 'twinkle-subtle' : 'twinkle-pronounced'

          return (
            <div
              key={`${layerName}-${index}`}
              className="absolute rounded-full star-twinkle"
              style={
                {
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  background: `radial-gradient(circle, rgba(255,255,255,1) 0%, transparent 70%)`,
                  boxShadow: `0 0 ${star.size * 0.5}px rgba(255,255,255,0.5)`,
                  animation: `${animationName} ${star.twinkleDuration}s ease-in-out infinite`,
                  animationDelay: `${star.twinkleDelay}s`,
                  transform: 'translate(-50%, -50%)',
                  willChange: 'opacity',
                  '--min-opacity': minOpacity,
                  '--max-opacity': maxOpacity,
                } as React.CSSProperties & { '--min-opacity': number; '--max-opacity': number }
              }
            />
          )
        })}
      </div>
    )
  }

  useEffect(() => {
    let animationFrame: number

    const handleScroll = () => {
      if (!containerRef.current) return

      const scrolled = window.scrollY

      // Subtle parallax
      if (farStarsRef.current) {
        const yPos = scrolled * 0.01
        farStarsRef.current.style.transform = `translate3d(0, ${yPos}px, 0)`
      }

      if (midStarsRef.current) {
        const yPos = scrolled * 0.02
        midStarsRef.current.style.transform = `translate3d(0, ${yPos}px, 0)`
      }

      if (nearStarsRef.current) {
        const yPos = scrolled * 0.03
        nearStarsRef.current.style.transform = `translate3d(0, ${yPos}px, 0)`
      }

      if (nebulaRef.current) {
        const yPos = scrolled * 0.015
        nebulaRef.current.style.transform = `translate3d(0, ${yPos}px, 0)`
      }
    }

    const animate = () => {
      handleScroll()
      animationFrame = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [])

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
    }, 1800)
  }

  useEffect(() => {
    const scheduleNext = () => {
      const delay = 20000 + Math.random() * 20000
      setTimeout(() => {
        const isShower = Math.random() < 0.18
        const count = isShower ? 2 + Math.floor(Math.random() * 2) : 1

        if (isShower) {
          const side = Math.floor(Math.random() * 4)
          let baseX = 0
          let baseY = 0
          let baseAngle = 0

          if (side === 0) {
            baseX = Math.random() * 100
            baseY = -5
            baseAngle = 135 + Math.random() * 30
          } else if (side === 1) {
            baseX = 105
            baseY = Math.random() * 100
            baseAngle = 225 + Math.random() * 30
          } else if (side === 2) {
            baseX = Math.random() * 100
            baseY = 105
            baseAngle = 315 + Math.random() * 30
          } else {
            baseX = -5
            baseY = Math.random() * 100
            baseAngle = 45 + Math.random() * 30
          }

          for (let i = 0; i < count; i++) {
            setTimeout(() => {
              createShootingStar(baseX, baseY, baseAngle)
            }, i * (150 + Math.random() * 200))
          }
        } else {
          createShootingStar()
        }

        scheduleNext()
      }, delay)
    }

    scheduleNext()
  }, [])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      if (key.length === 1 && /[a-z]/.test(key)) {
        typedSequenceRef.current += key

        if (sequenceTimeoutRef.current) {
          clearTimeout(sequenceTimeoutRef.current)
        }

        if (typedSequenceRef.current === 'moondao') {
          const isShower = Math.random() < 0.25
          const count = isShower ? 2 + Math.floor(Math.random() * 2) : 1

          if (isShower) {
            const side = Math.floor(Math.random() * 4)
            let baseX = 0
            let baseY = 0
            let baseAngle = 0

            if (side === 0) {
              baseX = Math.random() * 100
              baseY = -5
              baseAngle = 135 + Math.random() * 30
            } else if (side === 1) {
              baseX = 105
              baseY = Math.random() * 100
              baseAngle = 225 + Math.random() * 30
            } else if (side === 2) {
              baseX = Math.random() * 100
              baseY = 105
              baseAngle = 315 + Math.random() * 30
            } else {
              baseX = -5
              baseY = Math.random() * 100
              baseAngle = 45 + Math.random() * 30
            }

            for (let i = 0; i < count; i++) {
              setTimeout(() => {
                createShootingStar(baseX, baseY, baseAngle)
              }, i * (150 + Math.random() * 200))
            }
          } else {
            createShootingStar()
          }
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
      className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0"
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
    >
      {/* Base gradient layer - deep space fade */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          background: `linear-gradient(
            180deg,
            #182254 0%,
            #0f1629 15%,
            #080c20 40%,
            #040617 70%,
            #000000 100%
          )`,
        }}
      />

      {/* Far stars layer - almost stationary, tiny stars, most numerous */}
      {renderStarLayer(farStars, 'far')}

      {/* Mid stars layer - very slow movement, small stars */}
      {renderStarLayer(midStars, 'mid')}

      {/* Near stars layer - subtle movement, slightly larger stars */}
      {renderStarLayer(nearStars, 'near')}

      {/* Shooting stars */}
      {shootingStars.map((shootingStar) => (
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

      {/* Nebula-like depth clouds */}
      <div
        ref={nebulaRef}
        className="absolute inset-0 w-full h-full opacity-25"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 60%, rgba(24, 34, 84, 0.3), transparent),
            radial-gradient(ellipse 50% 35% at 80% 75%, rgba(8, 12, 32, 0.25), transparent),
            radial-gradient(ellipse 45% 30% at 50% 85%, rgba(4, 6, 23, 0.4), transparent),
            radial-gradient(ellipse 40% 25% at 35% 50%, rgba(15, 22, 41, 0.2), transparent)
          `,
          willChange: 'transform',
          transition: 'transform 0.1s linear',
        }}
      />

      {/* Deep space fade overlay - enhances depth perception at bottom */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          background: `linear-gradient(
            180deg,
            transparent 0%,
            transparent 40%,
            rgba(0, 0, 0, 0.2) 70%,
            rgba(0, 0, 0, 0.5) 90%,
            rgba(0, 0, 0, 0.8) 100%
          )`,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
