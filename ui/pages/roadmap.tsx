import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import Container from '../components/layout/Container'
import { ExpandedFooter } from '../components/layout/ExpandedFooter'
import WebsiteHead from '../components/layout/Head'
import PreFooter from '../components/layout/PreFooter'
import StandardButton from '../components/layout/StandardButton'

/*──────────────────────────────────────────────────────────────────────────────
  DATA
──────────────────────────────────────────────────────────────────────────────*/

interface Phase {
  id: string
  era: string
  title: string
  subtitle: string
  year: string
  status: 'completed' | 'active' | 'upcoming'
  icon: string
  iconAlt: string
  iconSize?: number
  color: string      // tailwind gradient from-color
  glowColor: string  // glow ring colour
  milestones: {
    label: string
    detail: string
    done: boolean
  }[]
  description: string
  image?: string
}

const phases: Phase[] = [
  {
    id: 'genesis',
    era: 'Phase 0',
    title: 'Genesis',
    subtitle: 'Building the Foundation',
    year: '2021 – 2022',
    status: 'completed',
    icon: '/assets/moondao-logo.svg',
    iconAlt: 'MoonDAO Logo',
    color: 'from-blue-600 to-cyan-500',
    glowColor: 'shadow-blue-500/40',
    milestones: [
      {
        label: 'MoonDAO Launched',
        detail:
          'November 2021 — MoonDAO was founded as the first decentralized autonomous organization dedicated to making humanity a multiplanetary species.',
        done: true,
      },
      {
        label: 'Raised 2,600 ETH (~$8.3M)',
        detail:
          'February 2022 — Community-driven fundraise gave MoonDAO the treasury to pursue its mission, including purchasing two Blue Origin seats.',
        done: true,
      },
      {
        label: 'Constitution Ratified',
        detail:
          'Established the three governing bodies — the Senate, Member House, and Executive Branch — along with checks, balances, and the proposal process.',
        done: true,
      },
    ],
    description:
      'MoonDAO was born from a simple idea: space exploration should not be controlled by a handful of governments and corporations. By pooling resources through crypto, anyone on Earth can help fund and participate in the journey to the Moon.',
    image: '/assets/home/galaxy2.jpg',
  },
  {
    id: 'first-flights',
    era: 'Phase 1',
    title: 'First Flights',
    subtitle: 'Sending People to Space',
    year: '2022 – 2023',
    status: 'completed',
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Astronaut',
    color: 'from-violet-600 to-purple-500',
    glowColor: 'shadow-violet-500/40',
    milestones: [
      {
        label: 'Coby Cotton Sent to Space',
        detail:
          "August 2022 — MoonDAO's first astronaut, Coby Cotton, launched aboard Blue Origin's New Shepard rocket, proving a DAO can send someone to space.",
        done: true,
      },
      {
        label: '80+ Projects Funded',
        detail:
          'May 2023 — MoonDAO began funding space-related projects through its governance system, supporting innovation across the space tech sector.',
        done: true,
      },
    ],
    description:
      'MoonDAO proved that a decentralized community can accomplish what only nations and billionaires had done before — send a human being to space. This phase established our credibility and demonstrated the power of crypto-native coordination for space exploration.',
    image: '/assets/Moon-Launch.webp',
  },
  {
    id: 'expansion',
    era: 'Phase 2',
    title: 'Expansion',
    subtitle: 'Growing the Network',
    year: '2024',
    status: 'completed',
    icon: '/assets/icon-passport.svg',
    iconAlt: 'Network',
    color: 'from-emerald-600 to-teal-500',
    glowColor: 'shadow-emerald-500/40',
    milestones: [
      {
        label: 'Zero Gravity Flight',
        detail:
          "January 2024 — Three astronauts participated in a zero-gravity flight, advancing MoonDAO's space training and research capabilities.",
        done: true,
      },
      {
        label: 'Space Acceleration Network Launched',
        detail:
          'May 2024 — The onchain coordination platform went live, connecting individuals and companies with profiles, a jobs board, marketplace, and governance tools.',
        done: true,
      },
      {
        label: 'Eiman Jahangir Sent to Space',
        detail:
          "August 2024 — MoonDAO's second astronaut completed a journey to space, cementing the DAO's track record of human spaceflight.",
        done: true,
      },
    ],
    description:
      'With two successful astronauts and a growing treasury of projects, MoonDAO shifted focus to building the infrastructure needed for long-term coordination — the Space Acceleration Network, an onchain platform for teams and citizens to collaborate on the journey to the Moon.',
    image: '/assets/NetworkHero.webp',
  },
  {
    id: 'launchpad',
    era: 'Phase 3',
    title: 'Launchpad',
    subtitle: 'Decentralized Space Funding',
    year: '2025',
    status: 'active',
    icon: '/assets/MoonDAOLaunchpad.svg',
    iconAlt: 'Launchpad',
    color: 'from-orange-500 to-amber-500',
    glowColor: 'shadow-orange-500/40',
    milestones: [
      {
        label: 'MoonDAO Launchpad Live',
        detail:
          'May 2025 — The Launchpad platform launched, enabling permissionless, decentralized crowdfunding for space missions and projects with built-in tokenomics.',
        done: true,
      },
      {
        label: 'Starship Access',
        detail:
          'Fundraise for ownership of a Starship or equivalent launch vehicle and guaranteed refuel missions — the key to making lunar settlement physically possible.',
        done: false,
      },
    ],
    description:
      'The Launchpad is the economic engine for getting to the Moon. By creating an open platform where anyone can fund, launch, and invest in space missions, MoonDAO is building the financial rails for a lunar economy. The immediate priority is securing access to a Starship-class launch vehicle.',
    image: '/assets/launchpad/moondao-launchpad-hero.png',
  },
  {
    id: 'settlement-design',
    era: 'Phase 4',
    title: 'Settlement Design',
    subtitle: 'Designing the Lunar Base',
    year: '2026',
    status: 'active',
    icon: '/assets/icon-project.svg',
    iconAlt: 'Design',
    color: 'from-sky-500 to-blue-500',
    glowColor: 'shadow-sky-500/40',
    milestones: [
      {
        label: 'Settlement Architecture',
        detail:
          'Design of major lunar settlement components — habitation modules, life support systems, power generation, and communication infrastructure.',
        done: false,
      },
      {
        label: 'Component Specifications',
        detail:
          'Detailed engineering specifications completed and ready for manufacturing on Earth.',
        done: false,
      },
    ],
    description:
      "This is where MoonDAO is today. We're actively designing the components that will make a permanent lunar settlement a reality. This includes habitation, power, life support, and communication systems — all coordinated through our open governance and launchpad.",
    image: '/assets/Lunar-Colony-Dark.webp',
  },
  {
    id: 'manufacturing',
    era: 'Phase 5',
    title: 'Manufacturing',
    subtitle: 'Building on Earth',
    year: '2027',
    status: 'upcoming',
    icon: '/assets/icon-contract.svg',
    iconAlt: 'Manufacturing',
    color: 'from-pink-500 to-rose-500',
    glowColor: 'shadow-pink-500/40',
    milestones: [
      {
        label: 'First Settlers Selected',
        detail:
          'A global open process to select the first crew for the lunar settlement.',
        done: false,
      },
      {
        label: 'Component Manufacturing',
        detail:
          'Key settlement components manufactured and tested with Earth-based simulations.',
        done: false,
      },
    ],
    description:
      'With designs finalized, manufacturing begins. Components will be built and rigorously tested in Earth-based simulations that replicate lunar conditions. In parallel, the first lunar settlers will be selected through an open, community-driven process.',
  },
  {
    id: 'launch-prep',
    era: 'Phase 6',
    title: 'Ready for Launch',
    subtitle: 'Final Testing & Preparation',
    year: '2028',
    status: 'upcoming',
    icon: '/assets/launchpad/rocket.svg',
    iconAlt: 'Rocket',
    iconSize: 36,
    color: 'from-red-500 to-orange-500',
    glowColor: 'shadow-red-500/40',
    milestones: [
      {
        label: 'Earth-Based Simulation Complete',
        detail:
          'Full end-to-end simulation of lunar settlement operations completed on Earth.',
        done: false,
      },
      {
        label: 'Components Tested & Flight-Ready',
        detail:
          'All settlement components pass final testing and are prepared for lunar transit.',
        done: false,
      },
    ],
    description:
      'Every component is tested, every system is validated, and every crew member is trained. This is the final checkpoint before committing hardware and humans to the Moon.',
  },
  {
    id: 'construction',
    era: 'Phase 7',
    title: 'Base Construction',
    subtitle: 'Building on the Moon',
    year: '2029',
    status: 'upcoming',
    icon: '/assets/icon-globe.svg',
    iconAlt: 'Moon Base',
    color: 'from-indigo-500 to-violet-500',
    glowColor: 'shadow-indigo-500/40',
    milestones: [
      {
        label: 'Infrastructure Arrives on the Moon',
        detail:
          'Settlement components are delivered to the lunar surface via Starship or equivalent launch vehicle.',
        done: false,
      },
      {
        label: 'First Crew Begins Construction',
        detail:
          'The first human crew arrives on the Moon and begins assembling the settlement.',
        done: false,
      },
    ],
    description:
      "Infrastructure is sent to the Moon, and the first crew begins construction of humanity's first permanent settlement beyond Earth. This is the culmination of years of design, testing, and community coordination.",
  },
  {
    id: 'lunar-settlement',
    era: 'The Goal',
    title: 'Lunar Settlement',
    subtitle: "New Year's Eve on the Moon",
    year: '2030',
    status: 'upcoming',
    icon: '/assets/icon-events.svg',
    iconAlt: 'Lunar Party',
    color: 'from-yellow-400 to-amber-400',
    glowColor: 'shadow-yellow-400/50',
    milestones: [
      {
        label: 'Minimum Viable Lunar Settlement Complete',
        detail:
          'A functional, habitable settlement on the lunar surface — the first permanent human presence on the Moon.',
        done: false,
      },
      {
        label: "New Year's Eve on the Moon",
        detail:
          "Celebrate humanity's greatest achievement with a party on the Moon — a moment that proves what decentralized coordination can accomplish.",
        done: false,
      },
    ],
    description:
      "This is why MoonDAO exists. A permanent settlement on the Moon, built by a global community and governed by the people who made it possible. Not one nation's flag — everyone's Moon.",
    image: '/assets/Lunar-Colony-Dark.webp',
  },
]

