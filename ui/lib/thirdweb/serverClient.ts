import { createThirdwebClient } from 'thirdweb'

// Server-side thirdweb client. Kept in its own module (instead of client.ts)
// so importing the browser `client` doesn't also instantiate this one in
// every client bundle.
//
// Prefer the secret key (higher limits, server-only endpoints) but fall back
// to the public clientId so a local dev env without the secret doesn't crash
// the whole app at import time (thirdweb throws when neither is provided).
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
