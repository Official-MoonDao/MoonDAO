import { useContext } from 'react'
import ChainContext from '../lib/thirdweb/chain-context'
import { DAI, ETH, MOONEY } from '../lib/uniswap/UniswapTokens'
import { pregenSwapRoute } from '../lib/uniswap/pregenSwapRoute'
import Head from '../components/layout/Head'
import { OnboardingStageManager } from '../components/onboarding/OnboardingStageManager'

const CONTRIBUTION_LEVEL_PRICES = [10, 50]

export default function Onboarding({ pregenSwapRoutes }: any) {
  const { selectedChain, setSelectedChain } = useContext(ChainContext)

  return (
    <div className="animate-fadeIn">
      <Head title="Onboarding" />
      <OnboardingStageManager
        selectedChain={selectedChain}
        pregenSwapRoutes={pregenSwapRoutes}
      />
    </div>
  )
}

export async function getServerSideProps() {
  // USD to Native uniswap quotes
  const explorerNativeRoute = await pregenSwapRoute(
    CONTRIBUTION_LEVEL_PRICES[0] * 12,
    DAI,
    ETH
  )
  const explorerNativeQuote =
    explorerNativeRoute?.route[0].rawQuote.toString() / 10 ** 18

  const citizenNativeRoute = await pregenSwapRoute(
    CONTRIBUTION_LEVEL_PRICES[1] * 12,
    DAI,
    ETH
  )
  const citizenNativeQuote =
    citizenNativeRoute?.route[0].rawQuote.toString() / 10 ** 18

  //Native to Mooney uniswap quotes
  const explorerMooneyRoute = await pregenSwapRoute(
    explorerNativeQuote,
    ETH,
    MOONEY
  )
  const explorerMooneyQuote =
    explorerMooneyRoute?.route[0].rawQuote.toString() / 10 ** 18

  const citizenMooneyRoute = await pregenSwapRoute(
    citizenNativeQuote,
    ETH,
    MOONEY
  )
  const citizenMooneyQuote =
    citizenMooneyRoute?.route[0].rawQuote.toString() / 10 ** 18

  return {
    props: {
      pregenSwapRoutes: [
        {
          price: 10,
          nativeQuote: explorerNativeQuote,
          mooneyQuote: explorerMooneyQuote,
        },
        {
          price: 50,
          nativeQuote: citizenNativeQuote,
          mooneyQuote: citizenMooneyQuote,
        },
      ],
    },
  }
}
