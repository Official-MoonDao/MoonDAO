import Image from 'next/image'
import BenefitCard from './BenefitCard'

export default function GoFurtherTogether() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/assets/launchpad/Astronaut-Handshake.png"
          alt="Astronaut Handshake Background"
          fill
          className="object-cover object-center"
          priority
          quality={100}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white mb-4 md:mb-6">
            Go Further Together
          </h2>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-12 items-center">
            <BenefitCard
              title="Finance"
              description="Fund with your debit card, even if you've never used crypto. Get refunded if a mission fails to reach its funding goal."
              icon="/assets/icon-crowdfunding.svg"
              gradientFrom="from-[#6C407D]/40"
              gradientTo="to-[#5F4BA2]/40"
            />
            <BenefitCard
              title="Coordinate"
              description="Contributions earn mission tokens that give you a stake in the journey, allowing you to help shape and govern the outcome."
              icon="/assets/icon-fasttrack.svg"
              gradientFrom="from-[#5F4BA2]/60"
              gradientTo="to-[#5159CC]/60"
            />
            <BenefitCard
              title="Verify"
              description="Secured by code, not promises. 100% transparent use of funds onchain, allowing contributors to trace how funds were spent."
              icon="/assets/icon-lightbulb.svg"
              gradientFrom="from-[#5159CC]/60"
              gradientTo="to-[#4660E7]/60"
            />
          </div>
        </div>

        <div className="flex flex-col items-center mt-12 md:mt-16 lg:mt-20 px-4">
          <p className="text-center max-w-2xl md:max-w-3xl lg:max-w-4xl text-white/90 text-sm md:text-lg lg:text-xl xl:text-2xl font-semibold leading-relaxed">
            <span className="hidden md:inline">
              Join a revolution in space funding. Unlike traditional fundraising, your community can
              <br />
              immediately coordinate governance, access liquidity, and grow into a viral movement.
            </span>
            <span className="inline md:hidden">
              Join a revolution in space funding. Unlike traditional fundraising, your community
              can immediately coordinate governance, access liquidity, and grow into a viral
              movement.
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}

