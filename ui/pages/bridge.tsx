import Link from 'next/link'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SpaceBackground from '@/components/layout/SpaceBackground'

export default function Bridge() {
  return (
    <>
      <WebsiteHead
        title="Bridge MOONEY - MoonDAO"
        description="Bridge MOONEY tokens across different blockchain networks securely and efficiently."
      />

      <Container is_fullwidth={true}>
        <SpaceBackground />
        <div className="min-h-screen text-white w-full relative z-10">
          {/* Bridge MOONEY Section - Compact for above-the-fold */}
          <section className="py-4 sm:py-6 px-4 sm:px-6 w-full min-h-[100dvh] flex flex-col justify-center">
            <div className="max-w-2xl mx-auto w-full">
              <div className="mb-3 sm:mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold font-GoodTimes text-white mb-1 sm:mb-2">
                  Bridge MOONEY
                </h1>
                <p className="text-sm sm:text-base text-gray-300">
                  This bridge transfers your ETH and MOONEY tokens from Ethereum mainnet to Arbitrum.
                  Arbitrum offers faster transactions and lower fees while maintaining full security.
                </p>
              </div>

              {/* Bridge Interface */}
              <div className="mb-4 sm:mb-6">
                <ArbitrumBridge />
              </div>

              {/* Next Steps - Compact */}
              <div className="w-full">
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                  <Link
                    href="/lock"
                    className="flex-1 min-w-[140px] sm:min-w-0 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 text-center"
                  >
                    Lock for Voting Power
                  </Link>
                  <Link
                    href="/projects"
                    className="flex-1 min-w-[140px] sm:min-w-0 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 text-center"
                  >
                    View Governance
                  </Link>
                </div>
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
