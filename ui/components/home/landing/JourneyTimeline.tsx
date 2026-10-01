import { motion, useScroll, useSpring } from 'framer-motion'
import Image from 'next/image'
import { useRef } from 'react'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

type TimelineEvent = {
  date: string
  title: string
  description: string
  icon: string
  iconAlt: string
  isCurrent?: boolean
}

const timelineEvents: TimelineEvent[] = [
  {
    date: 'Nov 2021',
    title: 'MoonDAO Launch',
    description:
      'MoonDAO launches as the first decentralized autonomous organization focused on space exploration and lunar settlement.',
    icon: '/assets/moondao-logo.svg',
    iconAlt: 'MoonDAO Launch',
  },
  {
    date: 'Feb 2022',
    title: 'Raised $8M',
    description:
      'Raised 2,600 ETH through community funding and purchased two tickets on a Blue Origin flight.',
    icon: '/assets/icon-ethereum.svg',
    iconAlt: 'Fundraising Success',
  },
  {
    date: 'Aug 2022',
    title: 'First to Space',
    description:
      "Coby Cotton is selected by the community and launched to space on Blue Origin's NS-22. MoonDAO ratifies its constitution.",
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Space Launch',
  },
  {
    date: 'May 2023',
    title: 'Project Funding',
    description:
      'Funds 100+ space-related projects, fostering a thriving ecosystem of space entrepreneurs and researchers.',
    icon: '/assets/icon-project.svg',
    iconAlt: 'Project Funding',
  },
  {
    date: 'Jan 2024',
    title: 'Zero Gravity',
    description:
      'Organizes a zero-gravity flight experience with three astronauts, advancing space training and research.',
    icon: '/assets/icon-plane.svg',
    iconAlt: 'Zero Gravity',
  },
  {
    date: 'May 2024',
    title: 'Space Network',
    description:
      'Launches the Space Acceleration Network to coordinate and accelerate space technology development.',
    icon: '/assets/icon-passport.svg',
    iconAlt: 'Space Network',
  },
  {
    date: 'Aug 2024',
    title: 'Second to Space',
    description:
      "Dr. Eiman Jahangir completes the journey to space — MoonDAO's second successful astronaut mission.",
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Second Space Mission',
  },
  {
    date: 'May 2025',
    title: 'Launchpad',
    description:
      'The MoonDAO Launchpad goes live, enabling decentralized funding for space missions and projects.',
    icon: '/assets/MoonDAOLaunchpad.svg',
    iconAlt: 'Launchpad Platform',
  },
  {
    date: '2026',
    title: 'Settlement Design',
    description:
      'Design of major lunar settlement components completed, ready for manufacturing on Earth.',
    icon: '/assets/icon-project.svg',
    iconAlt: 'Settlement Design',
    isCurrent: true,
  },
  {
    date: '2027',
    title: 'Manufacturing',
    description:
      'Selection of the first Moon settlers. Manufacturing of key components with Earth-based simulations.',
    icon: '/assets/icon-contract.svg',
    iconAlt: 'Manufacturing',
  },
  {
    date: '2028',
    title: 'Ready for Launch',
    description: 'Components tested and ready for launch, with Earth-based simulation complete.',
    icon: '/assets/icon-lander.svg',
    iconAlt: 'Ready for Launch',
  },
  {
    date: '2029',
    title: 'Base Construction',
    description:
      'Infrastructure is sent to the Moon and the first crew begins construction of the lunar settlement.',
    icon: '/assets/icon-globe.svg',
    iconAlt: 'Lunar Construction',
  },
]

