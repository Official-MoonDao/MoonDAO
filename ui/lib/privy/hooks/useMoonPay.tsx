import { MoonpayConfig, useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ChainContext from '../../thirdweb/chain-context'
import { useUniswapTokens } from '../../uniswap/UniswapTokens'
import { useUniversalRouter } from '../../uniswap/hooks/useUniversalRouter'
import PrivyWalletContext from '../privy-wallet-context'

export function useMoonPay() {
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContext)
  const { DAI, NATIVE_TOKEN } = useUniswapTokens()
  const {
    generateRoute: generateNativeRoute,
    executeRoute: executeNativeSwapRoute,
  } = useUniversalRouter(30, DAI, NATIVE_TOKEN)

  async function fund(amount: number) {
    const gasFunds = +selectedChain.chainId === 1 ? 0.01 : 1
    const roundedCurrencyAmount = Math.round(amount * 100000) / 100000

    const nativeRoute = await generateNativeRoute()
    const nativeQuote = nativeRoute.route[0].rawQuote.toString() / 10 ** 18

    const quoteCurrencyAmount =
      +roundedCurrencyAmount > nativeQuote
        ? +roundedCurrencyAmount + gasFunds
        : nativeQuote
    console.log(quoteCurrencyAmount)
    const fundWalletConfig: MoonpayConfig = {
      currencyCode:
        +selectedChain.chainId === 1 ? 'ETH_ETHEREUM' : 'MATIC_POLYGON',
      paymentMethod: 'credit_debit_card',
      quoteCurrencyAmount: quoteCurrencyAmount,
      uiConfig: {
        accentColor: '#696FFD',
        theme: 'dark',
      },
    }

    return wallets[selectedWallet].fund({ config: fundWalletConfig })
  }

  return fund
}
