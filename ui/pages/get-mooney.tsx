import { useFundWallet } from '@privy-io/react-auth'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useContext, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { ethereum } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import viemChains from '@/lib/viem/viemChains'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import NativeToMooney from '@/components/uniswap/NativeToMooney'

export default function GetMooney() {
  const { t } = useTranslation('common')
  const account = useActiveAccount()
  const address = account?.address
  const router = useRouter()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { fundWallet } = useFundWallet()

  useEffect(() => {
    setSelectedChain(ethereum)
  }, [setSelectedChain])

  return (
    <>
      <WebsiteHead
        title="Buy MOONEY - MoonDAO"
        description="Buy MOONEY tokens to participate in MoonDAO governance. Swap from various cryptocurrencies across multiple networks."
      />

      <Container is_fullwidth={true}>
        <div className="min-h-screen bg-dark-cool text-white w-full">
          {/* Buy MOONEY Section */}
          <section className="py-12 px-6 bg-gradient-to-br from-gray-900/50 to-blue-900/20 w-full min-h-screen flex items-center">
            <div className="max-w-4xl mx-auto w-full">
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold font-GoodTimes text-white mb-4">
                  Buy MOONEY
                </h1>
                <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                  Get MOONEY tokens to participate in MoonDAO governance. After
                  buying, you can lock them for voting power.
                </p>
              </div>

              {/* Network Selection */}
              <div className="mb-8">
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 bg-gradient-to-br from-gray-900/50 to-blue-900/20 rounded-xl p-6 border border-white/10">
                  <div className="flex-1 max-w-md">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Network Selection
                    </h3>
                    <p className="text-gray-300 text-sm">
                      Select which network you want to buy MOONEY on
                    </p>
                  </div>
                  <div className="flex-shrink-0 w-full lg:w-auto">
                    <NetworkSelector />
                  </div>
                </div>
              </div>

              {/* Centered Buy MOONEY */}
              <div className="max-w-xl mx-auto mb-12">
                <div>
                  <NativeToMooney selectedChain={selectedChain} />
                </div>
              </div>

              {/* Next Steps */}
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">
                    Next Steps
                  </h3>
                  <p className="text-gray-300 text-sm">
                    After buying MOONEY, lock them to gain voting power in
                    governance.
                  </p>
                </div>
                <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-6 border border-white/10">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Link
                      href="/lock"
                      className="block bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-center"
                    >
                      Lock for Voting Power
                    </Link>
                    <Link
                      href="/vote"
                      className="block bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 text-center"
                    >
                      View Governance
                    </Link>
                  </div>
                  <div className="text-center text-xs text-gray-400 mt-4">
                    Locking MOONEY gives you vMOONEY for quadratic voting
                  </div>
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
