import { useFiatOnramp, useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import { destinationAssetFor, OnrampAsset } from '@/lib/onramp/assets'
import PrivyWalletContext from '../privy-wallet-context'

/**
 * Chain IDs where Privy's in-app fiat onramp can deliver funds. ETH (native)
 * is available on all of these; USDC is delivered via the chain's native USDC
 * contract address when requested.
 */
export const SUPPORTED_MOONPAY_CHAIN_IDS = new Set([
  1, // Ethereum Mainnet
  11155111, // Sepolia
  42161, // Arbitrum One
  421614, // Arbitrum Sepolia
  8453, // Base
  84532, // Base Sepolia
])

export function useMoonPay() {
  const { fund } = useFiatOnramp()
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  /**
   * Opens Privy's in-app fiat onramp modal to buy ETH (native) or USDC.
   * The entire purchase flow (provider selection, KYC, payment) renders inside
   * the Privy modal — there is no redirect to an external page. Privy routes the
   * purchase through an available provider (MoonPay, Coinbase, or Meld) based on
   * the user's region. Card/MoonPay theming is configured app-wide via
   * `fundingMethodConfig.moonpay` in _app.tsx.
   *
   * @param fiatAmount - USD amount to pre-fill in the widget; omit or pass 0 to let the user choose
   * @param chainId - destination chain ID for the purchased funds
   * @param address - destination wallet address. When provided, it's used directly
   *   (the caller already knows the active wallet); otherwise we fall back to the
   *   Privy `useWallets()` list, which can be empty/lagging right after load.
   * @param asset - crypto to purchase. Defaults to ETH (native). Pass 'USDC' for
   *   marketplace listings priced in USDC.
   */
  async function fundWallet(
    fiatAmount?: number,
    chainId?: number,
    address?: string,
    asset: OnrampAsset = 'ETH'
  ) {
    const destinationAddress = address || wallets[selectedWallet]?.address
    if (!destinationAddress) {
      throw new Error('No wallet selected to fund')
    }
    if (!chainId) {
      throw new Error('Destination chain ID is required')
    }

    return fund({
      // Default the fiat picker to USD but allow the user's local currency too.
      source: { defaultAsset: 'usd' },
      destination: {
        asset: destinationAssetFor(chainId, asset),
        chain: `eip155:${chainId}`,
        address: destinationAddress,
      },
      environment: 'production',
      ...(fiatAmount && fiatAmount > 0
        ? { defaultAmount: String(Math.ceil(fiatAmount)) }
        : {}),
    })
  }

  return fundWallet
}
