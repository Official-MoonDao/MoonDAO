import { useContractRead } from '@thirdweb-dev/react'
import { SmartContract } from '@thirdweb-dev/sdk'
import { useHandleError } from './useHandleError'

export function useHandleRead(
  contract: SmartContract | undefined,
  method: string,
  args?: any[],
  overrides?: any
) {
  const { data, isLoading, error } = useContractRead(
    contract,
    method,
    args,
    overrides
  )
  useHandleError(method, error)
  return { data, isLoading, error }
}
