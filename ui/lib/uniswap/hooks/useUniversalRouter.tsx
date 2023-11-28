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
import { useContext } from 'react'
import ERC20 from '../../../const/abis/ERC20.json'
import PrivyWalletContext from '../../privy/privy-wallet-context'

const UNIVERSAL_ROUTER_ADDRESS = '0x643770E279d5D0733F21d6DC03A8efbABf3255B4'

export function useUniversalRouter(
  swapAmnt: number,
  tokenIn: Token,
  tokenOut: Token
) {
  const sdk = useSDK()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  async function generateRoute() {
    try {
      const provider: any = await wallets[selectedWallet]?.getEthersProvider()
      const router: any = new AlphaRouter({
        chainId: 137,
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
        TradeType.EXACT_INPUT,
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

    const tx = await signer.sendTransaction({
      data: params.calldata,
      to: UNIVERSAL_ROUTER_ADDRESS,
      value: params.value,
      from: wallets[selectedWallet].address,
      gasLimit: 1000000,
    })

    return tx
  }

  return { generateRoute, executeRoute }
}
