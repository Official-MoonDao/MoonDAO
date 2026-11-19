import Image from 'next/image'
import { CitizenOffer } from '@/lib/citizen/useCitizenOffer'
import CtaButton from '@/components/home/landing/CtaButton'
import Reveal from '@/components/home/landing/Reveal'
import SectionHeading from '@/components/home/landing/SectionHeading'
import MailingList from '@/components/layout/MailingList'

const steps = [
  {
    n: '01',
    title: 'Create your citizen profile',
    body: 'Sign in and tell the network who you are. Add your name, photo and what you want to work on.',
  },
  {
    n: '02',
    title: 'Activate your 12-month passport',
    body: 'One yearly payment makes you an official citizen of the Space Acceleration Network, recorded onchain.',
  },
  {
    n: '03',
    title: 'Start building the future',
    body: 'Vote on proposals, apply to citizens-only jobs, pitch your own project, and earn quarterly rewards.',
  },
]

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-32">
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 md:px-10">
        <SectionHeading
          eyebrow="How it works"
          title="From fan to citizen in three steps"
          description="No space background needed. If you can watch a Dude Perfect video, you can be a citizen."
        />
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={0.1 * i} className="h-full">
              <div className="relative flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-7 md:p-8">
                <span className="font-heading font-semibold text-4xl text-white/15">{s.n}</span>
                <h3 className="font-heading font-semibold text-lg text-white md:text-xl">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-white/65 md:text-base">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const perks = [
  'Get your space project funded in weeks, not years',
  'Apply to citizens-only jobs and paid roles',
  'Earn quarterly rewards for what you contribute',
  'Vote on proposals and help steer the treasury',
  'Eligible for training and spaceflight opportunities',
  'Join a global community of builders, founders and astronauts',
]

export function OfferSection({ offer }: { offer: CitizenOffer }) {
  return (
    <section
      id="join"
      data-cta-location="dp_offer"
      className="relative overflow-hidden bg-[#010208] py-24 md:py-32"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(66,94,235,0.18),transparent_60%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-5 md:px-10">
        <SectionHeading
          eyebrow="Your citizen passport"
          title={
            <>
              One passport. A{' '}
              <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
                seat in the space program
              </span>
            </>
          }
          description="Citizenship is how you plug into everything MoonDAO does: funding, jobs, rewards, governance and flight opportunities."
        />

        <Reveal delay={0.1} y={40}>
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-blue-400/40 bg-white/[0.04] shadow-[0_0_60px_rgba(37,99,235,0.18)] backdrop-blur-md md:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col gap-5 p-7 md:p-10">
              <h3 className="font-heading font-semibold text-xl text-white md:text-2xl">
                What you get as a citizen
              </h3>
              <ul className="flex flex-col gap-3">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-3 text-white/80">
                    <svg
                      className="mt-1 h-4 w-4 flex-shrink-0 text-[#22d3ee]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span className="text-sm md:text-base">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative flex flex-col items-center justify-center gap-4 border-t border-white/10 bg-gradient-to-br from-[#425EEB]/20 to-[#6C407D]/20 p-7 text-center md:border-l md:border-t-0 md:p-10">
              <div className="h-20 w-20 overflow-hidden rounded-xl ring-1 ring-white/20">
                <Image
                  src="/assets/citizen-default.webp"
                  alt="MoonDAO citizen passport"
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              </div>
              {offer.isCitizen ? (
                <p className="text-base text-white/80">
                  You&apos;re already a citizen. Thanks for being part of the mission.
                </p>
              ) : (
                <>
                  <div>
                    <p className="font-heading font-semibold text-3xl text-white md:text-4xl">
                      {offer.yearLabel}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      About ${offer.perMonthUsd} a month. 12-month passport.
                    </p>
                  </div>
                  {offer.cardCheckoutLive && (
                    <p className="text-xs text-white/50">
                      Pay with Apple Pay, Google Pay, or a debit card.
                    </p>
                  )}
                </>
              )}
              <CtaButton href={offer.ctaHref} variant="primary" className="w-full">
                {offer.ctaLabel}
              </CtaButton>
              <p className="text-xs text-white/40">Your citizenship is recorded onchain.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function StayInTheLoop() {
  return (
    <section className="relative overflow-hidden bg-[#010208] pb-24 md:pb-32">
      <div className="relative z-10 mx-auto flex w-full max-w-[700px] flex-col items-center gap-4 px-5 text-center md:px-10">
        <Reveal>
          <p className="font-RobotoMono text-[11px] uppercase tracking-[0.25em] text-white/45">
            Not ready yet? Stay in the loop
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-sm text-white/65 md:text-base">
            Get weekly mission updates and new ways to get involved, straight to your inbox.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <MailingList submitLabel="Subscribe" quietSubmit compact ctaLocation="dp_mailing_list" />
        </Reveal>
      </div>
    </section>
  )
}
