import { createThirdwebClient } from 'thirdweb'

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
  config: {
    rpc: {
      batchTimeoutMs: 5000,
      maxBatchSize: 50,
      fetch: {
        requestTimeoutMs: 5000,
      },
    },
  },
})

export const serverClient = createThirdwebClient({
  secretKey: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET as string,
  config: {
    rpc: {
      maxBatchSize: 100,
    },
  },
})

export default client
