import Image from 'next/image'
import StandardButton from '../layout/StandardButton'

export default function NetworkSection() {
  return (
    <section className="relative bg-white overflow-hidden">
      {/* Geometric Background Pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"></div>
        
        
        {/* Connecting lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3"/>
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.3"/>
            </linearGradient>
          </defs>
          <path d="M100,200 Q300,100 500,200 T900,150" stroke="url(#lineGradient)" strokeWidth="2" fill="none"/>
          <path d="M200,400 Q400,300 600,400 T1000,350" stroke="url(#lineGradient)" strokeWidth="1.5" fill="none"/>
          <path d="M50,500 Q250,400 450,500 T750,450" stroke="url(#lineGradient)" strokeWidth="1" fill="none"/>
        </svg>
      </div>

      <div className="relative z-10 container mx-auto px-5 py-20 md:py-28">
        {/* Header with different styling */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-xl">
            <Image
              src="/assets/icon-analytics.svg"
              alt="Network"
              width={40}
              height={40}
              className="filter invert"
            />
          </div>
          <h2 className="font-GoodTimes text-5xl md:text-6xl lg:text-7xl text-gray-900 mb-6 tracking-tight">
            Network
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto mb-8"></div>
          <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-6xl mx-auto leading-tight">
            Connect, collaborate, and build the future of space exploration through our <span className="text-blue-600 font-semibold whitespace-nowrap">decentralized ecosystem</span>
          </p>
        </div>

        {/* Interactive Network Visualization */}
        <div className="relative mb-24 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            
            {/* Left Column - Companies & Jobs */}
            <div className="space-y-6">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-3xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                <div className="relative bg-white border border-green-200 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-28 flex items-center">
                  <div className="flex items-center w-full">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <Image src="/assets/icon-power.svg" alt="Companies" width={20} height={20} className="filter invert" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-GoodTimes text-gray-900 mb-1">Companies</h3>
                      <p className="text-gray-600 text-xs leading-tight">
                        Space companies showcase capabilities
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-500 rounded-3xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                <div className="relative bg-white border border-orange-200 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-28 flex items-center">
                  <div className="flex items-center w-full">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <Image src="/assets/icon-role.svg" alt="Jobs" width={20} height={20} className="filter invert" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-GoodTimes text-gray-900 mb-1">Jobs</h3>
                      <p className="text-gray-600 text-xs leading-tight">
                        Career opportunities across space industry
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Center Column - Network Hub */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-48 h-48 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 rounded-full flex items-center justify-center shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-600/20 animate-pulse"></div>
                  <div className="relative text-center z-10">
                    <Image
                      src="/assets/MoonDAO-Logo-White.svg"
                      alt="MoonDAO Network"
                      width={60}
                      height={60}
                      className="mx-auto mb-3"
                    />
                    <span className="text-white font-bold text-lg">Network Hub</span>
                  </div>
                </div>
                
                {/* Pulsing rings */}
                <div className="absolute inset-0 w-48 h-48 border-2 border-blue-400/30 rounded-full animate-ping"></div>
                <div className="absolute inset-0 w-48 h-48 border border-purple-400/20 rounded-full animate-ping delay-1000"></div>
              </div>
            </div>

            {/* Right Column - Services & Visibility */}
            <div className="space-y-6">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-500 rounded-3xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                <div className="relative bg-white border border-purple-200 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-28 flex items-center">
                  <div className="flex items-center w-full">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <Image src="/assets/icon-vote.svg" alt="Services" width={20} height={20} className="filter invert" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-GoodTimes text-gray-900 mb-1">Services</h3>
                      <p className="text-gray-600 text-xs leading-tight">
                        Specialized marketplace for solutions
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-teal-500 rounded-3xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                <div className="relative bg-white border border-cyan-200 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-28 flex items-center">
                  <div className="flex items-center w-full">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <Image src="/assets/icon-analytics.svg" alt="Visibility" width={20} height={20} className="filter invert" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-GoodTimes text-gray-900 mb-1">Visibility</h3>
                      <p className="text-gray-600 text-xs leading-tight">
                        Global exposure and recognition
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards - Horizontal Layout */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
          {/* Companies Card */}
          <div className="group relative">
            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 h-[520px] flex flex-col">
              <div className="flex items-start mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center">
                  <Image src="/assets/icon-power.svg" alt="Companies" width={32} height={32} className="filter invert" />
                </div>
              </div>
              <h3 className="text-2xl font-GoodTimes text-gray-900 mb-4">For Companies</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Showcase capabilities, find talent, and connect with the space community through MoonDAO.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-gray-600 flex-grow">
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
                  link="/network"
                >
                  Join as Company →
                </StandardButton>
              </div>
            </div>
          </div>

          {/* Professionals Card */}
          <div className="group relative">
            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 h-[520px] flex flex-col">
              <div className="flex items-start mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center">
                  <Image src="/assets/icon-role.svg" alt="Professionals" width={32} height={32} className="filter invert" />
                </div>
              </div>
              <h3 className="text-2xl font-GoodTimes text-gray-900 mb-4">For Professionals</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Find your next space industry opportunity and connect with leading companies and projects.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-gray-600 flex-grow">
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
                  link="/network"
                >
                  Find Opportunities →
                </StandardButton>
              </div>
            </div>
          </div>

          {/* Community Card */}
          <div className="group relative">
            <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 h-[520px] flex flex-col">
              <div className="flex items-start mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Image src="/assets/icon-vote.svg" alt="Community" width={32} height={32} className="filter invert" />
                </div>
              </div>
              <h3 className="text-2xl font-GoodTimes text-gray-900 mb-4">For Community</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Discover space companies, support innovative projects, and be part of the growing ecosystem.
              </p>
              <ul className="space-y-3 mb-8 text-sm text-gray-600 flex-grow">
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
                  link="/network"
                >
                  Explore Network →
                </StandardButton>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="relative max-w-7xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 rounded-3xl blur opacity-20"></div>
          <div className="relative bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8 md:p-12 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-teal-600/10"></div>
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
                  link="/network"
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
