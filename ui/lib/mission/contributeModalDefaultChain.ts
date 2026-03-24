import { arbitrum, arbitrumSepolia, type Chain } from '@/lib/rpc/chains'

/** Read native balance (wei) via JSON-RPC; no wallet chain switch required. */
export async function fetchNativeBalanceWei(
  chain: Chain,
  walletAddress: string
): Promise<bigint> {
  const rpc = typeof (chain as { rpc?: string }).rpc === 'string' ? (chain as { rpc: string }).rpc : ''
  if (!rpc) return BigInt(0)

  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [walletAddress, 'latest'],
      }),
    })
    if (!res.ok) return BigInt(0)
    const json = await res.json()
    const hex = json?.result
    if (typeof hex !== 'string' || !hex.startsWith('0x')) return BigInt(0)
    return BigInt(hex)
  } catch {
    return BigInt(0)
  }
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
    throw new Error('pickChainWithMaxNativeBalance: empty entries')
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
