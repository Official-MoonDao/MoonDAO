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
  { value: 80, suffix: '+', label: 'Projects funded' },
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
        className="relative flex h-[100svh] w-full flex-col overflow-hidden bg-[#010208]"
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(66,94,235,0.28),transparent_60%)]" />
        <Starfield className="opacity-80" />

        {/* Content */}
        <motion.div
          style={{ opacity: contentOpacity, y: contentY }}
          className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10"
        >
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.h1 variants={item} className="font-GoodTimes leading-none text-white">
              <span className="block text-[clamp(1rem,2.4vw,1.6rem)] tracking-[0.45em] text-white/70">
                The Internet&apos;s
              </span>
              <span className="mt-4 block text-[clamp(2.8rem,9.5vw,8.5rem)]">
                <span className="bg-gradient-to-r from-[#7c8cff] via-[#b07ce8] to-[#22d3ee] bg-clip-text text-transparent drop-shadow-[0_0_45px_rgba(124,140,255,0.35)]">
                  Space
                </span>{' '}
                Program
              </span>
            </motion.h1>

            <motion.p
              variants={item}
              className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-white/75 md:text-xl"
            >
              MoonDAO is an open platform to fund, collaborate, and compete on
              challenges that get humanity closer to a permanent lunar
              settlement — governed by its members, transparent by design.
            </motion.p>

            <motion.div
              variants={item}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <CtaButton href="/join" variant="primary">
                Join the Network
              </CtaButton>
              <CtaButton href="/launch" variant="secondary">
                Explore Missions
              </CtaButton>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats bar — lives outside the hero so it only appears on scroll */}
      <div className="relative z-10 border-t border-white/10 bg-[#010208] backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-2 divide-x divide-white/10 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
              className={`flex flex-col items-center gap-1 px-4 py-5 md:py-7 ${
                i >= 2 ? 'border-t border-white/10 lg:border-t-0' : ''
              }`}
            >
              <CountUp
                to={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                className="font-GoodTimes text-2xl text-white md:text-4xl"
              />
              <span className="font-RobotoMono text-[10px] uppercase tracking-[0.2em] text-white/50 md:text-xs">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  )
}
