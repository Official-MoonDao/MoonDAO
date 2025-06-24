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
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={t('mooneyTitle')}
            headerSize="max(20px, 3vw)"
            description={
              <div className="max-w-2xl">
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
            preFooter={<NoticeFooter />}
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
          >
            <div className="mt-3 w-full max-w-2xl">
              <div className="mb-4">
                <p className="text-gray-400 text-sm">
                  Select the blockchain network where you want to buy MOONEY tokens. 
                  Different networks offer different trading options and fee structures.
                </p>
              </div>
              <NetworkSelector />
              <NativeToMooney selectedChain={selectedChain} />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
