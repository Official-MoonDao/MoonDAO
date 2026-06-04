import { MoonpayConfig, MoonpayCurrencyCode, useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import PrivyWalletContext from '../privy-wallet-context'

// Maps a chain ID to a MoonPay currency code for ETH/native token purchases.
// Supported codes come from the MoonpayCurrencyCode union in @privy-io/react-auth.
export function getMoonPayCurrencyCode(chainId?: number): MoonpayCurrencyCode {
  switch (chainId) {
    case 42161: // Arbitrum One
    case 421614: // Arbitrum Sepolia
      return 'ETH_ARBITRUM'
    case 8453: // Base
    case 84532: // Base Sepolia
      return 'ETH_BASE'
    case 137: // Polygon
      return 'MATIC_POLYGON'
    case 10: // Optimism — no ETH_OPTIMISM in MoonPay; Arbitrum is the closest L2
    case 11155420: // Optimism Sepolia
      return 'ETH_ARBITRUM'
    case 1: // Ethereum Mainnet
    case 11155111: // Sepolia
    default:
      return 'ETH_ETHEREUM'
  }
}

export function useMoonPay() {
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  /**
   * Opens the MoonPay widget via Privy's wallet.fund() to purchase ETH/native token.
   * @param amount - ETH amount to pre-fill; omit or pass 0 to let user choose
   * @param chainId - Chain ID used to derive the correct MoonPay currency code
   */
  async function fund(amount?: number, chainId?: number) {
    const currencyCode = getMoonPayCurrencyCode(chainId)

    const fundWalletConfig: MoonpayConfig = {
      currencyCode,
      paymentMethod: 'credit_debit_card',
      ...(amount && amount > 0
        ? { quoteCurrencyAmount: Math.round(amount * 1000) / 1000 }
        : {}),
      uiConfig: {
        accentColor: '#696FFD',
        theme: 'dark',
      },
    }

    return wallets[selectedWallet].fund({ config: fundWalletConfig })
  }

  return fund
}
