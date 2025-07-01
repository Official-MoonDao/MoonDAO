import { createThirdwebClient } from 'thirdweb'

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
  config: {
    rpc: {
      batchTimeoutMs: 10000,
      maxBatchSize: 20,
      fetch: {
        requestTimeoutMs: 10000,
      },
    },
  },
})

export const serverClient = createThirdwebClient({
  secretKey: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET as string,
  config: {
    rpc: {
      batchTimeoutMs: 10000,
      maxBatchSize: 20,
      fetch: {
        requestTimeoutMs: 10000,
      },
    },
  },
})

export default client
