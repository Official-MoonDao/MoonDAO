import Link from 'next/link'
import { useContext } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SpaceBackground from '@/components/layout/SpaceBackground'
import NativeToMooney from '@/components/uniswap/NativeToMooney'

export default function GetMooney() {
  const { selectedChain } = useContext(ChainContextV5)

  return (
    <>
      <WebsiteHead
        title="get mooney - MoonDAO"
        description="Buy MOONEY tokens to participate in MoonDAO governance. Swap from various cryptocurrencies across multiple networks."
      />

      <Container is_fullwidth={true}>
        <SpaceBackground />
        <div className="min-h-screen text-white w-full relative z-10">
          {/* Get MOONEY Section - Compact for above-the-fold */}
          <section className="pt-10 sm:pt-16 pb-4 sm:pb-6 px-4 sm:px-6 w-full min-h-[100dvh] flex flex-col">
            <div className="max-w-2xl mx-auto w-full">
              <div className="mb-3 sm:mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold font-GoodTimes text-white mb-1 sm:mb-2">
                  get mooney
                </h1>
                <p className="text-sm sm:text-base text-gray-300">
                  Get MOONEY tokens to participate in MoonDAO governance. After buying, lock them for
                  voting power.
                </p>
              </div>

              {/* Swap Tokens */}
              <div className="mb-4 sm:mb-6">
                <NativeToMooney selectedChain={selectedChain} />
              </div>

              {/* Next Steps - Compact */}
              <div className="w-full">
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                  <Link
                    href="/lock"
                    className="flex-1 min-w-[140px] sm:min-w-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 text-center"
                  >
                    Lock for Voting Power
                  </Link>
                  <Link
                    href="/projects"
                    className="flex-1 min-w-[140px] sm:min-w-0 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 text-center"
                  >
                    View Governance
                  </Link>
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">
                  Locking MOONEY gives you vMOONEY for quadratic voting
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="flex justify-center w-full">
            <NoticeFooter
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              imageWidth={200}
              imageHeight={200}
            />
          </div>
        </div>
      </Container>
    </>
  )
}
