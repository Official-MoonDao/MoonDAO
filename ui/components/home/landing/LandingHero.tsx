import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import Image from 'next/image'
import { useRef } from 'react'
import CountUp from './CountUp'
import CtaButton from './CtaButton'
import Starfield from './Starfield'

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
}

// Animate position only (no opacity) so the SSR'd HTML — including the <h1>
// LCP/SEO heading — is visible before hydration instead of rendering at
// opacity:0 until JS runs.
const item = {
  hidden: { y: 30 },
  visible: { y: 0, transition: { duration: 0.9, ease: EASE } },
}

const stats = [
  { value: 8, prefix: '$', suffix: 'M+', label: 'Raised onchain' },
  { value: 12_000, suffix: '+', label: 'Token holders' },
  { value: 100, suffix: '+', label: 'Projects funded' },
  { value: 2, suffix: '', label: 'Astronauts sent to space' },
]

export default function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  // Keep the parallax travel within the background's scale headroom: scale-[1.2]
  // overflows ~10% per edge, so an 8% downward translate never drags the top
  // edge into view and exposes a gap.
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', reduceMotion ? '0%' : '8%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -60])

  return (
    <>
      {/* Hero — exactly one viewport tall, no overflow */}
      <section
        ref={sectionRef}
        id="landing-hero"
        className="relative flex h-[70svh] min-h-[520px] w-full flex-col overflow-hidden bg-[#010208]"
      >
        {/* Parallax lunar colony backdrop */}
        <motion.div style={{ y: bgY }} className="absolute inset-0 scale-[1.2]">
          <Image
            src="/assets/Lunar-Colony-Dark.webp"
            alt=""
            fill
            priority
            className="object-cover"
            style={{ objectPosition: 'center 75%' }}
            sizes="100vw"
          />
        </motion.div>

        {/* Atmosphere: vignette + color wash + stars */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208]/85 via-[#010208]/30 to-[#010208]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(66,94,235,0.16),transparent_55%)]" />
        <Starfield className="opacity-80" />

        {/* Content */}
        <motion.div
          style={{ opacity: contentOpacity, y: contentY }}
          className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10"
        >
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.h1
              variants={item}
              className="font-heading font-semibold uppercase leading-[0.92] text-white"
            >
              <span className="block text-[0.7rem] tracking-[0.28em] text-white/50 md:text-xs">
                The Internet&apos;s
              </span>
              <span className="mt-3 block text-[clamp(2.25rem,6vw,4.5rem)]">
                <span className="text-moon-gold">Space</span> Program
              </span>
            </motion.h1>

            <motion.p
              variants={item}
              className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg"
            >
              MoonDAO is an open platform to fund, collaborate, and compete on challenges that get
              humanity closer to a permanent lunar settlement — governed by its members, transparent
              by design.
            </motion.p>

            <motion.div
              variants={item}
              className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6"
            >
              <CtaButton href="/join" variant="primary">
                Join the Network
              </CtaButton>
              <CtaButton href="/launch" variant="quiet">
                Explore Missions
              </CtaButton>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats bar — lives outside the hero so it only appears on scroll */}
      <div className="relative z-10 border-t border-white/[0.08] bg-[#010208]">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-8 gap-y-8 px-6 py-10 md:grid-cols-4 md:py-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <CountUp
                to={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                className="font-heading font-semibold text-2xl text-white md:text-3xl"
              />
              <span className="font-RobotoMono text-[10px] uppercase tracking-[0.18em] text-white/45 md:text-[11px]">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  )
}
