import { MoonpayConfig, useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import PrivyWalletContext from '../privy-wallet-context'

export function useMoonPay() {
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  async function fund(amount: number) {
    const roundedCurrencyAmount = Math.round(amount * 1000) / 1000

    const fundWalletConfig: MoonpayConfig = {
      currencyCode: 'ETH_ARBITRUM',
      paymentMethod: 'credit_debit_card',
      quoteCurrencyAmount: roundedCurrencyAmount,
      uiConfig: {
        accentColor: '#696FFD',
        theme: 'dark',
      },
    }

    return wallets[selectedWallet].fund({ config: fundWalletConfig })
  }

  return fund
}
