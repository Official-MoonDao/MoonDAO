import type { NextApiRequest, NextApiResponse } from 'next'
import { arbitrum, base, ethereum, optimismSepolia, sepolia } from '@/lib/rpc/chains'

type Body = { address?: string; chainId?: number | string }

function parseChainId(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n)) return n
  }
  return NaN
}

function usableRpcUrl(u: string): boolean {
  return typeof u === 'string' && u.length > 0 && !u.includes('undefined')
}

function rpcUrlsForChain(chainId: number): string[] {
  const ethHttp = typeof ethereum.rpc === 'string' ? ethereum.rpc : ''
  const arbHttp = typeof arbitrum.rpc === 'string' ? arbitrum.rpc : ''
  const baseHttp = typeof base.rpc === 'string' ? base.rpc : ''

  const byId: Record<number, string[]> = {
    1: [
      'https://cloudflare-eth.com',
      'https://ethereum.publicnode.com',
      'https://eth.llamarpc.com',
      'https://1rpc.io/eth',
      process.env.ETHEREUM_RPC_URL || '',
      ethHttp,
    ].filter(usableRpcUrl),
    42161: [
      'https://arb1.arbitrum.io/rpc',
      process.env.ARBITRUM_RPC_URL || '',
      arbHttp,
    ].filter(usableRpcUrl),
    8453: [
      'https://mainnet.base.org',
      process.env.BASE_RPC_URL || '',
      baseHttp,
    ].filter(usableRpcUrl),
    11155111: [
      'https://rpc.sepolia.org',
      typeof sepolia.rpc === 'string' ? sepolia.rpc : '',
    ].filter(usableRpcUrl),
    11155420: [
      'https://sepolia.optimism.io',
      typeof optimismSepolia.rpc === 'string' ? optimismSepolia.rpc : '',
    ].filter(usableRpcUrl),
  }

  return byId[chainId] ?? []
}

/**
 * Server-side eth_getBalance so the browser does not depend on Thirdweb client id or Infura CORS.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body as Body
  const address = typeof body?.address === 'string' ? body.address.trim() : ''
  const chainId = parseChainId(body?.chainId)

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return res.status(400).json({ error: 'Invalid address' })
  }
  if (!Number.isFinite(chainId)) {
    return res.status(400).json({ error: 'Invalid chainId' })
  }

  const urls = rpcUrlsForChain(chainId)
  if (urls.length === 0) {
    return res.status(400).json({ error: 'Unsupported chain' })
  }

  for (const rpcUrl of urls) {
    try {
      const r = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address.toLowerCase(), 'latest'],
        }),
      })
      if (!r.ok) continue
      const json = (await r.json()) as { result?: string; error?: { message?: string } }
      const hex = json?.result
      if (typeof hex === 'string' && hex.startsWith('0x')) {
        return res.status(200).json({ wei: hex })
      }
    } catch {
      /* try next RPC */
    }
  }

  return res.status(502).json({ error: 'All RPC endpoints failed' })
}
