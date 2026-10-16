import { createThirdwebClient, defineChain, readContract } from 'thirdweb'
import { getChainById } from '@/lib/thirdweb/chain'

// Dedicated read client with RPC batching DISABLED (maxBatchSize: 1). Batching is
// broken in this thirdweb/viem version: when several eth_call results come back
// in one JSON-RPC batch response, the decoder returns `undefined` for some of
// them ("Cannot read properties of undefined (reading 'buffer')"), which silently
// blanks reads. So each call goes on its own.
//
// The flip side of no batching is request volume, so we cap concurrency and
// retry on 429 (see rpcRead below).
export const deprizeReadClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
  config: { rpc: { maxBatchSize: 1, fetch: { requestTimeoutMs: 15000 } } },
})

/**
 * Use the app's chain RPC (browser → `/api/rpc/<id>` with Infura + public
 * fallbacks; SSR → Infura/Ankr directly). `defineChain(id)` with no `rpc`
 * used to isolate DePrize from Infura 429s via thirdweb's edge
 * (`https://<id>.rpc.thirdweb.com/<clientId>`), but that endpoint now returns
 * HTTP 401 Unauthorized, which is what blanked `/deprize/1` on Arbitrum.
 */
export function deprizeReadChain(chainId: number) {
  const known = getChainById(chainId)
  if (known) return known
  if (typeof window !== 'undefined') {
    return defineChain({
      id: chainId,
      rpc: `${window.location.origin}/api/rpc/${chainId}`,
    })
  }
  return defineChain(chainId)
}

// ---- Concurrency-limited, 429-retrying read layer ----
// Never let more than a few reads hit the RPC at once (the app makes its own
// requests too), and back off + retry the occasional "429 Too Many Requests".
const MAX_CONCURRENT_READS = 3
// Extra slots only priority reads may use, so a page with many markets
// polling cannot starve the one read the user is waiting on.
const PRIORITY_RESERVE = 2
let activeReads = 0
const readQueue: Array<{ resolve: () => void; priority: boolean }> = []

const capFor = (priority: boolean) =>
  priority ? MAX_CONCURRENT_READS + PRIORITY_RESERVE : MAX_CONCURRENT_READS

const acquireRead = (priority: boolean) =>
  new Promise<void>((resolve) => {
    if (activeReads < capFor(priority)) {
      activeReads++
      resolve()
    } else if (priority) {
      const firstNormal = readQueue.findIndex((q) => !q.priority)
      readQueue.splice(firstNormal < 0 ? readQueue.length : firstNormal, 0, { resolve, priority })
    } else {
      readQueue.push({ resolve, priority })
    }
  })

const releaseRead = () => {
  activeReads = Math.max(0, activeReads - 1)
  const next = readQueue[0]
  if (next && activeReads < capFor(next.priority)) {
    readQueue.shift()
    activeReads++
    next.resolve()
  }
}

export async function rpcRead<T = any>(
  args: Parameters<typeof readContract>[0],
  opts?: { priority?: boolean }
): Promise<T> {
  await acquireRead(!!opts?.priority)
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return (await readContract(args)) as T
      } catch (e: any) {
        const msg = `${e?.message ?? ''} ${e?.shortMessage ?? ''}`.toLowerCase()
        const rateLimited =
          msg.includes('429') ||
          msg.includes('too many requests') ||
          msg.includes('-32005')
        if (rateLimited && attempt < 5) {
          await new Promise((r) => setTimeout(r, 350 * 2 ** attempt))
          continue
        }
        throw e
      }
    }
  } finally {
    releaseRead()
  }
}
