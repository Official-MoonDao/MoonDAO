import Image from 'next/image'
import StandardButton from '@/components/layout/StandardButton'

type GetStartedTodayProps = {
  citizenHasAccess: boolean
  onLaunchClick: () => void
}

export default function GetStartedToday({
  citizenHasAccess,
  onLaunchClick,
}: GetStartedTodayProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/assets/launchpad/launchpad-video.png"
          alt="Launchpad Video Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8 md:mb-12">
            <Image
              src="/assets/MoonDAO Animated Logo - White.svg"
              alt="MoonDAO Logo"
              width={550}
              height={550}
              className="w-24 md:w-32 lg:w-40 xl:w-48 mx-auto"
            />
          </div>

          <div className="space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white mb-4 md:mb-6">
              Get Started Today
            </h2>
            <p className="text-white/90 text-sm md:text-lg lg:text-xl xl:text-2xl max-w-3xl mx-auto leading-relaxed px-4">
              The next great space mission starts here. Join the decentralized space race and fund
              your mission with the Launchpad.
            </p>

            <div className="pt-6 md:pt-8">
              <div className="relative group">
                {citizenHasAccess && (
                  <StandardButton
                    id="launch-mission-button-3"
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

      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent"></div>
      <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent"></div>
    </section>
  )
}

