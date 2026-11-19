import { useState } from 'react'
import { CitizenOffer } from '@/lib/citizen/useCitizenOffer'
import Reveal from '@/components/home/landing/Reveal'
import SectionHeading from '@/components/home/landing/SectionHeading'

type Faq = { q: string; a: string }

function buildFaqs(offer: CitizenOffer): Faq[] {
  return [
    {
      q: 'What exactly is MoonDAO?',
      a: 'MoonDAO is an open, member-governed space program. Our community funds space projects, selects and launches citizen astronauts, and coordinates the work needed to reach a permanent lunar settlement. Everything runs in public, onchain.',
    },
    {
      q: 'What does being a citizen actually get me?',
      a: 'Citizens can pitch projects for funding, apply to citizens-only jobs, earn quarterly rewards for their contributions, vote on proposals, and become eligible for training and spaceflight opportunities. You also join a global community of people who work on space.',
    },
    {
      q: 'How much does it cost, and how long does it last?',
      a: `A citizen passport is ${offer.yearLabel.replace(
        ' / Year',
        ' per year'
      )} and lasts 12 months. You can renew to stay a citizen.`,
    },
    {
      q: 'Do I need to know crypto?',
      a: offer.cardCheckoutLive
        ? 'No. You can pay with Apple Pay, Google Pay, or a debit card. The onchain parts are handled for you, and our community is happy to help in Discord.'
        : 'It helps to have a crypto wallet, but you do not need to be an expert. Our community is happy to walk you through it in Discord.',
    },
    {
      q: 'Will I get to go to space?',
      a: "We can't promise a flight. Two people have flown so far, chosen by the community, and citizens are eligible for future astronaut selections, zero-gravity flights and training. Citizenship is how you get in line for those chances.",
    },
    {
      q: 'Can I trust where the money goes?',
      a: 'Every proposal, vote and treasury movement is public, and you can inspect the treasury yourself. Our work has been covered by outlets like Space.com, and our constitution has landed on the Moon.',
    },
    {
      q: 'I have a question that is not answered here.',
      a: 'Join us on Discord and ask in the support channel. The community is happy to help.',
    },
  ]
}

export default function DudePerfectFAQ({ offer }: { offer: CitizenOffer }) {
  const [open, setOpen] = useState<number | null>(0)
  const faqs = buildFaqs(offer)

  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-32">
      <div className="relative z-10 mx-auto w-full max-w-[860px] px-5 md:px-10">
        <SectionHeading eyebrow="FAQ" title="Questions before you launch?" />

        <div className="mt-12 flex flex-col gap-3">
          {faqs.map((faq, i) => {
            const isOpen = open === i
            return (
              <Reveal key={faq.q} delay={0.04 * i}>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="font-heading font-semibold text-base text-white md:text-lg">
                      {faq.q}
                    </span>
                    <svg
                      className={`h-5 w-5 flex-shrink-0 text-white/60 transition-transform duration-300 ${
                        isOpen ? 'rotate-45' : ''
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  {isOpen && (
                    <p className="px-6 pb-6 text-sm leading-relaxed text-white/70 md:text-base">
                      {faq.a}
                    </p>
                  )}
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
