import { MOONEYToken } from '../lib/config'
import { useBalance } from './use-wagmi'

export function useMOONEYBalance(address: any) {
  return useBalance({
    addressOrName: address,
    token: MOONEYToken,
    watch: true,
    enabled: address,
  })
}
