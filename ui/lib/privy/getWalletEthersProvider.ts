import { ethers } from 'ethers'

/**
 * Privy v3 removed `ConnectedWallet.getEthersProvider()`. Connected wallets now
 * expose an EIP-1193 provider via `getEthereumProvider()`. This helper wraps that
 * EIP-1193 provider in an ethers v5 `Web3Provider`, restoring the previous return
 * type so existing call sites (`.getSigner()`, `.getBalance()`, `.getGasPrice()`,
 * `.getCode()`, etc.) keep working unchanged.
 *
 * Throws when no wallet is provided so callers fail fast with a clear message
 * instead of silently operating without a provider.
 */
export async function getWalletEthersProvider(
  wallet: any
): Promise<ethers.providers.Web3Provider> {
  if (!wallet) {
    throw new Error('No connected wallet available to build a provider')
  }
  const eip1193Provider = await wallet.getEthereumProvider()
  return new ethers.providers.Web3Provider(eip1193Provider)
}
