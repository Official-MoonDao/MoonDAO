import { useWallets } from '@privy-io/react-auth'
import { CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core'
import {
  AlphaRouter,
  SwapOptionsUniversalRouter,
  SwapRoute,
  SwapType,
} from '@uniswap/smart-order-router'
import { SwapRouter, UniswapTrade, Trade } from '@uniswap/universal-router-sdk'
import { ethers } from 'ethers'
import { useContext } from 'react'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { UNIVERSAL_ROUTER_ADDRESSES, ZERO_ADDRESS } from '../../../const/config'
import PrivyWalletContext from '../../privy/privy-wallet-context'

export function useUniversalRouter(
  swapAmnt: number,
  tokenIn: any,
  tokenOut: any
) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { wallets } = useWallets()

  async function generateRoute(tradeType: TradeType) {
    try {
      // const provider: any = sdk?.getProvider()
      const provider = ethers5Adapter.provider.toEthers({
        client,
        chain: selectedChain,
      })
      const router: any = new AlphaRouter({
        chainId: selectedChain.id,
        provider,
      })

      const options: SwapOptionsUniversalRouter = {
        recipient: wallets[selectedWallet]?.address || ZERO_ADDRESS,
        slippageTolerance: new Percent(50, 10_000),
        type: SwapType.UNIVERSAL_ROUTER,
      }

      const route = await router.route(
        CurrencyAmount.fromRawAmount(
          tokenIn,
          ethers.utils.parseUnits(String(swapAmnt), tokenIn.decimals).toString()
        ),
        tokenOut,
        tradeType,
        options
      )

      return route
    } catch (err: any) {
      console.log('Issue creating uniswap route : ', err)
    }
  }

  async function executeRoute(swapRoute: SwapRoute) {
    const provider = await wallets[selectedWallet].getEthersProvider()
    const signer = provider?.getSigner()

    const options: any = {
      recipient: wallets[selectedWallet].address,
      slippageTolerance: new Percent(50, 10_000),
    }

    const params = SwapRouter.swapCallParameters(
      //new UniswapTrade(swapRoute.trade, options),
      Trade(tokenIn, tokenOut, tradeType),
      options
    )

    const gasLimit = await signer.estimateGas({
      data: params.calldata,
      to: UNIVERSAL_ROUTER_ADDRESSES[chainSlug],
      value: params.value,
      from: wallets[selectedWallet].address,
    })

    const tx = await signer.sendTransaction({
      data: params.calldata,
      to: UNIVERSAL_ROUTER_ADDRESSES[chainSlug],
      value: params.value,
      from: wallets[selectedWallet].address,
      gasLimit: gasLimit,
    })

    const receipt = await provider.waitForTransaction(tx.hash, 1, 150000)

    return receipt
  }

  return { generateRoute, executeRoute }
}
