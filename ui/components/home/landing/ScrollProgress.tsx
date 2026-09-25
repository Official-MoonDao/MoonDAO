import { motion, useScroll, useSpring } from 'framer-motion'

/** Mission-progress bar pinned to the top of the landing page. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      aria-hidden
      style={{ scaleX: progress }}
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-[#425EEB] via-[#b07ce8] to-[#22d3ee] shadow-[0_0_12px_rgba(124,140,255,0.7)]"
    />
  )
}
