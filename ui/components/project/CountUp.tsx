import { animate, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/** Counts from 0 to `value` the first time it scrolls into view. */
export default function CountUp({ value, prefix = '' }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setShown(value)
      return
    }
    if (!inView) return
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.21, 0.47, 0.32, 0.98],
      onUpdate: (v) => setShown(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, reduce, value])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {shown.toLocaleString()}
    </span>
  )
}
