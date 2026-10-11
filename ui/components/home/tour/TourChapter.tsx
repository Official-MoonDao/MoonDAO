import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { ReactNode, useRef } from 'react'
import type { TourStopId } from '@/lib/home-tour/stops'

type TourChapterProps = {
  id: TourStopId
  // How much page this stop takes, in viewport heights. The card is pinned for
  // all of it past the first screen, which is the time the camera has to fly
  // in and the visitor has to look before the next stop pulls it away.
  heightSvh?: number
  // The first chapter is already on screen at load, so it only fades out.
  fadeIn?: boolean
  // Scroll progress through the pinned stretch, 0 to 1, for a chapter whose
  // card changes as you scroll (the roadmap).
  children: ReactNode | ((pinned: MotionValue<number>) => ReactNode)
}

export default function TourChapter({
  id,
  heightSvh = 170,
  fadeIn = true,
  children,
}: TourChapterProps) {
  const ref = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()

  // Progress from the section's top entering the bottom of the screen to its
  // bottom leaving the top, which is heightSvh + 100 viewport heights of
  // scroll. The card arrives over the half screen before it pins (the same
  // moment useActiveStop starts the camera flight), holds while pinned, and
  // leaves over the half screen after.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const span = heightSvh + 100
  const at = (svh: number) => svh / span
  const opacity = useTransform(
    scrollYProgress,
    fadeIn ? [at(50), at(100), at(heightSvh), at(heightSvh + 50)] : [at(heightSvh), at(heightSvh + 50)],
    fadeIn ? [0, 1, 1, 0] : [1, 0]
  )
  const y = useTransform(
    scrollYProgress,
    fadeIn ? [at(50), at(100), at(heightSvh), at(heightSvh + 50)] : [at(heightSvh), at(heightSvh + 50)],
    reduceMotion ? (fadeIn ? [0, 0, 0, 0] : [0, 0]) : fadeIn ? [32, 0, 0, -32] : [0, -32]
  )

  // Every chapter's card shares one fixed frame, so a faded-out card must not
  // keep catching clicks meant for the one on screen.
  const pointerEvents = useTransform(opacity, (o) => (o > 0.5 ? 'auto' : 'none'))
  const visibility = useTransform(opacity, (o) => (o > 0.01 ? 'visible' : 'hidden'))

  const { scrollYProgress: pinned } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  // position: sticky would be simpler, but <body> is overflow-hidden site-wide
  // (pages/_document.tsx), which stops sticky from ever pinning.
  return (
    <section ref={ref} data-tour-stop={id} className="relative" style={{ height: `${heightSvh}svh` }}>
      <motion.div
        style={{ visibility }}
        className="pointer-events-none fixed inset-0 flex items-end pb-14 md:items-center md:pb-0"
      >
        <div className="mx-auto w-full max-w-[1400px] px-5 md:px-10">
          <motion.div style={{ opacity, y, pointerEvents }}>
            {typeof children === 'function' ? children(pinned) : children}
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