/*──────────────────────────────────────────────────────────────────────────────
  SMALL COMPONENTS
──────────────────────────────────────────────────────────────────────────────*/

function StarField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Static stars */}
      {Array.from({ length: 60 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: `${Math.random() * 2 + 0.5}px`,
            height: `${Math.random() * 2 + 0.5}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.5 + 0.1,
            animation: `pulse ${Math.random() * 4 + 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  )
}

function ProgressBar({ phases: p }: { phases: Phase[] }) {
  const completed = p.filter((ph) => ph.status === 'completed').length
  const active = p.filter((ph) => ph.status === 'active').length
  const pct = ((completed + active * 0.5) / p.length) * 100

  return (
    <div className="w-full max-w-3xl mx-auto mb-4">
      <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono">
        <span>2021</span>
        <span>2030</span>
      </div>
      <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 transition-all duration-1000 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* Glow pip at the end of the bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-purple-400/80 border-2 border-purple-400 transition-all duration-1000 ease-out"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <p className="text-center text-sm text-gray-400 mt-3 font-mono">
        {completed} of {p.length} phases completed
      </p>
    </div>
  )
}

function MilestoneCheck({ done }: { done: boolean }) {
  return (
    <div
      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
        done
          ? 'bg-green-500/20 border-green-400'
          : 'bg-white/5 border-white/20'
      }`}
    >
      {done && (
        <svg
          className="w-3 h-3 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Phase['status'] }) {
  const map = {
    completed: {
      label: 'Completed',
      cls: 'bg-green-500/10 text-green-400 border-green-500/30',
    },
    active: {
      label: 'In Progress',
      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    upcoming: {
      label: 'Upcoming',
      cls: 'bg-white/5 text-gray-400 border-white/10',
    },
  }
  const { label, cls } = map[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${cls}`}
    >
      {status === 'active' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </span>
      )}
      {label}
    </span>
  )
}

