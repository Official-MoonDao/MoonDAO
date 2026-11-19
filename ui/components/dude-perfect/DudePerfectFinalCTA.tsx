import Image from 'next/image'
import { CitizenOffer } from '@/lib/citizen/useCitizenOffer'
import CtaButton from '@/components/home/landing/CtaButton'
import Reveal from '@/components/home/landing/Reveal'
import Starfield from '@/components/home/landing/Starfield'

export default function DudePerfectFinalCTA({ offer }: { offer: CitizenOffer }) {
  return (
    <section
      data-cta-location="dp_final_cta"
      className="relative overflow-hidden bg-[#010208] py-24 md:py-36"
    >
      <div className="absolute inset-0">
        <Image
          src="/assets/landing/earthrise.jpg"
          alt=""
          fill
          className="object-cover opacity-50"
          style={{ objectPosition: 'center 35%' }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208] via-[#010208]/55 to-dark-cool" />
      </div>
      <Starfield className="opacity-60" />

      <div className="relative z-10 mx-auto flex w-full max-w-[900px] flex-col items-center px-5 text-center md:px-10">
        <Reveal>
          <span className="font-RobotoMono text-[11px] uppercase tracking-[0.28em] text-moon-gold">
            The mission needs you
          </span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-5 max-w-3xl font-heading font-semibold text-3xl leading-[1.15] text-white md:text-5xl">
            Coby went to space. What will you do?
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
            Become a citizen, pitch a project, vote on the next mission, and help take humanity back
            to the Moon.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <CtaButton href={offer.ctaHref} variant="primary">
              {offer.ctaLabel}
            </CtaButton>
            <CtaButton href="https://moondao.com/discord" target="_blank" variant="quiet">
              Ask us anything on Discord
            </CtaButton>
          </div>
          {!offer.isCitizen && (
            <p className="mt-5 font-RobotoMono text-[11px] uppercase tracking-[0.16em] text-white/45">
              12-month passport · {offer.yearLabel}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  )
}
