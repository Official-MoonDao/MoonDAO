import { useState, useContext, useEffect } from 'react'
import useTranslation from 'next-translate/useTranslation'
import { useFundWallet } from '@privy-io/react-auth'
import { useRouter } from 'next/router'
import { useActiveAccount } from 'thirdweb/react'
import toast from 'react-hot-toast'
import { ethereum } from '@/lib/infura/infuraChains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import viemChains from '@/lib/viem/viemChains'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import Tab from '../components/layout/Tab'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import NativeToMooney from '@/components/uniswap/NativeToMooney'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'
import LockInterface from '../components/tokens/LockInterface'

type MooneyTabType = 'buy' | 'lock' | 'bridge'

export default function Mooney() {
  const { t } = useTranslation('common')
  const account = useActiveAccount()
  const address = account?.address
  const router = useRouter()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { fundWallet } = useFundWallet()

  const [activeTab, setActiveTab] = useState<MooneyTabType>('buy')

  // Handle URL query parameters for tab selection
  useEffect(() => {
    if (router.query.tab && ['buy', 'lock', 'bridge'].includes(router.query.tab as string)) {
      setActiveTab(router.query.tab as MooneyTabType)
    }
  }, [router.query.tab])

  // Update URL when tab changes
  const handleTabChange = (tab: MooneyTabType) => {
    setActiveTab(tab)
    router.push(`/mooney?tab=${tab}`, undefined, { shallow: true })
  }

  const getTabDescription = (tab: MooneyTabType) => {
    switch (tab) {
      case 'buy':
        return 'Get MOONEY tokens by swapping from other cryptocurrencies on various blockchain networks.'
      case 'lock':
        return 'Lock your MOONEY tokens to gain voting power and participate in MoonDAO governance.'
      case 'bridge':
        return 'Transfer your MOONEY tokens between Ethereum mainnet and Arbitrum for lower fees.'
      default:
        return ''
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'buy':
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <p className="text-gray-300 text-base leading-relaxed">
                Select the blockchain network where you want to buy MOONEY tokens. 
                Different networks offer different trading options and fee structures.
              </p>
            </div>
            <NetworkSelector />
            <NativeToMooney selectedChain={selectedChain} />
          </div>
        )
      
      case 'lock':
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <p className="text-gray-300 text-base leading-relaxed">
                Lock your MOONEY tokens to receive vMOONEY and gain voting power in MoonDAO governance. 
                Longer lock periods provide more voting power.
              </p>
            </div>
            <LockInterface />
          </div>
        )
      
      case 'bridge':
        return (
          <div className="space-y-6">
            <ArbitrumBridge />
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <>
      <WebsiteHead 
        title="$MOONEY Token" 
        description="Buy, lock, and bridge MOONEY tokens - the governance token of MoonDAO. Participate in decentralized space exploration." 
      />
      <div className="w-full">
        <ContentLayout
          header="$MOONEY Token"
          headerSize="max(20px, 3vw)"
          description={
            <div className="max-w-full">
              <p className="text-lg">
                MOONEY is the governance token that powers MoonDAO's decentralized space program.
                {' '}Playing an active role in MoonDAO governance is simple:{' '}
                <button
                  className="underline"
                  onClick={() => {
                    if (!address)
                      return toast.error('Please connect your wallet.')
                    fundWallet(address, {
                      chain: viemChains[chainSlug],
                    })
                  }}
                >
                  fund your account
                </button>
                {', '}
                <button
                  className="underline"
                  onClick={() => handleTabChange('buy')}
                >
                  get $MOONEY
                </button>
                {', and '}
                <button
                  className="underline"
                  onClick={() => handleTabChange('lock')}
                >
                  lock for voting power
                </button>
                {'.'}
              </p>
            </div>
          }
          preFooter={
            <NoticeFooter
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              imageWidth={200}
              imageHeight={200}
            />
          }
          mainPadding
          isProfile
          mode="compact"
          popOverEffect={false}
        >
          <div className="max-w-2xl mx-auto">
            {/* Tab Navigation */}
            <div className="mb-8">
              <div className="flex justify-center gap-1 p-1 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl w-full max-w-2xl mx-auto">
                <Tab
                  tab="buy"
                  currentTab={activeTab}
                  setTab={handleTabChange}
                  className="flex-1 py-3 text-center font-medium transition-all duration-300"
                >
                  Buy Mooney
                </Tab>
                <Tab
                  tab="lock"
                  currentTab={activeTab}
                  setTab={handleTabChange}
                  className="flex-1 py-3 text-center font-medium transition-all duration-300"
                >
                  Lock for Voting Power
                </Tab>
                <Tab
                  tab="bridge"
                  currentTab={activeTab}
                  setTab={handleTabChange}
                  className="flex-1 py-3 text-center font-medium transition-all duration-300"
                >
                  Bridge to Arbitrum
                </Tab>
              </div>
            </div>

            {/* Tab Content */}
            <div className="animate-fadeIn">
              {renderTabContent()}
            </div>
          </div>
        </ContentLayout>
      </div>
    </>
  )
}
