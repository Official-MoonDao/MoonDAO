import { useFundWallet } from '@privy-io/react-auth'
import { Polygon } from '@thirdweb-dev/chains'
import { useAddress } from '@thirdweb-dev/react'
import { Token } from '@uniswap/sdk-core'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import React, { useContext } from 'react'
import toast from 'react-hot-toast'
import { pregenSwapRoute } from '../lib/uniswap/pregenSwapRoute'
import ChainContext from '@/lib/thirdweb/chain-context'
import viemChains from '@/lib/viem/viemChains'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import NativeToMooney from '@/components/uniswap/NativeToMooney'
import { OnboardingStageManager } from '../archive/get-mooney/OnboardingStageManager'
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from '../const/config'

export default function Join({ usdQuotes }: any) {
  const { t } = useTranslation('common')
  const address = useAddress()
  const router = useRouter()
  const { selectedChain } = useContext(ChainContext)
  const { fundWallet } = useFundWallet()

  return (
    <>
      <WebsiteHead title={t('mooneyTitle')} description={t('mooneyDesc')} />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header={t('mooneyTitle')}
            headerSize="max(20px, 3vw)"
            description={
              <p>
                {'Getting started with MoonDAO is simple: 1) '}
                <button
                  className="font-bold"
                  onClick={() => {
                    if (!address)
                      return toast.error('Please connect your wallet')
                    fundWallet(address, {
                      chain: viemChains[selectedChain.slug],
                    })
                  }}
                >
                  {'Fund your account'}
                </button>
                {' 2) '}
                <button className="font-bold">{'Swap for $MOONEY'}</button>
                {', our governance token, and 3) '}
                <button
                  className="font-bold"
                  onClick={() => {
                    router.push('/lock')
                  }}
                >
                  {'Lock for voting power'}
                </button>
              </p>
            }
            preFooter={<NoticeFooter />}
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
          >
            <div className="mt-3 px-5 pb-10 lg:px-7 xl:px-9 w-full">
              <NetworkSelector />
              <NativeToMooney selectedChain={selectedChain} />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

// export async function getStaticProps() {
//   const DAI = new Token(
//     137,
//     DAI_ADDRESSES['polygon'],
//     18,
//     'DAI',
//     'DAI Stablecoin'
//   )

//   const MOONEY = new Token(
//     137,
//     MOONEY_ADDRESSES['polygon'],
//     18,
//     'MOONEY',
//     'MOONEY (PoS)'
//   )

//   const levelOneRoute = await pregenSwapRoute(Polygon, 20000, MOONEY, DAI)
//   const levelTwoRoute = await pregenSwapRoute(Polygon, 100000, MOONEY, DAI)
//   const levelThreeRoute = await pregenSwapRoute(Polygon, 500000, MOONEY, DAI)

//   const usdQuotes = [levelOneRoute, levelTwoRoute, levelThreeRoute].map(
//     (swapRoute) => swapRoute?.route[0].rawQuote.toString() / 10 ** 18
//   )

//   return {
//     props: {
//       usdQuotes,
//     },
//     revalidate: 60,
//   }
// }
