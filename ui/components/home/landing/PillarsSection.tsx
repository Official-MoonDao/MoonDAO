import Image from 'next/image'
import Link from 'next/link'
import { ReactNode } from 'react'
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
    link: '/docs',
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
    paragraph: 'Allocated $750,000+ to 100+ projects via open community governance.',
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

function PillarCard({ pillar }: { pillar: Pillar }) {
  return (
    <Link
      href={pillar.link}
      className="group flex h-full flex-col gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.05] md:p-8"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
        <Image src={pillar.icon} alt={pillar.iconAlt} width={28} height={28} className="h-7 w-7" />
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <h3 className="font-heading font-semibold text-lg leading-tight text-white md:text-xl">
          {pillar.header}
        </h3>
        <p className="text-sm leading-relaxed text-white/65 md:text-base">{pillar.paragraph}</p>
      </div>

      <div className="flex items-center gap-2 font-RobotoMono text-[11px] uppercase tracking-[0.16em] text-white/40 transition-colors duration-300 group-hover:text-white/80">
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(66,94,235,0.07),transparent_55%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <SectionHeading
          eyebrow="What We Do"
          title="A Track Record Written Onchain"
          description="From sending everyday people to space to landing a constitution on the Moon — MoonDAO turns collective ambition into verifiable results."
        />

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
          {pillars.map((pillar, i) => (
            <Reveal key={pillar.header} delay={0.08 * (i % 3)} className="h-full">
              <PillarCard pillar={pillar} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
