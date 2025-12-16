import React, { useEffect, useRef, useMemo, useState } from 'react'
import { useAnimationFrameWithVisibility } from '@/lib/utils/hooks/usePageVisibility'

interface Star {
  x: number
  y: number
  size: number
  baseOpacity: number
  twinkleIntensity: number
  twinkleDuration: number
  twinkleDelay: number
  isBright: boolean
  colorTint: [number, number, number]
  pulseDelay: number
}

interface ShootingStar {
  id: number
  startX: number
  startY: number
  angle: number
}

const generateStars = (
  count: number,
  sizeRange: [number, number],
  seed: number = 0,
  colorTintBase: [number, number, number] = [255, 255, 255],
  existingStars: Star[] = []
): Star[] => {
  const stars: Star[] = []
  const minDistance = 9.0
  const minXDistance = 5.5
  const minYDistance = 5.5
  const rng = (n: number) => {
    const x = Math.sin(n + seed) * 10000
    return x - Math.floor(x)
  }

  for (let i = 0; i < count; i++) {
    let x = rng(i * 0.1) * 100
    let y = rng(i * 0.1 + 1000) * 100
    let validPosition = false
    let attempts = 0

    while (!validPosition && attempts < 300) {
      const testX = rng(i * 0.1 + attempts * 0.035) * 100
      const testY = rng(i * 0.1 + 1000 + attempts * 0.035) * 100

      const allStarsToCheck = [...stars, ...existingStars]
      validPosition =
        allStarsToCheck.length === 0 ||
        allStarsToCheck.every((star) => {
          const dx = Math.abs(testX - star.x)
          const dy = Math.abs(testY - star.y)
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < minDistance) {
            return false
          }

          if (dx < minXDistance) {
            return false
          }

          if (dy < minYDistance) {
            return false
          }

          return true
        })

      if (validPosition) {
        x = testX
        y = testY
      }

      attempts++
    }

    if (!validPosition) {
      x = rng(i * 0.1 + 5000 + i) * 100
      y = rng(i * 0.1 + 6000 + i) * 100
    }
    const rand = rng(i * 0.1 + 2000)

    const isBrightStar = rand < 0.08
    let size: number

    if (isBrightStar) {
      const brightSizeRange: [number, number] = [
        Math.max(4, sizeRange[1] * 1.5),
        Math.max(8, sizeRange[1] * 3),
      ]
      const brightRand = rng(i * 0.1 + 7000)
      size = brightSizeRange[0] + brightRand * (brightSizeRange[1] - brightSizeRange[0])
    } else {
      size =
        rand < 0.9
          ? sizeRange[0] + rand * 0.3 * (sizeRange[1] - sizeRange[0])
          : sizeRange[0] + (0.3 + rand * 0.7) * (sizeRange[1] - sizeRange[0])
    }

    const opacityRand = rng(i * 0.1 + 3000)
    const baseOpacity = isBrightStar
      ? 0.7 + opacityRand * 0.3
      : opacityRand < 0.7
      ? 0.3 + opacityRand * 0.4
      : 0.7 + opacityRand * 0.3

    const twinkleRand = rng(i * 0.1 + 4000)
    const twinkleIntensity = twinkleRand < 0.85 ? 0.05 + twinkleRand * 0.1 : 0.2 + twinkleRand * 0.2

    const durationRand = rng(i * 0.1 + 5000)
    const twinkleDuration = 3 + durationRand * 5

    const delayRand = rng(i * 0.1 + 6000)
    const twinkleDelay = delayRand * 10

    const pulseDelayRand = rng(i * 0.1 + 9000)
    const pulseDelay = pulseDelayRand * 8

    const colorRand = rng(i * 0.1 + 8000)
    const colorVariation = colorRand * 0.3 - 0.15
    const colorTint: [number, number, number] = [
      Math.max(200, Math.min(255, colorTintBase[0] + colorVariation * 55)),
      Math.max(200, Math.min(255, colorTintBase[1] + colorVariation * 55)),
      Math.max(200, Math.min(255, colorTintBase[2] + colorVariation * 55)),
    ]

    stars.push({
      x,
      y,
      size,
      baseOpacity,
      twinkleIntensity,
      twinkleDuration,
      twinkleDelay,
      isBright: isBrightStar,
      colorTint,
      pulseDelay,
    })
  }
  return stars
}

