import { SmartContract } from '@thirdweb-dev/sdk'
import { useHandleRead } from '../thirdweb/hooks'

export function useMOONEYBalance(
  tokenContract: SmartContract | undefined,
  address: any
) {
  return useHandleRead(tokenContract, 'balanceOf', [address])
}
