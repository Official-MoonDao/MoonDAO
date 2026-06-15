import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import Image from 'next/image'
import { useRef } from 'react'
import CtaButton from './CtaButton'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

export default function MissionStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })
  const imageY = useTransform(
    scrollYProgress,
    [0, 1],
    [reduceMotion ? 0 : 40, reduceMotion ? 0 : -40]
  )

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#010208] py-24 md:py-36"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_30%,rgba(108,64,125,0.18),transparent_55%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-14 px-5 md:px-10 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-8">
          <SectionHeading
            align="left"
            eyebrow="The Network"
            title={
              <>
                Bringing the Space Industry{' '}
                <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
                  Onchain
                </span>
              </>
            }
            description="The Space Acceleration Network is an onchain startup society that connects space visionaries and organizations with the funding, tools, and support needed to turn bold ideas into reality."
          />

          <Reveal delay={0.25}>
            <ul className="flex flex-col gap-4">
              {[
                'A global network of teams, citizens, and partners building toward the Moon',
                'Open coordination — every project, vote, and payout is public',
                'From zero-gravity research to lunar settlement design',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-white/75">
                  <svg
                    className="mt-1 h-4 w-4 flex-shrink-0 text-[#22d3ee]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span className="text-base md:text-lg">{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.35}>
            <CtaButton href="/network" variant="secondary">
              Explore the Network
            </CtaButton>
          </Reveal>
        </div>

        <Reveal delay={0.15} y={40}>
          <div className="group relative">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#425EEB]/40 via-[#6C407D]/30 to-[#22d3ee]/30 opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-90" />
            <div className="relative h-[420px] overflow-hidden rounded-[2rem] border border-white/10 md:h-[540px]">
              <motion.div
                style={{ y: imageY }}
                className="absolute -inset-y-16 inset-x-0"
              >
                <Image
                  src="/assets/Moon-Launch.webp"
                  alt="Rocket launching toward the Moon"
                  width={1200}
                  height={900}
                  className="h-full w-full object-cover"
                />
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#010208]/80 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-[#010208]/60 p-4 backdrop-blur-xl md:p-5">
                <div>
                  <p className="font-GoodTimes text-sm text-white md:text-base">
                    Space Acceleration Network
                  </p>
                  <p className="mt-1 text-xs text-white/60 md:text-sm">
                    An onchain startup society for the space economy
                  </p>
                </div>
                <Image
                  src="/assets/SAN-logo-dark.svg"
                  alt=""
                  width={44}
                  height={44}
                  className="h-10 w-10 flex-shrink-0 brightness-0 invert md:h-11 md:w-11"
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
