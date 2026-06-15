import { animate, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type CountUpProps = {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

const formatter = new Intl.NumberFormat('en-US')

/** Animates a number from 0 to `to` once it scrolls into view. */
export default function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 2,
  className = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  // Drive the displayed value through React state so it stays declarative — a
  // parent re-render can't wipe a value we'd otherwise have poked into
  // `textContent` (which React doesn't know about).
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, to, duration])

  return (
    <span ref={ref} className={className}>
      {`${prefix}${formatter.format(value)}${suffix}`}
    </span>
  )
}
