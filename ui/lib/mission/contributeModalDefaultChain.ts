import { arbitrum, arbitrumSepolia, type Chain } from '@/lib/rpc/chains'
import { addNetworkToWallet } from '@/lib/thirdweb/addNetworkToWallet'
import client from '@/lib/thirdweb/client'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'

type PrivyEvmWallet = {
  chainId?: string
  switchChain?: (chainId: number) => Promise<unknown>
}

/** Align connected wallet with the chosen chain (add network if needed). */
export async function switchPrivyWalletToChainIfNeeded(
  wallet: PrivyEvmWallet | undefined,
  bestChain: Chain
): Promise<void> {
  if (!wallet || typeof wallet.switchChain !== 'function') return
  try {
    const walletChainId = wallet.chainId ? +wallet.chainId.split(':')[1] : null
    if (walletChainId !== bestChain.id) {
      await wallet.switchChain(bestChain.id)
    }
  } catch (err: any) {
    if (err?.code === 4902 || err?.message?.includes('Unrecognized chain')) {
      const success = await addNetworkToWallet(bestChain)
      if (success) {
        try {
          await wallet.switchChain(bestChain.id)
        } catch {
          /* user rejected or switch failed */
        }
      }
    }
  }
}

const BROWSER_PUBLIC_RPC: Record<number, string[]> = {
  1: ['https://cloudflare-eth.com', 'https://eth.llamarpc.com'],
  42161: ['https://arb1.arbitrum.io/rpc'],
  8453: ['https://mainnet.base.org'],
  11155111: ['https://rpc.sepolia.org'],
  11155420: ['https://sepolia.optimism.io'],
}

function isUsableRpcUrl(u: string): boolean {
  return u.length > 0 && !u.includes('undefined')
}

async function readBalanceFromRpcUrl(rpcUrl: string, walletAddress: string): Promise<bigint | null> {
  if (!isUsableRpcUrl(rpcUrl)) return null
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [walletAddress.toLowerCase(), 'latest'],
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: string }
    const hex = json?.result
    if (typeof hex !== 'string' || !hex.startsWith('0x')) return null
    return BigInt(hex)
  } catch {
    return null
  }
}

/** Same-origin API uses server-side RPCs (avoids broken Thirdweb client id / Infura browser calls). */
async function fetchNativeBalanceViaAppApi(chainId: number, walletAddress: string): Promise<bigint | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/rpc/native-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: walletAddress.toLowerCase(), chainId: Number(chainId) }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { wei?: string }
    if (typeof data.wei === 'string' && data.wei.startsWith('0x')) {
      return BigInt(data.wei)
    }
  } catch {
    return null
  }
  return null
}

/** Read native balance (wei); no wallet chain switch required. */
export async function fetchNativeBalanceWei(
  chain: Chain,
  walletAddress: string
): Promise<bigint> {
  const trimmed = typeof walletAddress === 'string' ? walletAddress.trim() : ''
  if (!trimmed || !/^0x[a-fA-F0-9]{40}$/i.test(trimmed)) {
    return BigInt(0)
  }
  const normalized = (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`
  const chainId = Number(chain.id)

  const fromApi = await fetchNativeBalanceViaAppApi(chainId, normalized)
  if (fromApi !== null) {
    return fromApi
  }

  try {
    const rpcRequest = getRpcClient({ client, chain })
    const tw = await eth_getBalance(rpcRequest, { address: normalized })
    return tw
  } catch {
    /* continue */
  }

  const primaryRpc =
    typeof (chain as { rpc?: string }).rpc === 'string' ? (chain as { rpc: string }).rpc : ''
  const fromPrimary = await readBalanceFromRpcUrl(primaryRpc, normalized)
  if (fromPrimary !== null) {
    return fromPrimary
  }

  const fallbacks = BROWSER_PUBLIC_RPC[chainId] ?? []
  for (const url of fallbacks) {
    const wei = await readBalanceFromRpcUrl(url, normalized)
    if (wei !== null) return wei
  }

  return BigInt(0)
}

/**
 * Chain with the largest native balance. Ties always prefer Arbitrum (mainnet One, else Arbitrum Sepolia);
 * otherwise first match in `tieBreakOrder`.
 */
export function pickChainWithMaxNativeBalance(
  entries: { chain: Chain; wei: bigint }[],
  tieBreakOrder: Chain[]
): Chain {
  if (entries.length === 0) {
    return tieBreakOrder[0] ?? arbitrum
  }
  const maxWei = entries.reduce((m, e) => (e.wei > m ? e.wei : m), BigInt(0))
  const top = entries.filter((e) => e.wei === maxWei)
  if (top.length === 1) return top[0].chain

  const arbMain = top.find((e) => e.chain.id === arbitrum.id)
  if (arbMain) return arbMain.chain
  const arbSepolia = top.find((e) => e.chain.id === arbitrumSepolia.id)
  if (arbSepolia) return arbSepolia.chain

  const orderIds = tieBreakOrder.map((c) => c.id)
  const rank = (chainId: number) => {
    const i = orderIds.indexOf(chainId)
    return i === -1 ? 999 : i
  }
  return [...top].sort((a, b) => rank(a.chain.id) - rank(b.chain.id))[0].chain
}