export default function SpaceBackground() {
  // Reduce star count on mobile for better performance
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const starMultiplier = isMobile ? 0.5 : 1

  const farStars = useMemo(
    () => generateStars(Math.floor(100 * starMultiplier), [0.5, 1.5], 1, [200, 220, 255]),
    [starMultiplier]
  )
  const midStars = useMemo(
    () => generateStars(Math.floor(80 * starMultiplier), [1, 3], 2, [240, 245, 255], farStars),
    [farStars, starMultiplier]
  )
  const nearStars = useMemo(
    () =>
      generateStars(
        Math.floor(60 * starMultiplier),
        [2, 5],
        3,
        [255, 250, 240],
        [...farStars, ...midStars]
      ),
    [farStars, midStars, starMultiplier]
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const baseGradientRef = useRef<HTMLDivElement>(null)
  const farStarsRef = useRef<HTMLDivElement>(null)
  const midStarsRef = useRef<HTMLDivElement>(null)
  const nearStarsRef = useRef<HTMLDivElement>(null)
  const nebulaRef = useRef<HTMLDivElement>(null)
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([])
  const shootingStarIdRef = useRef(0)
  const typedSequenceRef = useRef('')
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { isPageVisible, rafRef, cancelRAF } = useAnimationFrameWithVisibility()
  const lastScrollY = useRef(0)

  const renderStarLayer = (stars: Star[], layerName: string) => {
    const layerRef =
      layerName === 'far' ? farStarsRef : layerName === 'mid' ? midStarsRef : nearStarsRef
    return (
      <div
        ref={layerRef}
        className="absolute w-full"
        style={{
          top: '-50vh',
          left: 0,
          right: 0,
          height: '200vh',
          willChange: isPageVisible ? 'transform' : 'auto', // Remove will-change when paused
          transition: 'transform 0.1s ease-out',
          contain: 'layout style paint', // CSS containment for better performance
        }}
      >
        {stars.map((star, index) => {
          const minOpacity = Math.max(0, star.baseOpacity - star.twinkleIntensity)
          const maxOpacity = Math.min(1, star.baseOpacity + star.twinkleIntensity)
          const isSubtle = star.twinkleIntensity < 0.15
          const animationName = isSubtle ? 'twinkle-subtle' : 'twinkle-pronounced'

          const [r, g, b] = star.colorTint
          const glowMultiplier = star.isBright ? 2.5 : star.size > 2 ? 1.8 : 1.2
          const glowSize = star.size * glowMultiplier

          const boxShadowLayers =
            star.size > 2
              ? `0 0 ${glowSize * 0.3}px rgba(${r},${g},${b},0.6), 0 0 ${
                  glowSize * 0.6
                }px rgba(${r},${g},${b},0.4), 0 0 ${glowSize}px rgba(${r},${g},${b},0.2), 0 0 ${
                  glowSize * 1.5
                }px rgba(${r},${g},${b},0.1)`
              : `0 0 ${
                  glowSize * 0.5
                }px rgba(${r},${g},${b},0.5), 0 0 ${glowSize}px rgba(${r},${g},${b},0.3)`

          const hotCoreR = Math.min(255, r + 20)
          const hotCoreG = Math.min(255, g + 15)
          const hotCoreB = Math.min(255, b + 10)
          const coolEdgeR = Math.max(r - 10, r * 0.9)
          const coolEdgeG = Math.max(g - 5, g * 0.95)
          const coolEdgeB = Math.min(255, b + 15)

          const backgroundGradient = `radial-gradient(circle, 
            rgba(${hotCoreR},${hotCoreG},${hotCoreB},1) 0%, 
            rgba(${hotCoreR},${hotCoreG},${hotCoreB},0.7) 2%,
            rgba(${r},${g},${b},0.6) 8%,
            rgba(${r},${g},${b},0.5) 15%,
            rgba(${r},${g},${b},0.4) 25%,
            rgba(${coolEdgeR},${coolEdgeG},${coolEdgeB},0.3) 40%,
            rgba(${coolEdgeR},${coolEdgeG},${coolEdgeB},0.15) 60%,
            rgba(${coolEdgeR},${coolEdgeG},${coolEdgeB},0.05) 80%,
            transparent 100%)`

          return (
            <div
              key={`${layerName}-${index}`}
              className={`absolute rounded-full star-twinkle ${
                star.isBright && star.size > 3 ? 'star-sparkle' : ''
              }`}
              style={
                {
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  background: backgroundGradient,
                  boxShadow: boxShadowLayers,
                  animation: isPageVisible
                    ? `${animationName} ${star.twinkleDuration}s ease-in-out infinite`
                    : 'none', // Pause animations when page hidden
                  animationDelay: `${star.twinkleDelay}s`,
                  animationPlayState: isPageVisible ? 'running' : 'paused',
                  transform: 'translate(-50%, -50%)',
                  willChange: isPageVisible ? 'opacity' : 'auto',
                  '--min-opacity': minOpacity,
                  '--max-opacity': maxOpacity,
                  '--star-size': `${star.size}px`,
                } as React.CSSProperties & {
                  '--min-opacity': number
                  '--max-opacity': number
                  '--star-size': string
                }
              }
            >
              {star.isBright && star.size > 3 && (
                <>
                  <div
                    className="star-crosshair"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: `${star.size * 2}px`,
                      height: '1px',
                      background: `linear-gradient(90deg, transparent, rgba(${r},${g},${b},0.6), transparent)`,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: `0 0 ${star.size * 0.3}px rgba(${r},${g},${b},0.4)`,
                      animationDelay: `${star.pulseDelay}s`,
                    }}
                  />
                  <div
                    className="star-crosshair"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '1px',
                      height: `${star.size * 2}px`,
                      background: `linear-gradient(180deg, transparent, rgba(${r},${g},${b},0.6), transparent)`,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: `0 0 ${star.size * 0.3}px rgba(${r},${g},${b},0.4)`,
                      animationDelay: `${star.pulseDelay + 1.5}s`,
                    }}
                  />
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Optimized scroll handler with throttling
  useEffect(() => {
    if (!isPageVisible) return

    const handleScroll = () => {
      if (!containerRef.current || !isPageVisible) return

      const scrolled = window.scrollY

      // Skip update if scroll hasn't changed significantly (throttle)
      if (Math.abs(scrolled - lastScrollY.current) < 2) {
        rafRef.current = requestAnimationFrame(handleScroll)
        return
      }

      lastScrollY.current = scrolled

      // Natural space parallax - forward movement through space
      // Use transform3d for hardware acceleration
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

      if (baseGradientRef.current) {
        const yPos = scrolled * 0.015
        baseGradientRef.current.style.transform = `translate3d(0, ${yPos}px, 0)`
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

  // Shooting star scheduler - only when page is visible
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
              if (isPageVisible) {
                createShootingStar(baseX, baseY, baseAngle)
              }
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
      const key = e.key.toLowerCase()

      if (key.length === 1 && /[a-z]/.test(key)) {
        typedSequenceRef.current += key

        if (sequenceTimeoutRef.current) {
          clearTimeout(sequenceTimeoutRef.current)
        }

        if (typedSequenceRef.current === 'moondao') {
          const isShower = Math.random() < 0.08
          const count = isShower ? 2 : 1

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
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px',
        width: '100vw',
        height: '100vh',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000000',
      }}
    >
      {/* Base gradient layer - deep space fade */}
      <div
        ref={baseGradientRef}
        className="absolute w-full"
        style={{
          top: '-50vh',
          left: 0,
          right: 0,
          height: '200vh',
          background: `linear-gradient(
            180deg,
            #0f0f1e 0%,
            #0a0a15 15%,
            #050510 40%,
            #020205 70%,
            #000000 85%,
            #000000 100%
          )`,
          willChange: 'transform',
          transition: 'transform 0.1s ease-out',
        }}
      />

      {/* Far stars layer - almost stationary, tiny stars, most numerous */}
      {renderStarLayer(farStars, 'far')}

      {/* Mid stars layer - very slow movement, small stars */}
      {renderStarLayer(midStars, 'mid')}

      {/* Near stars layer - subtle movement, slightly larger stars */}
      {renderStarLayer(nearStars, 'near')}

      {/* Shooting stars - only render when page is visible */}
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

      {/* Nebula-like depth clouds - realistic emission and reflection nebulae */}
      <div
        ref={nebulaRef}
        className="absolute w-full opacity-70"
        style={{
          top: '-50vh',
          left: 0,
          right: 0,
          height: '200vh',
          background: `
            radial-gradient(ellipse 85% 60% at 50% 8%, rgba(24, 34, 84, 0.6) 0%, rgba(22, 30, 75, 0.32) 40%, transparent 70%),
            radial-gradient(ellipse 70% 50% at 15% 25%, rgba(70, 52, 95, 0.5) 0%, rgba(52, 40, 72, 0.3) 50%, transparent 80%),
            radial-gradient(ellipse 65% 45% at 85% 30%, rgba(65, 48, 90, 0.45) 0%, rgba(48, 36, 68, 0.25) 45%, transparent 75%),
            radial-gradient(ellipse 60% 40% at 25% 65%, rgba(80, 58, 105, 0.4) 0%, rgba(58, 42, 82, 0.2) 50%, transparent 80%),
            radial-gradient(ellipse 55% 35% at 75% 70%, rgba(58, 45, 82, 0.5) 0%, rgba(44, 34, 65, 0.3) 45%, transparent 75%),
            radial-gradient(ellipse 50% 30% at 50% 90%, rgba(48, 36, 72, 0.6) 0%, rgba(35, 26, 58, 0.35) 50%, transparent 85%),
            radial-gradient(ellipse 45% 25% at 40% 50%, rgba(58, 45, 80, 0.35) 0%, rgba(44, 34, 62, 0.2) 55%, transparent 80%)
          `,
          willChange: 'transform',
          transition: 'transform 0.1s linear',
          filter: 'blur(0.5px)',
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
