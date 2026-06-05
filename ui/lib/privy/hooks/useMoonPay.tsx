import { MoonpayCurrencyCode, useWallets } from '@privy-io/react-auth'
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
   * Opens the MoonPay onramp via Privy's native funding flow, which renders
   * inside Privy's in-app modal (no redirect to MoonPay's hosted page).
   *
   * NOTE: we deliberately use the native funding config ({ chain, amount, asset })
   * rather than passing a raw MoonpayConfig. Passing a MoonpayConfig uses Privy's
   * deprecated "direct" path that signs a MoonPay URL and navigates the user to
   * MoonPay's hosted checkout in a new page. The native config keeps the entire
   * flow embedded in the app. Card payment method + theming are configured app-wide
   * via PrivyProvider `fundingMethodConfig.moonpay` in _app.tsx.
   *
   * @param amount - native-token amount to pre-fill; omit or pass 0 to let user choose
   * @param chainId - destination chain ID for the purchased funds
   */
  async function fund(amount?: number, chainId?: number) {
    const chain = chainId ? { id: chainId } : undefined

    if (amount && amount > 0) {
      // Ceil to 4 decimal places (matching the toFixed(4) display) so the pre-fill
      // always covers the displayed deficit and the purchase never lands slightly short.
      const roundedAmount = Math.ceil(amount * 10000) / 10000
      return wallets[selectedWallet].fund({
        chain,
        amount: String(roundedAmount),
        asset: 'native-currency',
        defaultFundingMethod: 'card',
        card: { preferredProvider: 'moonpay' },
      })
    }

    return wallets[selectedWallet].fund({
      chain,
      defaultFundingMethod: 'card',
      card: { preferredProvider: 'moonpay' },
    })
  }

  return fund
}
