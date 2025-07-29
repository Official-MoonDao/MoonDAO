import StandardButton from '../layout/StandardButton'

export default function ContributeSection() {
  return (
    <section className="bg-gradient-to-b from-[#2d1b69] via-[#1a1a3a] to-[#0f0f1e] py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-4xl font-GoodTimes text-white mb-4">CONTRIBUTE</h2>
              <p className="text-white/80 max-w-2xl">
                Every week we vote on projects proposed by the community. Approved projects are eligible for 
                rewards when a final report is submitted. You may also submit individual contributions that support 
                our mission.
              </p>
            </div>
            <StandardButton className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded">
              Learn More
            </StandardButton>
          </div>

          {/* Quarterly Reward Pool */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
            <h3 className="text-xl font-GoodTimes text-white mb-4 text-center">QUARTERLY REWARD POOL</h3>
            <div className="flex justify-center items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">Ξ</span>
                </div>
                <span className="text-2xl font-bold text-white">12.32 ETH</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">M</span>
                </div>
                <span className="text-2xl font-bold text-white">8.9m vMOONEY</span>
              </div>
            </div>
          </div>

          {/* Proposals Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - PROPOSALS */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-GoodTimes text-white">PROPOSALS</h3>
                <StandardButton className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 text-sm rounded">
                  See All Proposals
                </StandardButton>
              </div>
              
              <div className="space-y-3">
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-semibold">MDP-179: Study on Lunar Surface Selection For Settlement</span>
                  </div>
                  <div className="text-sm text-white/60">2.2 ETH</div>
                  <div className="text-sm text-white/60">Deadline: 3 days</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-white/80">Active</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-semibold">MDP-179: Study on Lunar Surface Selection For Settlement</span>
                  </div>
                  <div className="text-sm text-white/60">2.2 ETH</div>
                  <div className="text-sm text-white/60">Deadline: 3 days</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-semibold">MDP-179: Study on Lunar Surface Selection For Settlement</span>
                  </div>
                  <div className="text-sm text-white/60">2.2 ETH</div>
                  <div className="text-sm text-white/60">Deadline: 3 days</div>
                </div>
              </div>

              <div className="mt-4">
                <StandardButton className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 py-2 rounded">
                  Propose Project
                </StandardButton>
              </div>
            </div>

            {/* Right Column - PROPOSALS */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-GoodTimes text-white">PROPOSALS</h3>
                <StandardButton className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 text-sm rounded">
                  See All Proposals
                </StandardButton>
              </div>
              
              <div className="space-y-3">
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-semibold">MDP-179: Study on Lunar Surface Selection For Settlement</span>
                  </div>
                  <div className="text-sm text-white/60">2.2 ETH</div>
                  <div className="text-sm text-white/60">Deadline: 3 days</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-semibold">MDP-179: Study on Lunar Surface Selection For Settlement</span>
                  </div>
                  <div className="text-sm text-white/60">2.2 ETH</div>
                  <div className="text-sm text-white/60">Deadline: 3 days</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-white/80">Active</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-semibold">MDP-179: Study on Lunar Surface Selection For Settlement</span>
                  </div>
                  <div className="text-sm text-white/60">2.2 ETH</div>
                  <div className="text-sm text-white/60">Deadline: 3 days</div>
                </div>
              </div>

              <div className="mt-4">
                <StandardButton className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 py-2 rounded">
                  Propose Project
                </StandardButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}