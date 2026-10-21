import { OddsRaceScene } from '@/components/deprize/howItWorks/scenes'
import CtaButton from './CtaButton'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

const steps = [
  {
    title: 'Predict for Free',
    description: 'Pick who you think reaches a lunar milestone first. It costs nothing and anyone can do it.',
  },
  {
    title: 'Back Your Pick',
    description: 'Where available, back a team with ETH. Every bet moves the odds and grows the prize.',
  },
  {
    title: 'Winner Takes the Prize',
    description: 'Experts check the evidence, the Senate votes, and the result is settled onchain.',
  },
]

export default function DePrizeShowcase() {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_50%,rgba(52,211,153,0.06),transparent_55%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-14 px-5 md:px-10 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-10">
          <SectionHeading
            align="left"
            eyebrow="DePrize"
            title="Who Gets to the Moon First?"
            description="Each DePrize is an open race to a real lunar milestone, like landing on the Moon or making fuel there. The prize goes to the team that gets there first."
          />

          <div className="flex flex-col">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={0.15 + i * 0.1} x={-24} y={0}>
                <div className="flex items-start gap-4 border-t border-white/[0.08] py-4">
                  <span className="mt-0.5 w-5 flex-shrink-0 font-RobotoMono text-xs text-white/40">
                    0{i + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold text-white">{step.title}</h4>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-white/60 md:text-base">
                      {step.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.45}>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
              <CtaButton href="/deprize" variant="primary">
                Browse DePrizes
              </CtaButton>
              <CtaButton href="/deprize/how-it-works" variant="quiet">
                How it works
              </CtaButton>
            </div>
          </Reveal>
        </div>

        <Reveal y={40}>
          <OddsRaceScene />
        </Reveal>
      </div>
    </section>
  )
}
