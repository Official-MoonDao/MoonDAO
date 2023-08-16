import { useContractRead } from '@thirdweb-dev/react'
import { useHandleError } from './useHandleError'

export function useHandleRead(
  contract: any,
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
