import { Chain } from '@thirdweb-dev/chains'
import { ThirdwebSDK } from '@thirdweb-dev/sdk'

export function initSDK(chain: Chain) {
  return new ThirdwebSDK(chain, {
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY,
  })
}
