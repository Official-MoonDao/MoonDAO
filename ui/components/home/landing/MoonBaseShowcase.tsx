import Image from 'next/image'
import CtaButton from './CtaButton'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

const features = [
  {
    title: 'Real Hardware',
    description:
      'Every lander, rover and habitat is a real project from a real company or space agency.',
  },
  {
    title: 'True to Scale',
    description: 'Built on real NASA terrain of the Shackleton connecting ridge at the lunar south pole.',
  },
  {
    title: 'Watch It Arrive',
    description: 'Scrub the timeline to see what lands on the Moon each year, and who is leading each race.',
  },
]

export default function MoonBaseShowcase() {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(103,232,249,0.06),transparent_60%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-12 px-5 md:gap-16 md:px-10">
        <SectionHeading
          eyebrow="Moon Base Zero"
          title="See Every Race on the Moon"
          description="An interactive model of the first lunar base, showing where each serious program would stand on the ridge and how close it is to getting there."
        />

        <Reveal y={40}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10">
            <Image
              src="/assets/home/moon-base-zero.webp"
              alt="Moon Base Zero: landers, rovers, habitats and solar fields laid out along the Shackleton connecting ridge"
              width={2400}
              height={1030}
              sizes="(min-width: 1400px) 1320px, 100vw"
              className="h-[260px] w-full object-cover md:h-[420px] lg:h-[560px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#010208]/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-2 font-RobotoMono text-[10px] uppercase tracking-[0.22em] text-white/60 md:text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Lunar South Pole · Shackleton Ridge
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-x-10 md:grid-cols-3">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={0.15 + i * 0.1}>
              <div className="border-t border-white/[0.08] py-4">
                <h4 className="font-semibold text-white">{feature.title}</h4>
                <p className="mt-1 text-sm leading-relaxed text-white/60 md:text-base">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.45}>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <CtaButton href="/moonbase" variant="primary">
              Explore Moon Base Zero
            </CtaButton>
            <CtaButton href="/moonbase/tour" variant="quiet">
              Take the tour
            </CtaButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
