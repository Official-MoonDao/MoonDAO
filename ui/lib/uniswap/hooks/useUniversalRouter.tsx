//WIP
import { useWallets } from '@privy-io/react-auth'
import { useSDK } from '@thirdweb-dev/react'
import { CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core'
import {
  AlphaRouter,
  SwapOptionsUniversalRouter,
  SwapRoute,
  SwapType,
} from '@uniswap/smart-order-router'
import { SwapRouter, UniswapTrade } from '@uniswap/universal-router-sdk'
import { ethers } from 'ethers'
import { useContext, useMemo } from 'react'
import PrivyWalletContext from '../../privy/privy-wallet-context'
import ChainContext from '../../thirdweb/chain-context'

export function useUniversalRouter(
  swapAmnt: number,
  tokenIn: Token,
  tokenOut: Token
) {
  const sdk = useSDK()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContext)
  const { wallets } = useWallets()

  const UNIVERSAL_ROUTER_ADDRESS = useMemo(() => {
    return +selectedChain.chainId === 1
      ? '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD'
      : '0x643770E279d5D0733F21d6DC03A8efbABf3255B4'
  }, [selectedChain])

  async function generateRoute(tradeType: TradeType) {
    try {
      const provider: any = sdk?.getProvider()
      const router: any = new AlphaRouter({
        chainId: selectedChain.chainId,
        provider,
      })

      const options: SwapOptionsUniversalRouter = {
        recipient: wallets[selectedWallet].address,
        slippageTolerance: new Percent(50, 10_000),
        type: SwapType.UNIVERSAL_ROUTER,
      }

      const route = await router.route(
        CurrencyAmount.fromRawAmount(
          tokenIn,
          ethers.utils.parseEther(String(swapAmnt)).toString()
        ),
        tokenOut,
        tradeType,
        options
      )

      return route
    } catch (err: any) {
      console.log('Issue creating uniswap route : ', err.message)
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
      new UniswapTrade(swapRoute.trade, options),
      options
    )

    const gasLimit = await signer.estimateGas({
      data: params.calldata,
      to: UNIVERSAL_ROUTER_ADDRESS,
      value: params.value,
      from: wallets[selectedWallet].address,
    })

    const tx = await signer.sendTransaction({
      data: params.calldata,
      to: UNIVERSAL_ROUTER_ADDRESS,
      value: params.value,
      from: wallets[selectedWallet].address,
      gasLimit: gasLimit,
    })

    return tx
  }

  return { generateRoute, executeRoute }
}
