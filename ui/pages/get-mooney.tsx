import { Polygon, Sepolia } from '@thirdweb-dev/chains'
import { Token } from '@uniswap/sdk-core'
import useTranslation from 'next-translate/useTranslation'
import { pregenSwapRoute } from '../lib/uniswap/pregenSwapRoute'
import { OnboardingStageManager } from '../components/get-mooney/OnboardingStageManager'
import Head from '../components/layout/Head'
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from '../const/config'

function JoinCard({ label, text }: any) {
  return (
    <div className="flex">
      <div>
        <dt className="text-lg font-RobotoMono font-medium text-left lg:text-left text-gray-950 dark:text-white">
          {label}
        </dt>
        <dd className="mt-5 lg:mt-4 xl:mt-6 text-sm sm:text-base lg:text-sm xl:text-base sm:mt-6 max-w-[698px] text-left lg:text-left text-gray-600 dark:text-white dark:opacity-60">
          {text}
        </dd>
      </div>
    </div>
  )
}

export default function Join({ usdQuotes }: any) {
  const { t } = useTranslation('common')

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head title={t('mooneyTitle')} description={t('mooneyDesc')} />
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
