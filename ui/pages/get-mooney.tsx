import { useFundWallet } from '@privy-io/react-auth'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import React, { useContext, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ethereum } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import viemChains from '@/lib/viem/viemChains'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
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
      <WebsiteHead title={t('mooneyTitle')} description={t('mooneyDesc')} />
      <section className="w-full min-h-screen bg-gradient-to-b from-gray-900 to-black">
        <Container>
          <ContentLayout
            header={t('mooneyTitle')}
            headerSize="max(20px, 3vw)"
            description={
              <div className="max-w-full">
                <p>
                  {'Playing an active role in MoonDAO governance is simple: '}
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
                    {'fund your account'}
                  </button>
                  {',  '}
                  <button className="underline">{'swap for $MOONEY'}</button>
                  {', and '}
                  <button
                    className="underline"
                    onClick={() => {
                      router.push('/lock')
                    }}
                  >
                    {'lock for voting power'}
                  </button>
                  {'.  '}
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
            <div className="w-full">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 shadow-2xl max-w-2xl mx-auto">
                <div className="mb-6">
                  <p className="text-gray-300 text-base leading-relaxed">
                    Select the blockchain network where you want to buy MOONEY
                    tokens. Different networks offer different trading options and
                    fee structures.
                  </p>
                </div>
                <div className="space-y-6">
                  <NetworkSelector />
                  <NativeToMooney selectedChain={selectedChain} />
                </div>
              </div>
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
