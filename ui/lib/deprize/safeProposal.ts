import { ethers } from 'ethers'

/** Safe app short names for the chains this app actually proposes on. */
const SAFE_APP_PREFIX: Record<number, string> = {
  1: 'eth',
  11155111: 'sep',
  42161: 'arb1',
  137: 'matic',
  8453: 'base',
}

export function isAddressInList(
  user: string | undefined,
  owners: readonly string[]
): boolean {
  if (!user) return false
  const needle = user.toLowerCase()
  return owners.some((owner) => owner.toLowerCase() === needle)
}

/**
 * Shareable Safe app link for one proposed transaction.
 * `id` is `multisig_<safe>_<safeTxHash>`, which is what the app opens.
 */
export function safeTransactionUrl(
  chainId: number,
  safeAddress: string,
  safeTxHash: string
): string {
  const prefix = SAFE_APP_PREFIX[chainId]
  if (!prefix) throw new Error(`No Safe app prefix for chain ${chainId}`)
  const safe = ethers.utils.getAddress(safeAddress)
  return `https://app.safe.global/transactions/tx?safe=${prefix}:${safe}&id=multisig_${safe}_${safeTxHash}`
}

function abiValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(abiValue)
  return value
}

export function encodeContractCall(abi: any, method: string, params: readonly unknown[]): string {
  const iface = new ethers.utils.Interface(abi)
  return iface.encodeFunctionData(method, params.map(abiValue) as unknown[])
}
