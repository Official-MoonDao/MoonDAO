import { animate, useInView } from 'framer-motion'
import { useEffect, useRef } from 'react'

type CountUpProps = {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

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

  useEffect(() => {
    if (!inView || !ref.current) return
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (value) => {
        if (ref.current) {
          ref.current.textContent = `${prefix}${new Intl.NumberFormat(
            'en-US'
          ).format(Math.round(value))}${suffix}`
        }
      },
    })
    return () => controls.stop()
  }, [inView, to, prefix, suffix, duration])

  return (
    <span ref={ref} className={className}>
      {`${prefix}0${suffix}`}
    </span>
  )
}