/*──────────────────────────────────────────────────────────────────────────────
  PHASE CARD – the main visual unit
──────────────────────────────────────────────────────────────────────────────*/

function PhaseCard({
  phase,
  index,
  isExpanded,
  onToggle,
}: {
  phase: Phase
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const isEven = index % 2 === 0
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className={`relative flex flex-col lg:flex-row items-center gap-6 lg:gap-12 ${
        isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'
      }`}
    >
      {/* Connector dot on the vertical line (desktop) */}
      <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 z-20">
        <div
          className={`w-6 h-6 rounded-full bg-gradient-to-br ${phase.color} ring-4 ring-dark-cool ${phase.glowColor} shadow-lg`}
        />
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        onClick={onToggle}
        className={`
          relative w-full lg:w-[45%] cursor-pointer group
          ${isEven ? 'lg:mr-auto' : 'lg:ml-auto'}
        `}
      >
        {/* Glow behind */}
        <div
          className={`absolute -inset-1 rounded-2xl bg-gradient-to-r ${phase.color} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`}
        />

        <div
          className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
            isExpanded
              ? 'border-white/20 bg-white/[0.07] backdrop-blur-xl'
              : 'border-white/10 bg-white/[0.03] backdrop-blur-sm hover:border-white/20 hover:bg-white/[0.05]'
          }`}
        >
          {/* Optional phase image banner */}
          {phase.image && (
            <div className="relative h-44 sm:h-52 overflow-hidden">
              <Image
                src={phase.image}
                alt={phase.title}
                fill
                className="object-cover object-center opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                sizes="(max-width: 768px) 100vw, 45vw"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark-cool" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div
                  className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${phase.color} flex items-center justify-center shadow-lg ${phase.glowColor}`}
                >
                  <Image
                    src={phase.icon}
                    alt={phase.iconAlt}
                    width={phase.iconSize || 28}
                    height={phase.iconSize || 28}
                    className="brightness-0 invert opacity-90"
                  />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-gray-400">
                    {phase.era} &middot; {phase.year}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-GoodTimes text-white leading-tight">
                    {phase.title}
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {phase.subtitle}
                  </p>
                </div>
              </div>
              <StatusBadge status={phase.status} />
            </div>

            {/* Description */}
            <p className="text-gray-300 leading-relaxed mb-6 text-sm sm:text-base">
              {phase.description}
            </p>

            {/* Milestones — always visible */}
            <div className="space-y-3">
              {phase.milestones.map((m, mi) => (
                <div key={mi} className="flex items-start gap-3">
                  <MilestoneCheck done={m.done} />
                  <div>
                    <p
                      className={`font-semibold text-sm ${
                        m.done ? 'text-white' : 'text-gray-300'
                      }`}
                    >
                      {m.label}
                    </p>
                    {/* Expanded detail */}
                    <div
                      className={`overflow-hidden transition-all duration-500 ${
                        isExpanded
                          ? 'max-h-40 opacity-100 mt-1'
                          : 'max-h-0 opacity-0'
                      }`}
                    >
                      <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                        {m.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Expand hint */}
            <div className="mt-4 flex items-center justify-center">
              <button className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
                <svg
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/*──────────────────────────────────────────────────────────────────────────────
  PAGE
──────────────────────────────────────────────────────────────────────────────*/

export default function Roadmap() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)
  const [visiblePhases, setVisiblePhases] = useState<Set<string>>(new Set())
  const phaseRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Intersection Observer for scroll-reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisiblePhases((prev) => new Set(prev).add(entry.target.id))
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    )

    phaseRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Auto-expand active phase on first visit
  useEffect(() => {
    const activePhase = phases.find((p) => p.status === 'active')
    if (activePhase) setExpandedPhase(activePhase.id)
  }, [])

  return (
    <Container>
      <WebsiteHead
        title="Roadmap"
        description="MoonDAO's roadmap from launch to lunar settlement. Track our progress toward putting a permanent human presence on the Moon by 2030."
      />

      {/* ───── HERO ───── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="/assets/ngc6357_4k.webp"
            alt="Deep space"
            fill
            priority
            className="object-cover object-center opacity-40"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-dark-cool/60 via-dark-cool/30 to-dark-cool" />
        </div>

        <StarField />

        <div className="relative z-10 max-w-4xl mx-auto text-center px-6 py-32">
          <p className="text-sm font-mono uppercase tracking-[0.3em] text-purple-400 mb-6">
            The Internet's Space Program
          </p>
          <h1 className="font-GoodTimes text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white leading-none mb-8">
            Roadmap to
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              the Moon
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-12 leading-relaxed">
            From a decentralized community to a lunar settlement. Every phase
            brings humanity closer to a permanent presence on the Moon — funded,
            built, and governed by the people.
          </p>

          <ProgressBar phases={phases} />

          {/* Scroll hint */}
          <div className="mt-16 animate-bounce">
            <svg
              className="w-6 h-6 mx-auto text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ───── TIMELINE ───── */}
      <section className="relative py-20 sm:py-28 lg:py-36 overflow-hidden">
        {/* Vertical line */}
        <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        <div className="max-w-6xl mx-auto px-6 space-y-16 lg:space-y-24">
          {phases.map((phase, index) => (
            <div
              key={phase.id}
              id={phase.id}
              ref={(el) => {
                if (el) phaseRefs.current.set(phase.id, el)
              }}
              className={`transition-all duration-700 ${
                visiblePhases.has(phase.id)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-12'
              }`}
            >
              <PhaseCard
                phase={phase}
                index={index}
                isExpanded={expandedPhase === phase.id}
                onToggle={() =>
                  setExpandedPhase(
                    expandedPhase === phase.id ? null : phase.id
                  )
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* ───── DESTINATION ───── */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/assets/Lunar-Colony-Dark.webp"
            alt="Lunar Colony"
            fill
            className="object-cover object-center opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-dark-cool via-dark-cool/80 to-dark-cool" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
          <p className="text-sm font-mono uppercase tracking-[0.3em] text-yellow-400 mb-6">
            The Destination
          </p>
          <h2 className="font-GoodTimes text-4xl sm:text-5xl md:text-6xl text-white mb-8">
            Everyone's Moon
          </h2>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-12">
            Not one nation's flag — everyone's Moon. MoonDAO is building the
            first permanent lunar settlement owned and governed by a global
            decentralized community. When we celebrate New Year's Eve 2030 on
            the Moon, it will be humanity's achievement — not any single
            government's or corporation's.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <StandardButton
              backgroundColor="bg-white"
              textColor="text-black"
              hoverColor="bg-gray-100"
              borderRadius="rounded-tl-[10px] rounded-[2vmax]"
              link="/join"
              paddingOnHover="pl-5"
            >
              Join the Mission
            </StandardButton>
            <StandardButton
              backgroundColor="bg-white/10"
              textColor="text-white"
              hoverColor="hover:bg-white/20"
              borderRadius="rounded-tl-[10px] rounded-[2vmax]"
              link="/launch"
              paddingOnHover="pl-5"
            >
              Explore the Launchpad
            </StandardButton>
          </div>
        </div>
      </section>

      <PreFooter />
      <ExpandedFooter
        hasCallToAction={false}
        darkBackground={true}
        isFullwidth={true}
      />
    </Container>
  )
}
