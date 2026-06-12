import Image from 'next/image'
import Link from 'next/link'
import { MouseEvent, ReactNode, useRef, useState } from 'react'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

type Pillar = {
  icon: string
  iconAlt: string
  header: string
  link: string
  hovertext: string
  paragraph: ReactNode
}

const pillars: Pillar[] = [
  {
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Astronaut',
    header: 'Human Spaceflight',
    link: '/about',
    hovertext: 'Our Story',
    paragraph:
      'Sent the first crowdraised astronaut to space, selected via onchain voting — and a second everyday person via onchain sweepstakes.',
  },
  {
    icon: '/assets/icon-ethereum.svg',
    iconAlt: 'Ethereum',
    header: 'Fund Space R&D',
    link: '/proposals',
    hovertext: 'Browse Proposals',
    paragraph:
      'Allocated $600,000+ to over 75 projects via open community governance.',
  },
  {
    icon: '/assets/icon-plane.svg',
    iconAlt: 'Plane',
    header: 'Space Training',
    link: '/marketplace',
    hovertext: 'Explore Experiences',
    paragraph:
      'Training future space travelers with zero gravity flights and other innovative missions.',
  },
  {
    icon: '/assets/icon-dao.svg',
    iconAlt: 'DAO',
    header: 'Industry Onchain',
    link: '/network',
    hovertext: 'Join the Network',
    paragraph:
      'The Space Acceleration Network connects individuals and organizations with funding, tools, and support to turn bold ideas into reality.',
  },
  {
    icon: '/assets/icon-lander.svg',
    iconAlt: 'Lander',
    header: 'Landed on the Moon',
    link: '/constitution',
    hovertext: 'Read the Constitution',
    paragraph:
      'Established a constitution for self-governance, which landed on the surface of the Moon in early 2025.',
  },
  {
    icon: '/assets/icon-governance.svg',
    iconAlt: 'Governance',
    header: 'Transparent Governance',
    link: '/treasury',
    hovertext: 'View Treasury',
    paragraph:
      'Every proposal, vote, and treasury movement is onchain — full transparency and accountability.',
  },
]

function TiltCard({ pillar }: { pillar: Pillar }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [transform, setTransform] = useState('')
  const [glow, setGlow] = useState({ x: '50%', y: '50%', visible: false })

  const handleMouseMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTransform(
      `perspective(900px) rotateX(${py * -7}deg) rotateY(${px * 9}deg) translateY(-4px)`
    )
    setGlow({
      x: `${((px + 0.5) * 100).toFixed(1)}%`,
      y: `${((py + 0.5) * 100).toFixed(1)}%`,
      visible: true,
    })
  }

  const reset = () => {
    setTransform('')
    setGlow((g) => ({ ...g, visible: false }))
  }

  return (
    <Link
      ref={ref}
      href={pillar.link}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      style={{ transform }}
      className="group relative flex h-full flex-col gap-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-md transition-[border-color,box-shadow] duration-300 hover:border-white/30 hover:shadow-[0_20px_60px_-20px_rgba(66,94,235,0.5)] md:p-8"
    >
      {/* Cursor-tracking glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: glow.visible ? 1 : 0,
          background: `radial-gradient(420px circle at ${glow.x} ${glow.y}, rgba(124,140,255,0.16), transparent 45%)`,
        }}
      />

      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#425EEB]/30 to-[#6C407D]/30 ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-110">
        <Image
          src={pillar.icon}
          alt={pillar.iconAlt}
          width={30}
          height={30}
          className="h-7 w-7"
        />
      </div>

      <div className="relative flex flex-1 flex-col gap-3">
        <h3 className="font-GoodTimes text-lg text-white md:text-xl">
          {pillar.header}
        </h3>
        <p className="text-sm leading-relaxed text-white/65 md:text-base">
          {pillar.paragraph}
        </p>
      </div>

      <div className="relative flex items-center gap-2 font-RobotoMono text-xs uppercase tracking-[0.2em] text-[#7c8cff] opacity-70 transition-all duration-300 group-hover:gap-3 group-hover:opacity-100">
        {pillar.hovertext}
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </div>
    </Link>
  )
}

export default function PillarsSection() {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(66,94,235,0.14),transparent_55%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <SectionHeading
          eyebrow="What We Do"
          title={
            <>
              A Track Record{' '}
              <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
                Written Onchain
              </span>
            </>
          }
          description="From sending everyday people to space to landing a constitution on the Moon — MoonDAO turns collective ambition into verifiable results."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
          {pillars.map((pillar, i) => (
            <Reveal key={pillar.header} delay={0.08 * (i % 3)} className="h-full">
              <TiltCard pillar={pillar} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
