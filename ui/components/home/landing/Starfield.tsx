import { useEffect, useRef } from 'react'

type Star = {
  x: number
  y: number
  r: number
  baseAlpha: number
  phase: number
  speed: number
}

type StarfieldProps = {
  density?: number
  className?: string
}

/**
 * Lightweight canvas starfield with twinkle + slow vertical drift.
 * Renders a single static frame when the user prefers reduced motion.
 */
export default function Starfield({
  density = 0.00012,
  className = '',
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    let stars: Star[] = []
    let raf = 0
    let width = 0
    let height = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.floor(width * height * density)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.1 + 0.3,
        baseAlpha: Math.random() * 0.5 + 0.15,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.2,
      }))
    }

    const drawFrame = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#ffffff'
      for (const s of stars) {
        const twinkle = prefersReducedMotion
          ? 0
          : Math.sin(t * 0.0012 * s.speed * 4 + s.phase) * 0.35
        ctx.globalAlpha = Math.min(1, Math.max(0.05, s.baseAlpha + twinkle))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()

        if (!prefersReducedMotion) {
          s.y += s.speed * 0.06
          if (s.y > height + 2) {
            s.y = -2
            s.x = Math.random() * width
          }
        }
      }
      ctx.globalAlpha = 1
    }

    const loop = (t: number) => {
      drawFrame(t)
      raf = requestAnimationFrame(loop)
    }

    resize()
    if (prefersReducedMotion) {
      drawFrame(0)
    } else {
      raf = requestAnimationFrame(loop)
    }

    const observer = new ResizeObserver(() => {
      resize()
      if (prefersReducedMotion) drawFrame(0)
    })
    observer.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [density])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  )
}
