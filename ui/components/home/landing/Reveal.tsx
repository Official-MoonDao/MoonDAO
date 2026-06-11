import { motion, useReducedMotion } from 'framer-motion'
import { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  delay?: number
  y?: number
  x?: number
  duration?: number
  className?: string
  once?: boolean
}

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

/** Fades + slides content in when it enters the viewport. */
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  x = 0,
  duration = 0.8,
  className = '',
  once = true,
}: RevealProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduceMotion ? 0 : y, x: reduceMotion ? 0 : x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
