import { createThirdwebClient } from 'thirdweb'

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

export default client