export default function JourneyTimeline() {
  const lineRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: lineRef,
    offset: ['start 0.75', 'end 0.65'],
  })
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 25,
    restDelta: 0.001,
  })
  const currentIndex = timelineEvents.findIndex((event) => event.isCurrent)

  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(66,94,235,0.07),transparent_60%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-5 md:px-10">
        <SectionHeading
          eyebrow="The Roadmap"
          title="Journey to the Moon"
          description="From an internet community to a permanent lunar settlement — every milestone funded, voted, and verified onchain."
        />

        <div className="mt-20">
          {/* lineRef wraps the events + moon image so the line grows into the moon */}
          <div ref={lineRef} className="relative">
            {/* Static track — ends at the moon's center (half the moon's height) */}
            <div className="absolute bottom-20 left-[22px] top-0 w-px bg-white/10 md:bottom-28 md:left-1/2" />
            <motion.div
              style={{ scaleY: progress }}
              className="absolute bottom-20 left-[22px] top-0 w-px origin-top bg-moon-gold/80 md:bottom-28 md:left-1/2"
            />

            <div className="flex flex-col gap-8 md:gap-12">
              {timelineEvents.map((event, i) => {
                const isLeft = i % 2 === 0
                const state = event.isCurrent ? 'now' : i > currentIndex ? 'next' : 'past'
                return (
                  <div
                    key={`${event.date}-${event.title}`}
                    className={`relative flex items-start gap-6 md:gap-0 ${
                      isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                    }`}
                  >
                    {/* Node */}
                    <div className="absolute left-[22px] z-10 -translate-x-1/2 md:left-1/2">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full border ring-4 ring-[#010208] ${
                          state === 'now'
                            ? 'border-moon-gold bg-[#161208]'
                            : state === 'next'
                            ? 'border-dashed border-white/30 bg-[#010208]'
                            : 'border-white/20 bg-[#0b1026]'
                        }`}
                      >
                        <Image
                          src={event.icon}
                          alt={event.iconAlt}
                          width={20}
                          height={20}
                          className={`h-5 w-5 ${state === 'next' ? 'opacity-45' : 'opacity-90'}`}
                        />
                      </div>
                    </div>

                    {/* Card */}
                    <div
                      className={`ml-14 w-full md:ml-0 md:w-[calc(50%-44px)] ${
                        isLeft ? 'md:mr-auto' : 'md:ml-auto'
                      }`}
                    >
                      <Reveal x={isLeft ? -24 : 24} y={0}>
                        <div
                          className={`rounded-2xl border p-5 md:p-6 ${
                            state === 'now'
                              ? 'border-moon-gold/35 bg-white/[0.04]'
                              : 'border-white/[0.08]'
                          }`}
                        >
                          <span
                            className={`font-RobotoMono text-[11px] uppercase tracking-[0.2em] ${
                              state === 'now'
                                ? 'text-moon-gold'
                                : state === 'next'
                                ? 'text-white/35'
                                : 'text-white/50'
                            }`}
                          >
                            {event.date}
                            {state === 'now' ? ' · Now' : ''}
                          </span>
                          <h3
                            className={`mt-2 font-GoodTimes text-lg md:text-xl ${
                              state === 'next' ? 'text-white/75' : 'text-white'
                            }`}
                            style={{ textWrap: 'balance' } as any}
                          >
                            {event.title}
                          </h3>
                          <p
                            className={`mt-2 text-sm leading-relaxed md:text-base ${
                              state === 'next' ? 'text-white/45' : 'text-white/65'
                            }`}
                            style={{ textWrap: 'pretty' } as any}
                          >
                            {event.description}
                          </p>
                        </div>
                      </Reveal>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Destination: the Moon — image lives inside lineRef so the line reaches its center */}
            <div className="relative flex flex-col items-center pt-16">
              <Reveal y={36}>
                <Image
                  src="/assets/landing/moon-full.jpg"
                  alt="The Moon"
                  width={400}
                  height={400}
                  className="h-40 w-40 rounded-full object-cover ring-1 ring-white/15 md:h-56 md:w-56"
                />
              </Reveal>
            </div>
          </div>

          {/* Caption sits below the moon, outside lineRef */}
          <Reveal delay={0.15}>
            <div className="mt-8 text-center">
              <span className="font-RobotoMono text-[11px] uppercase tracking-[0.28em] text-white/45">
                Jan 2030
              </span>
              <h3
                className="mt-2 font-GoodTimes text-2xl text-white md:text-3xl"
                style={{ textWrap: 'balance' } as any}
              >
                Lunar Settlement Complete
              </h3>
              <p
                className="mx-auto mt-3 max-w-md text-sm text-white/65 md:text-base"
                style={{ textWrap: 'pretty' } as any}
              >
                The first minimum viable lunar settlement is complete — and we throw a New
                Year&apos;s Eve party on the Moon.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
