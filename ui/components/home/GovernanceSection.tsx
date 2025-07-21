import Image from 'next/image'
import StandardButton from '../layout/StandardButton'

export default function GovernanceSection() {
  return (
    <section className="relative bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-100">
          <Image
            src="/assets/Governance-section-image.png"
            alt="Capitol building on lunar surface with Earth in background"
            fill
            className="object-cover"
          />
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-5 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="header font-GoodTimes text-4xl md:text-5xl lg:text-6xl text-white mb-6">
            Governance
          </h2>
          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
            MoonDAO is governed by its Citizens. Our decentralized governance system 
            ensures every voice is heard in shaping humanity's multiplanetary future.
          </p>
        </div>

        {/* Governance Flow */}
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8 mb-16">
          {/* Senate */}
          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-8 text-center hover:border-blue-400/40 transition-all duration-300 flex flex-col h-full">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <Image
                src="/assets/icon-role.svg"
                alt="Senate"
                width={32}
                height={32}
                className="filter invert"
              />
            </div>
            <h3 className="text-2xl font-GoodTimes text-white mb-4">Senate</h3>
            <p className="text-gray-300 mb-6 flex-grow text-center">
              Five top contributors elected quarterly, plus one representative from each active project. 
              Senators review and approve proposals before they reach the Member House.
            </p>
            <div className="flex justify-center mb-4">
              <ul className="space-y-2 text-sm text-gray-400 text-left list-disc list-inside">
                <li>Reviews all proposals first</li>
                <li>Requires 70% quorum</li>
                <li>Super majority vote needed</li>
              </ul>
            </div>
            <div className="inline-block mt-auto">
              <StandardButton
                backgroundColor="bg-blue-600"
                textColor="text-white"
                borderRadius="rounded-full"
                hoverEffect={false}
                link="/governance"
              >
                Learn About Governance
              </StandardButton>
            </div>
          </div>

          {/* Member House Voting */}
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-8 text-center hover:border-purple-400/40 transition-all duration-300 flex flex-col h-full">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
              <Image
                src="/assets/icon-vote.svg"
                alt="Voting"
                width={32}
                height={32}
                className="filter invert"
              />
            </div>
            <h3 className="text-2xl font-GoodTimes text-white mb-4">Voting</h3>
            <p className="text-gray-300 mb-6 flex-grow text-center">
              After Senate approval, all MoonDAO Members vote using quadratic voting with $vMOONEY. 
              Voting power is based on square root of locked tokens.
            </p>
            <div className="flex justify-center mb-4">
              <ul className="space-y-2 text-sm text-gray-400 text-left list-disc list-inside">
                <li>Quadratic voting system</li>
                <li>5+ day voting period</li>
                <li>Super majority required</li>
              </ul>
            </div>
            <div className="inline-block mt-auto">
              <StandardButton
                backgroundColor="bg-purple-600"
                textColor="text-white"
                borderRadius="rounded-full"
                hoverEffect={false}
                link="/vote"
              >
                See Current Proposals
              </StandardButton>
            </div>
          </div>

          {/* Citizenship */}
          <div className="bg-gradient-to-br from-green-900/30 to-teal-900/30 backdrop-blur-sm border border-green-500/20 rounded-2xl p-8 text-center hover:border-green-400/40 transition-all duration-300 flex flex-col h-full">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <Image
                src="/assets/icon-power.svg"
                alt="Citizenship"
                width={32}
                height={32}
                className="filter invert"
              />
            </div>
            <h3 className="text-2xl font-GoodTimes text-white mb-4">Citizenship</h3>
            <p className="text-gray-300 mb-6 flex-grow text-center">
              Become a MoonDAO Citizen to gain full governance rights and help co-govern 
              our decentralized space program alongside fellow space enthusiasts.
            </p>
            <div className="flex justify-center mb-4">
              <ul className="space-y-2 text-sm text-gray-400 text-left list-disc list-inside">
                <li>Vote on proposals and budgets</li>
                <li>Submit your own proposals</li>
                <li>Shape MoonDAO's future direction</li>
              </ul>
            </div>
            <div className="inline-block mt-auto">
              <StandardButton
                backgroundColor="bg-green-600"
                textColor="text-white"
                borderRadius="rounded-full"
                hoverEffect={false}
                link="/citizen"
              >
                Become a Citizen
              </StandardButton>
            </div>
          </div>
        </div>

        {/* Governance Process Flow */}
        <div className="max-w-7xl mx-auto bg-gradient-to-r from-blue-900/20 to-purple-900/20 backdrop-blur-sm border border-blue-500/20 rounded-3xl p-6 md:p-8">
          <h3 className="text-2xl md:text-3xl font-GoodTimes text-white text-center mb-8">
            How Proposals Flow Through Governance
          </h3>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            {/* Step 1 */}
            <div className="text-center flex-1 max-w-xs">
              <div className="w-10 h-10 mx-auto mb-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <h4 className="text-base font-semibold text-white mb-1">Ideation</h4>
              <p className="text-gray-300 text-xs">
                Forum discussion and community feedback
              </p>
            </div>

            {/* Arrow */}
            <div className="hidden md:block">
              <div className="w-6 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400"></div>
            </div>

            {/* Step 2 */}
            <div className="text-center flex-1 max-w-xs">
              <div className="w-10 h-10 mx-auto mb-3 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <h4 className="text-base font-semibold text-white mb-1">Senate Vote</h4>
              <p className="text-gray-300 text-xs">
                Senate review and approval
              </p>
            </div>

            {/* Arrow */}
            <div className="hidden md:block">
              <div className="w-6 h-0.5 bg-gradient-to-r from-purple-400 to-green-400"></div>
            </div>

            {/* Step 3 */}
            <div className="text-center flex-1 max-w-xs">
              <div className="w-10 h-10 mx-auto mb-3 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <h4 className="text-base font-semibold text-white mb-1">Member Vote</h4>
              <p className="text-gray-300 text-xs">
                Quadratic voting with $vMOONEY
              </p>
            </div>
          </div>

          <div className="text-center mt-6">
            <StandardButton
              backgroundColor="bg-gradient-to-r from-blue-600 to-purple-600"
              textColor="text-white"
              borderRadius="rounded-full"
              hoverEffect={false}
              link="/constitution"
            >
              Read the Constitution
            </StandardButton>
          </div>
        </div>
      </div>
    </section>
  )
}
