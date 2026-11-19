import Image from 'next/image'
import Link from 'next/link'
import CtaButton from '@/components/home/landing/CtaButton'
import Reveal from '@/components/home/landing/Reveal'
import SectionHeading from '@/components/home/landing/SectionHeading'

const DUDE_PERFECT_VIDEO = 'https://www.youtube.com/watch?v=YXXlSG-du7c'

const milestones = [
  {
    when: '2022',
    title: 'The community picks an astronaut',
    body: 'MoonDAO members voted onchain to select Coby Cotton, Dude Perfect co-founder, as our first citizen astronaut.',
  },
  {
    when: 'Aug 2022',
    title: 'Liftoff on Blue Origin NS-22',
    body: 'Coby flew to the edge of space on a New Shepard rocket. The first crowdraised astronaut, sent up by a community.',
  },
  {
    when: 'Aug 2024',
    title: 'A second astronaut, Dr. Eiman Jahangir',
    body: 'An everyday person, chosen through an onchain sweepstakes, flew on Blue Origin NS-26.',
  },
  {
    when: 'Early 2025',
    title: 'Our constitution lands on the Moon',
    body: 'We wrote a constitution for self-governance and sent it to the lunar surface.',
  },
]

export default function DudePerfectStory() {
  return (
    <section id="the-story" className="relative overflow-hidden bg-[#010208] py-24 md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_30%,rgba(66,94,235,0.1),transparent_55%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-14 px-5 md:px-10 lg:grid-cols-2 lg:gap-20">
        <Reveal y={40}>
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-[#425EEB]/25 to-[#6C407D]/25 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              <Image
                src="/assets/dude-perfect.jpg"
                alt="Coby Cotton and the MoonDAO crew in front of the Blue Origin New Shepard rocket"
                width={2048}
                height={1366}
                className="h-auto w-full"
                sizes="(min-width: 1024px) 640px, 100vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#010208] to-transparent px-6 pb-5 pt-16">
                <p className="font-RobotoMono text-[10px] uppercase tracking-[0.18em] text-white/60">
                  Coby Cotton with the MoonDAO crew · Blue Origin NS-22
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col gap-8">
          <SectionHeading
            align="left"
            eyebrow="The Story"
            title="That flight was powered by a community vote"
            description="Coby wasn't chosen by a boardroom. A global community of space fans picked him and crowdraised his flight. We did it again two years later. That community is MoonDAO, and it's open to you."
          />

          <ol className="relative flex flex-col gap-6 border-l border-white/10 pl-7">
            {milestones.map((m, i) => (
              <Reveal key={m.title} delay={0.1 + i * 0.08}>
                <li className="relative">
                  <span className="absolute -left-[34px] top-1.5 h-3 w-3 rounded-full bg-moon-gold ring-4 ring-[#010208]" />
                  <p className="font-RobotoMono text-[11px] uppercase tracking-[0.22em] text-moon-gold">
                    {m.when}
                  </p>
                  <h3 className="mt-1 font-heading font-semibold text-lg text-white">{m.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/65 md:text-base">
                    {m.body}
                  </p>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={0.3}>
            <CtaButton href={DUDE_PERFECT_VIDEO} target="_blank" variant="secondary">
              Rewatch Dude Perfect Goes to Space
            </CtaButton>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export function WhatIsMoonDAO() {
  const pillars = [
    {
      title: 'Fund the future of space',
      body: 'Citizens vote on proposals and direct the treasury. $750,000+ has gone to 100+ space projects, from zero-g research to lunar habitat design.',
      href: '/proposals',
      cta: 'Browse funded projects',
    },
    {
      title: 'Fly everyday people to space',
      body: 'Two citizen astronauts launched. Zero-G flights, training, and more spaceflight opportunities are on the way for the community.',
      href: '/marketplace',
      cta: 'Explore experiences',
    },
    {
      title: 'Build in the open, onchain',
      body: 'Every proposal, vote and treasury movement is public. No gatekeepers, no black box. You can verify where every dollar goes.',
      href: '/treasury',
      cta: 'View the treasury',
    },
    {
      title: 'Go back to the Moon, together',
      body: 'We are coordinating teams, funding and tools to accelerate a permanent lunar settlement. Our constitution is already up there.',
      href: '/constitution',
      cta: 'Read the constitution',
    },
  ]

  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(108,64,125,0.12),transparent_55%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <SectionHeading
          eyebrow="What is MoonDAO?"
          title={
            <>
              The Internet&apos;s <span className="text-moon-gold">Space Program</span>
            </>
          }
          description="MoonDAO is an open platform to fund, collaborate and compete on challenges that get humanity closer to a permanent lunar settlement. It is governed by its members and transparent by design. Citizens are those members."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-6">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={0.08 * (i % 2)} className="h-full">
              <Link
                href={p.href}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.06] md:p-8"
              >
                <h3 className="font-heading font-semibold text-lg text-white md:text-xl">
                  {p.title}
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-white/65 md:text-base">
                  {p.body}
                </p>
                <span className="font-RobotoMono text-[11px] uppercase tracking-[0.16em] text-white/40 transition-colors duration-300 group-hover:text-white/80">
                  {p.cta} →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
