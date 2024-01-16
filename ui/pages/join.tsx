import { Polygon } from '@thirdweb-dev/chains'
import { Token, TradeType } from '@uniswap/sdk-core'
import useTranslation from 'next-translate/useTranslation'
import { useContext, useEffect } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import { pregenSwapRoute } from '../lib/uniswap/pregenSwapRoute'
import Head from '../components/layout/Head'
import { OnboardingStageManager } from '../components/onboarding/OnboardingStageManager'
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from '../const/config'

export default function Join({ usdQuotes }: any) {
  const { t } = useTranslation('common')

  return (
    <div className="animate-fadeIn">
      <Head title={t('joinTitle')} description={t('joinDesc')} />
      <OnboardingStageManager usdQuotes={usdQuotes} />
    </div>
  )
}

export async function getStaticProps() {
  const DAI = new Token(
    137,
    DAI_ADDRESSES['polygon'],
    18,
    'DAI',
    'DAI Stablecoin'
  )

  const MOONEY = new Token(
    137,
    MOONEY_ADDRESSES['polygon'],
    18,
    'MOONEY',
    'MOONEY (PoS)'
  )

  const levelOneRoute = await pregenSwapRoute(Polygon, 20000, MOONEY, DAI)
  const levelTwoRoute = await pregenSwapRoute(Polygon, 100000, MOONEY, DAI)
  const levelThreeRoute = await pregenSwapRoute(Polygon, 500000, MOONEY, DAI)

  const usdQuotes = [levelOneRoute, levelTwoRoute, levelThreeRoute].map(
    (swapRoute) => swapRoute?.route[0].rawQuote.toString() / 10 ** 18
  )

  return {
    props: {
      usdQuotes,
    },
    revalidate: 60,
  }
}
