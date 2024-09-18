import { Chain } from '@thirdweb-dev/chains'
import { CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core'
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router'
import { ZERO_ADDRESS } from 'const/config'
import { ethers } from 'ethers'
import { initSDK } from '../thirdweb/thirdweb'

export async function pregenSwapRoute(
  selectedChain: Chain,
  swapAmnt: number | string,
  tokenIn: any,
  tokenOut: any
) {
  try {
    const provider: any = initSDK(selectedChain).getProvider()
    const router: any = new AlphaRouter({
      chainId: selectedChain.chainId,
      provider,
    })

    const options = {
      recipient: ZERO_ADDRESS,
      slippageTolerance: new Percent(50, 10_000),
      type: SwapType.UNIVERSAL_ROUTER,
    }

    const route = await router.route(
      CurrencyAmount.fromRawAmount(
        tokenIn,
        ethers.utils.parseEther(String(swapAmnt)).toString()
      ),
      tokenOut,
      TradeType.EXACT_INPUT,
      options
    )

    return route
  } catch (err: any) {
    console.log(err)
  }
}
