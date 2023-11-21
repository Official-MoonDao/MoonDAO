//WIP
import { useWallets } from '@privy-io/react-auth'
import { useSDK } from '@thirdweb-dev/react'
import { CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core'
import {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapRoute,
  SwapType,
} from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import { useContext } from 'react'
import ERC20 from '../../../const/abis/ERC20.json'
import PrivyWalletContext from '../../privy/privy-wallet-context'
import { MATIC } from '../UniswapTokens'

export const V3_SWAP_ROUTER_ADDRESS =
  '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

enum TransactionState {
  Failed = 'Failed',
  New = 'New',
  Rejected = 'Rejected',
  Sending = 'Sending',
  Sent = 'Sent',
}

export function useSwapRouter(
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

      const options: SwapOptionsSwapRouter02 = {
        recipient: wallets[selectedWallet].address,
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

  async function executeRoute(route: SwapRoute) {
    try {
      const walletAddress = wallets[selectedWallet].address
      const provider = await wallets[selectedWallet].getEthersProvider()
      const signer = provider?.getSigner()

      if (!walletAddress || !signer) {
        throw new Error('Cannot execute a trade without a connected wallet')
      }

      // // Fail if transfer approvals do not go through
      // if (tokenApproval !== TransactionState.Sent) {
      //   return TransactionState.Failed
      // }

      const suggestedMaxFeePerGas = (
        await provider.getFeeData()
      ).maxFeePerGas?.toString()

      const tx = await signer.sendTransaction({
        data: route?.methodParameters?.calldata,
        to: V3_SWAP_ROUTER_ADDRESS,
        value: route?.methodParameters?.value,
        from: walletAddress,
        maxFeePerGas: suggestedMaxFeePerGas,
        maxPriorityFeePerGas: 0,
        gasLimit: 188343,
      })

      return tx
    } catch (err: any) {
      console.log(err.message)
    }
  }

  async function getTokenTransferApproval(token: Token, amount: number) {
    const walletAddress = wallets[selectedWallet].address
    if (!walletAddress || !sdk) {
      console.log('No Provider Found')
    }

    try {
      const tokenContract = await sdk?.getContract(token.address, ERC20.abi)

      //approve token transfer
      const tx = await tokenContract?.call('approve', [
        V3_SWAP_ROUTER_ADDRESS,
        amount,
      ])
      return tx
    } catch (e) {
      console.error(e)
    }
  }

  return { generateRoute, executeRoute, getTokenTransferApproval }
}
