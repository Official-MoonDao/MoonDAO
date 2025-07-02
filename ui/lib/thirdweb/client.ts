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
  config: rpcConfig,
})

export const serverClient = createThirdwebClient({
  secretKey: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET as string,
  config: rpcConfig,
})

export default client
