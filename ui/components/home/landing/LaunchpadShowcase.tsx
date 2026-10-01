import Image from 'next/image'
import CtaButton from './CtaButton'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

const features = [
  {
    icon: '/assets/icon-globe.svg',
    title: 'Global Access',
    description: 'Tap into a global crypto network with trillions of dollars at your fingertips.',
  },
  {
    icon: '/assets/icon-signature.svg',
    title: '100% Transparent',
    description: 'Every transaction is onchain and fully visible to all.',
  },
  {
    icon: '/assets/icon-fasttrack.svg',
    title: 'Launch in Minutes',
    description: 'Fund your mission in minutes, not months, with instant access to capital.',
  },
]

export default function LaunchpadShowcase() {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_50%,rgba(95,75,162,0.08),transparent_55%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-14 px-5 md:px-10 lg:grid-cols-2 lg:gap-20">
        <Reveal y={40} className="order-2 lg:order-1">
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              <Image
                src="/assets/launchpad/moondao-launchpad-hero.png"
                alt="MoonDAO Launchpad"
                width={900}
                height={1100}
                className="h-[380px] w-full object-cover md:h-[480px]"
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
            title="Fund the Next Giant Leap"
            description="Decentralized crowdfunding for space missions — built on the platform that already sent two people to space and a constitution to the Moon."
          />

          <div className="flex flex-col">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={0.15 + i * 0.1} x={24} y={0}>
                <div className="flex items-start gap-4 border-t border-white/[0.08] py-4">
                  <Image
                    src={feature.icon}
                    alt=""
                    width={22}
                    height={22}
                    className="mt-0.5 h-5 w-5 flex-shrink-0 opacity-80"
                  />
                  <div>
                    <h4 className="font-semibold text-white">{feature.title}</h4>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-white/60 md:text-base">
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
