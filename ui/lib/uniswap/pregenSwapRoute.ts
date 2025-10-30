import { CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core'
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import client from '../thirdweb/client'

export async function pregenSwapRoute(
  selectedChain: any,
  swapAmnt: number | string,
  tokenIn: any,
  tokenOut: any,
  decimals: number = 18
) {
  try {
    const provider = ethers5Adapter.provider.toEthers({
      client,
      chain: selectedChain,
    })
    const router: any = new AlphaRouter({
      chainId: selectedChain.id,
      provider,
    })

    const options: any = {
      recipient: '0x0000000000000000000000000000000000000000',
      slippageTolerance: new Percent(50, 10_000),
      type: SwapType.UNIVERSAL_ROUTER,
    }

    const amount = ethers.utils.parseUnits(String(swapAmnt), decimals)

    const route = await router.route(
      CurrencyAmount.fromRawAmount(tokenIn, amount.toString()),
      tokenOut,
      TradeType.EXACT_INPUT,
      options
    )

    return route
  } catch (err: any) {
    console.log('Issue creating uniswap route : ', err.message)
  }
}
