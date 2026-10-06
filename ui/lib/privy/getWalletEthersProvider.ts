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
 *
 * When the wallet already knows its chain, pass that id in. Otherwise ethers
 * calls `eth_chainId` and then `net_version` before the provider is usable.
 * Embedded Privy wallets answer `eth_chainId` locally, but `net_version` goes
 * to `*.rpc.privy.systems`. A blocked or slow RPC leaves `useActiveAccount()`
 * null after a successful Privy login.
 */
function chainIdFromWallet(wallet: any): number | undefined {
  const raw = wallet?.chainId
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw !== 'string' || raw.length === 0) return undefined
  const id = Number(raw.includes(':') ? raw.split(':')[1] : raw)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

export async function getWalletEthersProvider(
  wallet: any
): Promise<ethers.providers.Web3Provider> {
  if (!wallet) {
    throw new Error('No connected wallet available to build a provider')
  }
  const eip1193Provider = await wallet.getEthereumProvider()
  const chainId = chainIdFromWallet(wallet)
  return chainId
    ? new ethers.providers.Web3Provider(eip1193Provider, chainId)
    : new ethers.providers.Web3Provider(eip1193Provider)
}
