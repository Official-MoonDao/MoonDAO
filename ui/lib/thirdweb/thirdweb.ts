import { Chain } from '@thirdweb-dev/chains'
import { ThirdwebSDK } from '@thirdweb-dev/sdk'

export function initSDK(chain: Chain) {
  return new ThirdwebSDK(chain)
}
