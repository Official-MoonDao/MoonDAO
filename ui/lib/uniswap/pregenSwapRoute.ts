import { Ethereum } from '@thirdweb-dev/chains'
import { CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core'
import {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapType,
} from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import { initSDK } from '../thirdweb/thirdweb'

export async function pregenSwapRoute(
  swapAmnt: number | string,
  tokenIn: Token,
  tokenOut: Token
) {
  try {
    const provider: any = initSDK(Ethereum).getProvider()
    const router: any = new AlphaRouter({
      chainId: 137,
      provider,
    })

    const options: SwapOptionsSwapRouter02 = {
      recipient: '0x0000000000000000000000000000000000000000',
      slippageTolerance: new Percent(50, 10_000),
      deadline: Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
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
    console.log('Issue creating uniswap route : ', err.message)
  }
}
