//WIP
import { useWallets } from '@privy-io/react-auth'
import { Mumbai, Polygon } from '@thirdweb-dev/chains'
import {
  CurrencyAmount,
  Ether,
  Percent,
  Token,
  TradeType,
} from '@uniswap/sdk-core'
import {
  AlphaRouter,
  SwapOptionsSwapRouter02,
  SwapRoute,
  SwapType,
} from '@uniswap/smart-order-router'
import { ethers } from 'ethers'
import { useContext, useState } from 'react'
import ERC20_ABI from '../../../const/abis/ERC20.json'
import { MOONEY_ADDRESSES } from '../../../const/config'
import PrivyWalletContext from '../../privy/privy-wallet-context'
import { initSDK } from '../../thirdweb/thirdweb'
import { fromReadableAmount } from './conversion'

const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

const ETH: any = Ether.onChain(
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 1 : 5
)

const MOONEY = new Token(
  1,
  MOONEY_ADDRESSES[
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'ethereum' : 'goerli'
  ],
  18,
  'MOONEY',
  'MOONEY'
)

export function useSwapRouter() {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  async function generateRoute() {
    const provider: any = wallets[selectedWallet].getEthereumProvider()
    const router: any = new AlphaRouter({
      chainId: process.env.NEXT_PUBLIC_CHAIN === 'testnet' ? 5 : 1,
      provider,
    })

    const options: SwapOptionsSwapRouter02 = {
      recipient: wallets[selectedWallet].address,
      slippageTolerance: new Percent(50, 10_000),
      deadline: Math.floor(Date.now() / 1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    }

    const route = await router.route(
      CurrencyAmount.fromRawAmount(ETH, fromReadableAmount(0.1, 18).toString()),
      MOONEY,
      TradeType.EXACT_INPUT,
      options
    )

    return route
  }

  async function executeRoute(route: SwapRoute) {
    const provider: any = wallets[selectedWallet].getEthereumProvider()

    const walletAddress = wallets[selectedWallet].address

    if (!walletAddress || !provider) {
      throw new Error('Cannot execute a trade without a connected wallet')
    }

    const tokenApproval = await getTokenTransferApproval(ETH, 0.1)
  }

  async function getTokenTransferApproval(token: Token, amount: number) {
    const provider: any = wallets[selectedWallet].getEthereumProvider()

    const walletAddress = wallets[selectedWallet].address
    if (!provider || !walletAddress) {
      console.log('No Provider Found')
    }

    try {
      const sdk = initSDK(
        process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai
      )

      const tokenContract = await sdk.getContract(token.address, ERC20_ABI.abi)

      //approve token transfer
      const tx = await tokenContract.call('approve', [
        V3_SWAP_ROUTER_ADDRESS,
        fromReadableAmount(amount, token.decimals).toString(),
      ])
      return tx
    } catch (e) {
      console.error(e)
    }
  }

  return { generateRoute, executeRoute }
}
