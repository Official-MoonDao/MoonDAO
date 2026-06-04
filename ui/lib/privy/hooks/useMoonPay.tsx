import { MoonpayConfig, MoonpayCurrencyCode, useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import PrivyWalletContext from '../privy-wallet-context'

/**
 * Chain IDs where MoonPay can deliver the chain's native token directly.
 * Polygon and Optimism are intentionally excluded:
 *   - Polygon (MATIC_POLYGON): the widget amount is computed as an ETH deficit, so the
 *     pre-filled MATIC quote would be wrong.
 *   - Optimism: MoonPay has no ETH_OPTIMISM code; falling back to ETH_ETHEREUM would deliver
 *     funds on Ethereum mainnet while the balance poll watches Optimism, so auto-proceed
 *     would never fire despite a successful purchase.
 */
export const SUPPORTED_MOONPAY_CHAIN_IDS = new Set([
  1, // Ethereum Mainnet
  11155111, // Sepolia
  42161, // Arbitrum One
  421614, // Arbitrum Sepolia
  8453, // Base
  84532, // Base Sepolia
])

// Maps a supported chain ID to a MoonPay currency code.
// Only call this for chains in SUPPORTED_MOONPAY_CHAIN_IDS.
export function getMoonPayCurrencyCode(chainId?: number): MoonpayCurrencyCode {
  switch (chainId) {
    case 42161: // Arbitrum One
    case 421614: // Arbitrum Sepolia
      return 'ETH_ARBITRUM'
    case 8453: // Base
    case 84532: // Base Sepolia
      return 'ETH_BASE'
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
      // Ceil to 4 decimal places (matching the toFixed(4) display) so the pre-fill
      // always covers the displayed deficit and the purchase never lands slightly short.
      ...(amount && amount > 0
        ? { quoteCurrencyAmount: Math.ceil(amount * 10000) / 10000 }
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
