import { animate, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { formatCountStat } from '@/lib/stats/publicFigures'

type CountUpProps = {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

/**
 * The first paint is `to`, not zero. Crawlers and phones that have not run
 * JavaScript would otherwise see "$0M+" and "0+" because the count used to
 * start at 0 and only move once the stat scrolled into view. A later change
 * to a different positive value still animates.
 */
export default function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 2,
  className = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduceMotion = useReducedMotion()
  const [value, setValue] = useState(to)
  const valueRef = useRef(to)
  valueRef.current = value

  useEffect(() => {
    if (!Number.isFinite(to) || to <= 0) return
    if (!inView || reduceMotion) {
      setValue(to)
      return
    }
    const from = valueRef.current
    if (!Number.isFinite(from) || from <= 0 || from === to) {
      setValue(to)
      return
    }
    const controls = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (next) => {
        const rounded = Math.round(next)
        if (rounded > 0) setValue(rounded)
      },
    })
    return () => controls.stop()
  }, [inView, reduceMotion, to, duration])

  const label = formatCountStat(value > 0 ? value : to, prefix, suffix)

  return (
    <span ref={ref} className={className}>
      {label || '...'}
    </span>
  )
}
