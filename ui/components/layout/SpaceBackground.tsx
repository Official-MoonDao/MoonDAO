import React, { useEffect, useRef, useMemo } from 'react'

const generateStars = (count: number, sizeRange: [number, number], seed: number = 0) => {
  const stars = []
  // Use seed for consistent star positions
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
        ? sizeRange[0] + rand * 0.3 * (sizeRange[1] - sizeRange[0]) // 90% small stars
        : sizeRange[0] + (0.3 + rand * 0.7) * (sizeRange[1] - sizeRange[0]) // 10% larger stars
    // Vary opacity more naturally - most stars are dim, few are bright
    const opacityRand = rng(i * 0.1 + 3000)
    const opacity = opacityRand < 0.7 ? 0.3 + opacityRand * 0.4 : 0.7 + opacityRand * 0.3
    stars.push(
      `radial-gradient(${size.toFixed(2)}px ${size.toFixed(2)}px at ${x.toFixed(2)}% ${y.toFixed(
        2
      )}%, rgba(255,255,255,${opacity.toFixed(2)}), transparent)`
    )
  }
  return stars.join(',\n            ')
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
      <div
        ref={farStarsRef}
        className="absolute inset-0 w-full h-full star-layer-far"
        style={{
          backgroundImage: farStars,
          backgroundSize: '200% 200%',
          willChange: 'transform, opacity',
          transition: 'transform 0.1s ease-out',
        }}
      />

      {/* Mid stars layer - very slow movement, small stars */}
      <div
        ref={midStarsRef}
        className="absolute inset-0 w-full h-full star-layer-mid"
        style={{
          backgroundImage: midStars,
          backgroundSize: '150% 150%',
          willChange: 'transform, opacity',
          transition: 'transform 0.1s ease-out',
        }}
      />

      {/* Near stars layer - subtle movement, slightly larger stars */}
      <div
        ref={nearStarsRef}
        className="absolute inset-0 w-full h-full star-layer-near"
        style={{
          backgroundImage: nearStars,
          backgroundSize: '120% 120%',
          willChange: 'transform, opacity',
          transition: 'transform 0.1s ease-out',
        }}
      />

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
