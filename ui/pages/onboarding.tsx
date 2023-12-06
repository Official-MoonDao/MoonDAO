import { Polygon } from '@thirdweb-dev/chains'
import { Token, TradeType } from '@uniswap/sdk-core'
import useTranslation from 'next-translate/useTranslation'
import { useContext, useEffect } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import { pregenSwapRoute } from '../lib/uniswap/pregenSwapRoute'
import Head from '../components/layout/Head'
import { OnboardingStageManager } from '../components/onboarding/OnboardingStageManager'
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from '../const/config'

export default function Onboarding({  }: any) {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  useEffect(() => {
    setSelectedChain(Polygon)
  }, [])

  const { t } = useTranslation('common')

  return (
    <div className="animate-fadeIn">
      <Head title={t('onboardingTitle')} description={t('onboardingDesc')} />
      <OnboardingStageManager
        selectedChain={selectedChain}
      />
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

  return {
    props: {
    },
    revalidate: 60,
  }
}
