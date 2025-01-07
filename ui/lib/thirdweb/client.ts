import { createThirdwebClient } from 'thirdweb'

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
})

export default client
