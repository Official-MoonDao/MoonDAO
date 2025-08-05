import Image from 'next/image'
import StandardButton from '../layout/StandardButton'

export default function NetworkSection() {
  return (
    <section className="relative bg-white overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        {/* Mobile background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat md:hidden"
          style={{ backgroundImage: 'url(/assets/NetworkLineless.png)' }}
        ></div>
        {/* Desktop background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden md:block"
          style={{ backgroundImage: 'url(/assets/Network-Section.png)' }}
        ></div>
      </div>

      <div className="relative z-10 container mx-auto px-5 py-20 md:py-28">
        {/* Header with different styling */}
        <div className="text-center mb-20">
          <h2 className="font-GoodTimes text-5xl md:text-6xl lg:text-7xl text-white mb-6 tracking-tight">
            Network
          </h2>
          <p className="text-lg md:text-xl lg:text-2xl text-gray-200 max-w-6xl mx-auto leading-tight">
            Connect, collaborate, and build the future of space exploration through our <span className="text-blue-300 font-semibold whitespace-nowrap">decentralized ecosystem</span>
          </p>
        </div>



        {/* Action Cards - Horizontal Layout */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
          {/* Companies Card */}
          <div className="group relative">
            <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2 h-[520px] flex flex-col hover:bg-black/30">
              <div className="flex items-start mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center">
                  <Image src="/assets/icon-power.svg" alt="Companies" width={32} height={32} className="filter invert" />
                </div>
              </div>
              <h3 className="text-2xl font-GoodTimes text-white mb-4">For Companies</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Showcase capabilities, find talent, and connect with the space community through MoonDAO.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-grow">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                  List services and capabilities
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                  Post job opportunities
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                  Access funding and partnerships
                </li>
              </ul>
              <div className="mt-auto">
                <StandardButton
                  backgroundColor="bg-green-600 hover:bg-green-700"
                  textColor="text-white"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="/team"
                >
                  Join as Company →
                </StandardButton>
              </div>
            </div>
          </div>

          {/* Professionals Card */}
          <div className="group relative">
            <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2 h-[520px] flex flex-col hover:bg-black/30">
              <div className="flex items-start mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center">
                  <Image src="/assets/icon-role.svg" alt="Professionals" width={32} height={32} className="filter invert" />
                </div>
              </div>
              <h3 className="text-2xl font-GoodTimes text-white mb-4">For Professionals</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Find your next space industry opportunity and connect with leading companies and projects.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-grow">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                  Browse space industry jobs
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                  Showcase skills and experience
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                  Network with industry leaders
                </li>
              </ul>
              <div className="mt-auto">
                <StandardButton
                  backgroundColor="bg-blue-600 hover:bg-blue-700"
                  textColor="text-white"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="/join"
                >
                  Find Opportunities →
                </StandardButton>
              </div>
            </div>
          </div>

          {/* Community Card */}
          <div className="group relative">
            <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-2 h-[520px] flex flex-col hover:bg-black/30">
              <div className="flex items-start mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Image src="/assets/icon-vote.svg" alt="Community" width={32} height={32} className="filter invert" />
                </div>
              </div>
              <h3 className="text-2xl font-GoodTimes text-white mb-4">For Community</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Discover space companies, support innovative projects, and be part of the growing ecosystem.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-gray-300 flex-grow">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                  Explore companies and services
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                  Support projects through funding
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                  Stay updated on space innovation
                </li>
              </ul>
              <div className="mt-auto">
                <StandardButton
                  backgroundColor="bg-purple-600 hover:bg-purple-700"
                  textColor="text-white"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="#explore-network-header"
                >
                  Explore Network →
                </StandardButton>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="relative max-w-7xl mx-auto">
          <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 text-center shadow-2xl hover:bg-black/30 transition-all duration-300">
            <div className="relative z-10">
              <h3 className="text-3xl md:text-4xl font-GoodTimes text-white mb-4">
                Ready to Join the Space Economy?
              </h3>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Connect with thousands of space professionals, companies, and innovators building humanity's multiplanetary future.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <StandardButton
                  backgroundColor="bg-white hover:bg-gray-100"
                  textColor="text-gray-900"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="#explore-network-header"
                >
                  Explore the Network
                </StandardButton>
                <StandardButton
                  backgroundColor="bg-transparent border-2 border-white hover:bg-white"
                  textColor="text-white hover:text-gray-900"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="/join"
                >
                  Join MoonDAO
                </StandardButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
