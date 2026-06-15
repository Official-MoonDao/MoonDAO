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

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let prefersReducedMotion = motionQuery.matches

    let stars: Star[] = []
    let raf = 0
    let width = 0
    let height = 0
    let isVisible = true

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

    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }

    // Only run the animation loop while on-screen and motion is allowed;
    // otherwise render a single static frame. Two Starfields mount at once
    // (hero + final CTA), so leaving both loops running off-screen wastes a
    // frame budget for the whole session.
    const start = () => {
      if (prefersReducedMotion || !isVisible) {
        stop()
        drawFrame(0)
        return
      }
      if (!raf) raf = requestAnimationFrame(loop)
    }

    resize()
    start()

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (prefersReducedMotion || !isVisible) drawFrame(0)
    })
    resizeObserver.observe(canvas)

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        start()
      },
      { threshold: 0 }
    )
    intersectionObserver.observe(canvas)

    const onMotionChange = () => {
      prefersReducedMotion = motionQuery.matches
      start()
    }
    motionQuery.addEventListener('change', onMotionChange)

    return () => {
      stop()
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      motionQuery.removeEventListener('change', onMotionChange)
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
