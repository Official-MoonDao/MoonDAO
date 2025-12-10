import Image from 'next/image'
import StandardButton from '@/components/layout/StandardButton'

type LaunchHeroProps = {
  citizenHasAccess: boolean
  onLaunchClick: () => void
}

export default function LaunchHero({ citizenHasAccess, onLaunchClick }: LaunchHeroProps) {
  return (
    <section className="relative h-screen overflow-hidden">
      <div className="absolute inset-0 -top-18 md:-top-22 lg:-top-26">
        <Image
          src="/assets/launchpad/moondao-launchpad-hero.png"
          alt="MoonDAO Launchpad Hero"
          fill
          className="object-cover object-center"
          priority
          quality={100}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#010618]/80 via-[#010618]/60 to-transparent"></div>
      </div>

      <div className="relative z-10 h-full flex flex-col justify-end">
        <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 pb-24 md:pb-28 lg:pb-32 xl:pb-36">
          <div className="max-w-2xl">
            <div className="mb-4 md:mb-6">
              <Image
                src="/assets/Tagline Animation - inline centered.svg"
                alt="MoonDAO"
                width={300}
                height={75}
                className="w-32 sm:w-40 md:w-48 lg:w-64 xl:w-72"
              />
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-GoodTimes text-white mb-4 md:mb-6 leading-tight">
              Launchpad
            </h1>

            <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-white/90 mb-6 md:mb-8 leading-relaxed max-w-xl">
              Fund the future of space exploration with decentralized crowdfunding.
            </p>

            <div className="flex justify-start mb-16 sm:mb-12 md:mb-8 lg:mb-0">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#6C407D] via-[#5F4BA2] to-[#4660E7] rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>

                {citizenHasAccess && (
                  <StandardButton
                    className="relative bg-gradient-to-r from-[#6C407D] via-[#5F4BA2] to-[#4660E7] text-white font-semibold text-sm sm:text-base px-6 sm:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 border-0 backdrop-blur-sm text-center"
                    onClick={onLaunchClick}
                    hoverEffect={false}
                  >
                    <div className="flex items-center justify-center w-full text-center">
                      <span className="relative text-center pl-2 sm:pl-4">
                        Launch Your Mission
                        <span className="absolute inset-0 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent blur-sm opacity-50"></span>
                      </span>

                      <svg
                        className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-300 ml-1 sm:ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </div>
                  </StandardButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Image
        src="/assets/launchpad/blue-divider-rl.svg"
        alt=""
        width={200}
        height={200}
        className="absolute bottom-0 right-0 w-32 md:w-48 opacity-50"
      />

      <div className="absolute bottom-20 sm:bottom-22 md:bottom-24 left-1/2 transform -translate-x-1/2 z-20">
        <div
          className="flex flex-col items-center text-white/70 hover:text-white/90 transition-colors duration-300 cursor-pointer group"
          onClick={() => {
            const featuredMissionSection = document.getElementById('featured-mission')
            if (featuredMissionSection) {
              featuredMissionSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          }}
        >
          <span className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 tracking-wider uppercase">
            Scroll to explore
          </span>
          <div className="relative">
            <svg
              className="w-4 h-4 sm:w-6 sm:h-6 animate-bounce group-hover:animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>

            <div className="absolute inset-0 bg-white/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>

          <div className="mt-2 sm:mt-3 w-px h-6 sm:h-8 bg-gradient-to-b from-white/50 to-transparent"></div>
        </div>
      </div>
    </section>
  )
}

