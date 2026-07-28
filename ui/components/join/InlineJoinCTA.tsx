import CtaButton from '@/components/home/landing/CtaButton'
import Reveal from '@/components/home/landing/Reveal'

type InlineJoinCTAProps = {
  headline: string
  subtext?: string
}

// A lightweight, repeatable "Become a Citizen" nudge dropped between other
// sections — the page's primary conversion goal, so it shouldn't only live in
// the hero and the pricing cards at the very bottom.
export default function InlineJoinCTA({ headline, subtext }: InlineJoinCTAProps) {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-16 md:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(66,94,235,0.12),transparent_60%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-[800px] flex-col items-center gap-6 px-6 text-center md:px-10">
        <Reveal>
          <h3 className="font-GoodTimes text-xl text-white md:text-2xl">{headline}</h3>
        </Reveal>
        {subtext && (
          <Reveal delay={0.1}>
            <p className="text-sm text-white/65 md:text-base">{subtext}</p>
          </Reveal>
        )}
        <Reveal delay={0.2}>
          <CtaButton href="/citizen" variant="primary">
            Become a Citizen
          </CtaButton>
        </Reveal>
      </div>
    </section>
  )
}
