import LaunchpadFAQs from './LaunchpadFAQs'

export default function LaunchpadFAQ() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0A0A0A] via-[#1A1A2E] to-[#16213E]">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] rounded-full opacity-20 blur-xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-24 h-24 bg-gradient-to-r from-[#5159CC] to-[#4660E7] rounded-full opacity-30 blur-lg animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-gradient-to-r from-[#4660E7] to-[#6C407D] rounded-full opacity-25 blur-lg animate-pulse delay-2000"></div>
        <div className="absolute top-3/4 left-1/3 w-16 h-16 bg-gradient-to-r from-[#5F4BA2] to-[#5159CC] rounded-full opacity-15 blur-lg animate-pulse delay-1500"></div>

        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[#6C407D]/10 to-[#5F4BA2]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-[#5159CC]/10 to-[#4660E7]/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-[#4660E7]/5 to-[#6C407D]/5 rounded-full blur-3xl"></div>

        <div className="absolute top-1/5 right-1/3 w-1 h-1 bg-white/30 rounded-full"></div>
        <div className="absolute top-2/5 left-1/5 w-1 h-1 bg-cyan-400/40 rounded-full"></div>
        <div className="absolute top-3/5 right-1/4 w-1 h-1 bg-purple-400/30 rounded-full"></div>
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-pink-400/40 rounded-full"></div>
        <div className="absolute bottom-1/4 right-1/5 w-1 h-1 bg-blue-400/30 rounded-full"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white mb-6 md:mb-8">
            Frequently Asked Questions
          </h2>
          <p className="text-white/80 text-base md:text-lg lg:text-xl xl:text-2xl text-center max-w-3xl mx-auto leading-relaxed">
            Everything you need to know about launching your space mission.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-8 lg:p-12 border border-white/20 shadow-2xl">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#6C407D]/5 to-[#5F4BA2]/5 rounded-3xl"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#6C407D] to-[#5F4BA2] rounded-t-3xl"></div>

              <div className="relative z-10">
                <LaunchpadFAQs />
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

