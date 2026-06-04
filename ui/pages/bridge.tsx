import Link from 'next/link'
import Container from '../components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function Bridge() {
  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <WebsiteHead
        title="Bridge $MOONEY - MoonDAO"
        description="Bridge MOONEY tokens across different blockchain networks securely and efficiently."
      />
      <Container>
        <ContentLayout
          header="Bridge $MOONEY"
          headerSize="max(20px, 3vw)"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          centerHeaderWidth="52rem"
          description={
            <>
              Transfer your ETH and MOONEY tokens from Ethereum mainnet to Arbitrum for faster
              transactions and lower fees.
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
            {/* Bridge Interface */}
            <div className="mb-4 sm:mb-6">
              <ArbitrumBridge />
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
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
