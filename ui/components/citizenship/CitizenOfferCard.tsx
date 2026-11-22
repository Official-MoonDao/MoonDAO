import Image from 'next/image'
import { forwardRef } from 'react'
import SectionHeading from '@/components/home/landing/SectionHeading'
import StandardButton from '@/components/layout/StandardButton'

type CitizenOfferCardProps = {
  price: string
  cardCheckoutLive: boolean
  href: string
  benefits: string[]
}

/**
 * The /join "Become a Citizen" price card, on its own, with what is included
 * and the renewal terms next to the button.
 */
const CitizenOfferCard = forwardRef<HTMLElement, CitizenOfferCardProps>(function CitizenOfferCard(
  { price, cardCheckoutLive, href, benefits },
  ref
) {
  return (
    <section
      ref={ref}
      id="offer"
      data-cta-location="paid_landing_offer"
      className="relative w-full overflow-hidden bg-[#010208] py-20 md:py-28"
    >
      <div className="absolute inset-0">
        <Image src="/assets/JoinImage.webp" alt="" fill className="object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208] via-[#010208]/40 to-[#010208]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6">
        <SectionHeading eyebrow="Citizenship" title="Become a Citizen" />

        <div className="mt-10 w-full max-w-md">
          <div className="relative h-full rounded-2xl border-2 border-blue-400/40 bg-white/5 p-6 shadow-[0_0_40px_rgba(37,99,235,0.15)] backdrop-blur-sm md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 h-24 w-24 overflow-hidden rounded-xl">
                <Image
                  src="/assets/citizen-default.webp"
                  width={96}
                  height={96}
                  alt="MoonDAO Citizen passport"
                  className="h-full w-full object-cover"
                />
              </div>
              <ul className="mb-6 w-full max-w-xs space-y-2 text-left leading-relaxed text-slate-300">
                {benefits.map((benefit) => (
                  <li key={benefit}>✓ {benefit}</li>
                ))}
              </ul>
              <div className="mb-6 flex flex-col items-center">
                <div className="text-3xl font-semibold text-white">{price}</div>
                <div className="mt-2 text-sm font-medium text-green-400">✓ 12-Month Passport</div>
                <p className="mt-2 max-w-[18rem] text-xs text-slate-400">
                  {cardCheckoutLive ? 'Pay with Apple Pay, Google Pay, or a debit card. ' : ''}
                  Citizenship lasts 12 months and does not renew automatically.
                </p>
              </div>
              <StandardButton
                className="gradient-2 w-full transition-opacity hover:opacity-90"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link={href}
              >
                Become a Citizen
              </StandardButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
})

export default CitizenOfferCard
