import { createThirdwebClient, defineChain, readContract } from 'thirdweb'

// Dedicated read client with RPC batching DISABLED (maxBatchSize: 1). Batching is
// broken in this thirdweb/viem version: when several eth_call results come back
// in one JSON-RPC batch response, the decoder returns `undefined` for some of
// them ("Cannot read properties of undefined (reading 'buffer')"), which silently
// blanks reads. So each call goes on its own.
//
// The flip side of no batching is request volume, and the chain RPC is a single
// Infura endpoint shared with the rest of the app — so we additionally cap
// concurrency and retry on 429 (see rpcRead below) to stay under the rate limit.
export const deprizeReadClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
  config: { rpc: { maxBatchSize: 1, fetch: { requestTimeoutMs: 15000 } } },
})

// Read through thirdweb's RPC edge (derived from the client id) rather than the
// app's hardcoded Infura endpoint. `defineChain(<id>)` with no explicit rpc makes
// thirdweb use https://<id>.rpc.thirdweb.com/<clientId>, isolating these reads
// from the app's Infura traffic and its 429 rate limit.
export const deprizeReadChain = (chainId: number) => defineChain(chainId)

// ---- Concurrency-limited, 429-retrying read layer ----
// Never let more than a few reads hit the RPC at once (the app makes its own
// requests too), and back off + retry the occasional "429 Too Many Requests".
const MAX_CONCURRENT_READS = 3
let activeReads = 0
const readQueue: Array<() => void> = []

const acquireRead = () =>
  new Promise<void>((resolve) => {
    if (activeReads < MAX_CONCURRENT_READS) {
      activeReads++
      resolve()
    } else {
      readQueue.push(resolve)
    }
  })

const releaseRead = () => {
  activeReads = Math.max(0, activeReads - 1)
  const next = readQueue.shift()
  if (next) {
    activeReads++
    next()
  }
}

export async function rpcRead<T = any>(
  args: Parameters<typeof readContract>[0]
): Promise<T> {
  await acquireRead()
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
