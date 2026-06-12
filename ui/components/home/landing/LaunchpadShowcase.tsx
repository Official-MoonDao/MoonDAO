import Image from 'next/image'
import CtaButton from './CtaButton'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

const features = [
  {
    icon: '/assets/icon-globe.svg',
    title: 'Global Access',
    description:
      'Tap into a global crypto network with trillions of dollars at your fingertips.',
  },
  {
    icon: '/assets/icon-signature.svg',
    title: '100% Transparent',
    description:
      'Every transaction is onchain and fully visible to all.',
  },
  {
    icon: '/assets/icon-fasttrack.svg',
    title: 'Launch in Minutes',
    description:
      'Fund your mission in minutes, not months, with instant access to capital.',
  },
]

export default function LaunchpadShowcase() {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_50%,rgba(95,75,162,0.2),transparent_55%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-14 px-5 md:px-10 lg:grid-cols-2 lg:gap-20">
        <Reveal y={40} className="order-2 lg:order-1">
          <div className="group relative animate-float">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#6C407D]/50 via-[#5F4BA2]/40 to-[#4660E7]/40 opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-90" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10">
              <Image
                src="/assets/launchpad/moondao-launchpad-hero.png"
                alt="MoonDAO Launchpad"
                width={900}
                height={1100}
                className="h-[420px] w-full object-cover transition-transform duration-700 group-hover:scale-105 md:h-[560px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#010208]/85 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="font-GoodTimes text-lg text-white md:text-xl">
                  Launch Your Space Mission
                </p>
                <p className="mt-1 text-sm text-white/70 md:text-base">
                  Access global funding for your space venture
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="order-1 flex flex-col gap-10 lg:order-2">
          <SectionHeading
            align="left"
            eyebrow="Launchpad"
            title={
              <>
                Fund the Next{' '}
                <span className="bg-gradient-to-r from-[#b07ce8] to-[#22d3ee] bg-clip-text text-transparent">
                  Giant Leap
                </span>
              </>
            }
            description="Decentralized crowdfunding for space missions — built on the platform that already sent two people to space and a constitution to the Moon."
          />

          <div className="flex flex-col gap-4">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={0.15 + i * 0.1} x={24} y={0}>
                <div className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md transition-all duration-300 hover:translate-x-2 hover:border-white/25">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C407D]/40 to-[#4660E7]/40 ring-1 ring-white/15">
                    <Image
                      src={feature.icon}
                      alt=""
                      width={22}
                      height={22}
                      className="h-5 w-5"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{feature.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-white/60 md:text-base">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.45}>
            <CtaButton href="/launch" variant="primary">
              Launch Your Mission
            </CtaButton>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
