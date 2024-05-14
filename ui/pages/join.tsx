import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import useTranslation from 'next-translate/useTranslation'
import { useContext, useEffect } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import Head from '../components/layout/Head'
import { OnboardingV2 } from '../components/onboarding/OnboardingV2'

export default function Join() {
  const { t } = useTranslation('common')

  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  useEffect(() => {
    setSelectedChain(
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
    )
  }, [])

  return (
    <div className="animate-fadeIn">
      <Head title={t('joinTitle')} description={t('joinDesc')} />
      <OnboardingV2 selectedChain={selectedChain} />
    </div>
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
