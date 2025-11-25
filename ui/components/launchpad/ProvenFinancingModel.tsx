import Image from 'next/image'
import AchievementCard from './AchievementCard'

export default function ProvenFinancingModel() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/assets/launchpad/Lunar-Crystals.png"
          alt="Lunar Crystals Background"
          fill
          className="object-cover object-center"
          priority
          quality={100}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white mb-4 md:mb-6">
            Proven Financing Model
          </h2>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
            <AchievementCard
              value="$8"
              label="Million"
              description="Dollars raised through decentralized funding."
              icon="/assets/icon-raised-tokens.svg"
              gradientFrom="from-[#6C407D]/20"
              gradientTo="to-[#5F4BA2]/20"
            />
            <AchievementCard
              value="12,000"
              label="holders"
              description="$MOONEY token holders."
              icon="/assets/icon-powerful.svg"
              gradientFrom="from-[#4660E7]/20"
              gradientTo="to-[#6C407D]/20"
            />
            <AchievementCard
              value="80"
              label="Projects"
              description="Successfully funded and launched."
              icon="/assets/icon-lightbulb.svg"
              gradientFrom="from-[#5F4BA2]/20"
              gradientTo="to-[#5159CC]/20"
            />
            <AchievementCard
              value="2"
              label="People"
              description="Successfully sent to space."
              icon="/assets/icon-fasttrack.svg"
              gradientFrom="from-[#5159CC]/20"
              gradientTo="to-[#4660E7]/20"
            />
          </div>
        </div>

        <div className="text-center mt-12 md:mt-16 lg:mt-20 px-4">
          <p className="max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl text-white/90 text-sm md:text-lg lg:text-xl xl:text-2xl font-semibold leading-relaxed mx-auto">
            <span className="hidden md:inline">
              MoonDAO's journey from concept to space, powered by decentralized funding.
              <br />
              We raised millions, engaged thousands, funded over 80 projects, and sent two people to
              space.
            </span>
            <span className="inline md:hidden">
              MoonDAO's journey from concept to space, powered by decentralized funding. We raised
              millions, engaged thousands, funded over 80 projects, and sent two people to space.
            </span>
          </p>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent"></div>
      <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent"></div>
    </section>
  )
}
