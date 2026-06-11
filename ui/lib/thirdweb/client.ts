import { createThirdwebClient } from 'thirdweb'

const rpcConfig = {
  rpc: {
    batchTimeoutMs: 10000,
    maxBatchSize: 20,
    fetch: {
      requestTimeoutMs: 10000,
    },
  },
}

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
  config: {
    rpc: {
      // Keep the batch window small so interactive reads (balances, odds,
      // post-tx refreshes) return promptly. A large window (multi-second) makes
      // sparse reads wait for the whole window before being sent. Bursts still
      // batch via maxBatchSize.
      batchTimeoutMs: 300,
      maxBatchSize: 50,
      fetch: {
        requestTimeoutMs: 5000,
      },
    },
  },
})

// Prefer the secret key (higher limits, server-only endpoints) but fall back
// to the public clientId so a local dev env without the secret doesn't crash
// the whole app at import time (thirdweb throws when neither is provided, and
// _app imports this module — the crash loops Fast Refresh's full reloads).
const secretKey = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET
export const serverClient = createThirdwebClient({
  ...(secretKey
    ? { secretKey }
    : { clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string }),
  config: {
    rpc: {
      maxBatchSize: 100,
    },
  },
})

export default client
