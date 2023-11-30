import { MoonpayConfig, useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import ChainContext from '../../thirdweb/chain-context'
import PrivyWalletContext from '../privy-wallet-context'

export function useMoonPay() {
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContext)

  async function fund(amount: number) {
    const roundedCurrencyAmount = Math.round(amount * 1000) / 1000

    const fundWalletConfig: MoonpayConfig = {
      currencyCode:
        +selectedChain.chainId === 1 ? 'ETH_ETHEREUM' : 'MATIC_POLYGON',
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
