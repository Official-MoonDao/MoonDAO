import Image from 'next/image'
import Link from 'next/link'
import { WrenchScrewdriverIcon, RocketLaunchIcon, DocumentCheckIcon } from '@heroicons/react/24/outline'
import StandardButton from '../layout/StandardButton'

export default function ProjectsSection() {
  return (
    <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <Image
            src="/zero-g-image.jpg"
            alt="Background"
            fill
            className="object-cover"
          />
        </div>
        {/* Geometric patterns */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-l from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="grid grid-cols-8 gap-4 h-full">
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} className="border border-white/20"></div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-5 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="header font-GoodTimes text-4xl md:text-5xl lg:text-6xl text-white mb-6">
            Projects
          </h2>
          <p className="text-lg md:text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Contribute to groundbreaking space projects, from lunar missions to space technology development. 
            Join our community-driven approach to accelerating humanity's <span className="text-green-400 font-semibold">multiplanetary future</span>.
          </p>
        </div>

        {/* Project Flow */}
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8 mb-16">
          {/* Project Rewards */}
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 backdrop-blur-sm border border-green-500/20 rounded-2xl p-8 text-center hover:border-green-400/40 transition-all duration-300 flex flex-col h-full">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <RocketLaunchIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-GoodTimes text-white mb-4">Project Rewards</h3>
            <p className="text-gray-300 mb-6 flex-grow">
              Discover active projects and contribute your skills to earn rewards. 
              From engineering to content creation, find opportunities that match your expertise.
            </p>
            <StandardButton 
              backgroundColor="bg-green-600"
              textColor="text-white"
              borderRadius="rounded-full"
              hoverEffect={false}
              link="/projects"
            >
              Explore Projects
            </StandardButton>
          </div>

          {/* Propose Project */}
          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-8 text-center hover:border-blue-400/40 transition-all duration-300 flex flex-col h-full">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <WrenchScrewdriverIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-GoodTimes text-white mb-4">Propose Project</h3>
            <p className="text-gray-300 mb-6 flex-grow">
              Have an innovative space-related idea? Submit a project proposal and request funding 
              from the MoonDAO treasury to bring your vision to life.
            </p>
            <StandardButton 
              backgroundColor="bg-blue-600"
              textColor="text-white"
              borderRadius="rounded-full"
              hoverEffect={false}
              link="/proposals"
            >
              Submit Proposal
            </StandardButton>
          </div>

          {/* Project Reports */}
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-8 text-center hover:border-purple-400/40 transition-all duration-300 flex flex-col h-full">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
              <DocumentCheckIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-GoodTimes text-white mb-4">Project Reports</h3>
            <p className="text-gray-300 mb-6 flex-grow">
              Track project progress and submit final reports. Maintain transparency 
              and accountability in our decentralized project ecosystem.
            </p>
            <StandardButton 
              backgroundColor="bg-purple-600"
              textColor="text-white"
              borderRadius="rounded-full"
              hoverEffect={false}
              link="/final-reports"
            >
              View Reports
            </StandardButton>
          </div>
        </div>

        {/* Featured Projects Showcase */}
        <div className="max-w-7xl mx-auto bg-gradient-to-r from-slate-800/50 to-blue-800/50 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12">
          <h3 className="text-3xl md:text-4xl font-GoodTimes text-white mb-8 text-center">
            Featured Projects
          </h3>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Project Card 1 */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-6 border border-gray-600/30 hover:border-green-500/50 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mb-4">
                <RocketLaunchIcon className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Makerspace at Vitalia</h4>
              <p className="text-gray-300 text-sm mb-4">
                Established a working makerspace in Prospera during Vitalia, hosting 25 events with 300+ participants including tech leaders.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-green-400 font-semibold">Completed</span>
                <span className="text-gray-400 text-xs">MDP-123</span>
              </div>
            </div>

            {/* Project Card 2 */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-6 border border-gray-600/30 hover:border-blue-500/50 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4">
                <WrenchScrewdriverIcon className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Zero Gravity Training</h4>
              <p className="text-gray-300 text-sm mb-4">
                VIP astronaut training experiences in zero gravity with NASA astronauts like Charlie Duke and Doug Hurley.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-blue-400 font-semibold">Completed</span>
                <span className="text-gray-400 text-xs">Space Training</span>
              </div>
            </div>

            {/* Project Card 3 */}
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-6 border border-gray-600/30 hover:border-purple-500/50 transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                <DocumentCheckIcon className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-xl font-bold text-white mb-3">Lunar Comms Network</h4>
              <p className="text-gray-300 text-sm mb-4">
                Advanced research project analyzing lunar communication topologies and positioning systems, submitted to DARPA's LunA-10 program.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-purple-400 font-semibold">Completed</span>
                <span className="text-gray-400 text-xs">DARPA LunA-10</span>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <StandardButton 
              backgroundColor="bg-gradient-to-r from-green-600 to-emerald-600"
              textColor="text-white"
              borderRadius="rounded-full"
              hoverEffect={false}
              link="/projects"
            >
              View All Projects
            </StandardButton>
          </div>
        </div>

        {/* Call to Action */}
        <div className="max-w-7xl mx-auto text-center mt-16">
          <h3 className="text-2xl md:text-3xl font-GoodTimes text-white mb-6">
            Ready to Build the Future?
          </h3>
          <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
            Whether you're an engineer, designer, researcher, or dreamer, there's a place for you in our projects.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <StandardButton 
              backgroundColor="bg-green-600"
              textColor="text-white"
              borderRadius="rounded-full"
              hoverEffect={false}
              link="/projects"
            >
              Join a Project
            </StandardButton>
            <StandardButton 
              backgroundColor="bg-transparent"
              textColor="text-white"
              borderRadius="rounded-full"
              hoverEffect={false}
              link="/info"
              className="border border-white/30 hover:border-green-500/50 hover:text-green-400"
            >
              Learn More
            </StandardButton>
          </div>
        </div>
      </div>
    </section>
  )
}
