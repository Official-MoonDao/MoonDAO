import { MoonpayConfig, useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import PrivyWalletContext from '../privy-wallet-context'

export function useMoonPay() {
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  function fund(quoteCurrencyAmount: number) {
    const fundWalletConfig: MoonpayConfig = {
      currencyCode: 'MATIC_POLYGON',
      quoteCurrencyAmount,
      paymentMethod: 'credit_debit_card',
      uiConfig: {
        accentColor: '#696FFD',
        theme: 'dark',
      },
    }

    return wallets[selectedWallet].fund({ config: fundWalletConfig })
  }

  return fund
}
