import { createThirdwebClient } from 'thirdweb'

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
})

export const serverClient = createThirdwebClient({
  secretKey: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET as string,
})

export default client
