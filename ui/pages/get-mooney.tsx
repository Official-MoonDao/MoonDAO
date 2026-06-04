import Link from 'next/link'
import { useContext } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import Container from '../components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import NativeToMooney from '@/components/uniswap/NativeToMooney'

export default function GetMooney() {
  const { selectedChain } = useContext(ChainContextV5)

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <WebsiteHead
        title="Get $MOONEY - MoonDAO"
        description="Buy MOONEY tokens to participate in MoonDAO governance. Swap from various cryptocurrencies across multiple networks."
      />
      <Container>
        <ContentLayout
          header="Get $MOONEY"
          headerSize="max(20px, 3vw)"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          description={
            <>
              Get MOONEY tokens to participate in MoonDAO governance. After buying, lock them for
              voting power.
            </>
          }
          preFooter={
            <NoticeFooter
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
            />
          }
        >
          <div className="max-w-2xl mx-auto w-full">
            {/* Swap Tokens */}
            <div className="mb-4 sm:mb-6">
              <NativeToMooney selectedChain={selectedChain} />
            </div>

            {/* Next Steps */}
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
        </ContentLayout>
      </Container>
    </div>
  )
}
