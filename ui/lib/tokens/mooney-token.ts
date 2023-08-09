import { SmartContract } from '@thirdweb-dev/sdk'
import { useHandleRead } from '../thirdweb/hooks'

export function useMOONEYBalance(
  tokenContract: SmartContract | undefined,
  address: string | undefined
) {
  return useHandleRead(tokenContract, 'balanceOf', [address])
}
