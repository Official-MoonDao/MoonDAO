import Image from 'next/image'
import StandardButton from '../layout/StandardButton'

export default function LaunchpadSection() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0A0A0A] via-[#1A1A2E] to-[#16213E]">
      {/* Background elements */}
      <div className="absolute inset-0">
        {/* Animated space background */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] rounded-full opacity-20 blur-xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-24 h-24 bg-gradient-to-r from-[#5159CC] to-[#4660E7] rounded-full opacity-30 blur-lg animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-gradient-to-r from-[#4660E7] to-[#6C407D] rounded-full opacity-25 blur-lg animate-pulse delay-2000"></div>
        
        {/* Constellation dots */}
        <div className="absolute top-1/5 right-1/3 w-1 h-1 bg-white/30 rounded-full"></div>
        <div className="absolute top-2/5 left-1/5 w-1 h-1 bg-cyan-400/40 rounded-full"></div>
        <div className="absolute top-3/5 right-1/4 w-1 h-1 bg-purple-400/30 rounded-full"></div>
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-pink-400/40 rounded-full"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-GoodTimes text-white mb-6 md:mb-8">
            MoonDAO Launchpad
          </h2>
          <p className="text-white/90 text-lg md:text-xl lg:text-2xl max-w-4xl mx-auto leading-relaxed">
            Fund the future of space exploration with decentralized crowdfunding.
            Join our proven platform that has already sent people to space.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center mb-16 md:mb-20">
            {/* Left Column - Hero Image */}
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src="/assets/launchpad/moondao-launchpad-hero.png"
                  alt="MoonDAO Launchpad"
                  width={600}
                  height={400}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white font-bold text-xl md:text-2xl mb-2">
                    Launch Your Space Mission
                  </h3>
                  <p className="text-white/80 text-sm md:text-base">
                    Access global funding for your space venture
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Key Features */}
            <div className="space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-GoodTimes text-white">
                  Decentralized Space Funding
                </h3>
                <p className="text-white/80 text-base md:text-lg leading-relaxed">
                  Experience the next generation of space funding with transparent, 
                  community-driven support for missions that matter.
                </p>
              </div>

              {/* Feature List */}
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] rounded-full p-2">
                    <Image
                      src="/assets/icon-globe.svg"
                      alt="Global Access"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-lg mb-1">Global Access</h4>
                    <p className="text-white/70 text-sm md:text-base">
                      Tap into a global crypto network with trillions of dollars at your fingertips
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 bg-gradient-to-r from-[#5F4BA2] to-[#5159CC] rounded-full p-2">
                    <Image
                      src="/assets/icon-signature.svg"
                      alt="Trustless"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-lg mb-1">100% Transparent</h4>
                    <p className="text-white/70 text-sm md:text-base">
                      All transactions are onchain, ensuring everyone can see how funds are spent
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 bg-gradient-to-r from-[#5159CC] to-[#4660E7] rounded-full p-2">
                    <Image
                      src="/assets/icon-fasttrack.svg"
                      alt="Fast"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-lg mb-1">Launch in Minutes</h4>
                    <p className="text-white/70 text-sm md:text-base">
                      Fund your mission in minutes, not months, with instant global access to capital
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <StandardButton
                  className="bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] text-white font-semibold text-sm md:text-base px-6 py-3 rounded-xl hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 border-0 flex-1 text-center"
                  link="/launch"
                  hoverEffect={false}
                >
                  Launch Your Mission
                </StandardButton>
                <StandardButton
                  className="bg-white/10 backdrop-blur-sm text-white font-semibold text-sm md:text-base px-6 py-3 rounded-xl hover:bg-white/20 transition-all duration-300 border border-white/20 flex-1 text-center"
                  link="/launch"
                  hoverEffect={false}
                >
                  Explore Missions
                </StandardButton>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-12 border border-white/20">
            <div className="text-center mb-8 md:mb-12">
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-GoodTimes text-white mb-4">
                Proven Track Record
              </h3>
              <p className="text-white/80 text-base md:text-lg">
                MoonDAO's journey from concept to space, powered by decentralized funding
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {/* $8 Million Raised */}
              <div className="text-center">
                <div className="bg-gradient-to-br from-[#6C407D]/20 to-[#5F4BA2]/20 rounded-2xl p-4 md:p-6 border border-white/10 h-full flex flex-col justify-center">
                  <Image
                    src="/assets/icon-raised-tokens.svg"
                    alt="Dollars Raised"
                    width={48}
                    height={48}
                    className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-3"
                  />
                  <h4 className="text-xl md:text-2xl lg:text-3xl font-GoodTimes text-white mb-2">
                    $8M
                  </h4>
                  <p className="text-white/70 text-xs md:text-sm">
                    Raised through decentralized funding
                  </p>
                </div>
              </div>

              {/* 12,000 Token Holders */}
              <div className="text-center">
                <div className="bg-gradient-to-br from-[#5F4BA2]/20 to-[#5159CC]/20 rounded-2xl p-4 md:p-6 border border-white/10 h-full flex flex-col justify-center">
                  <Image
                    src="/assets/icon-powerful.svg"
                    alt="Token Holders"
                    width={48}
                    height={48}
                    className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-3"
                  />
                  <h4 className="text-xl md:text-2xl lg:text-3xl font-GoodTimes text-white mb-2">
                    12K
                  </h4>
                  <p className="text-white/70 text-xs md:text-sm">
                    $MOONEY token holders
                  </p>
                </div>
              </div>

              {/* 80 Projects */}
              <div className="text-center">
                <div className="bg-gradient-to-br from-[#5159CC]/20 to-[#4660E7]/20 rounded-2xl p-4 md:p-6 border border-white/10 h-full flex flex-col justify-center">
                  <Image
                    src="/assets/icon-lightbulb.svg"
                    alt="Projects Funded"
                    width={48}
                    height={48}
                    className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-3"
                  />
                  <h4 className="text-xl md:text-2xl lg:text-3xl font-GoodTimes text-white mb-2">
                    80+
                  </h4>
                  <p className="text-white/70 text-xs md:text-sm">
                    Projects successfully funded
                  </p>
                </div>
              </div>

              {/* 2 People to Space */}
              <div className="text-center">
                <div className="bg-gradient-to-br from-[#4660E7]/20 to-[#6C407D]/20 rounded-2xl p-4 md:p-6 border border-white/10 h-full flex flex-col justify-center">
                  <Image
                    src="/assets/icon-fasttrack.svg"
                    alt="People in Space"
                    width={48}
                    height={48}
                    className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-3"
                  />
                  <h4 className="text-xl md:text-2xl lg:text-3xl font-GoodTimes text-white mb-2">
                    2
                  </h4>
                  <p className="text-white/70 text-xs md:text-sm">
                    People sent to space
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
