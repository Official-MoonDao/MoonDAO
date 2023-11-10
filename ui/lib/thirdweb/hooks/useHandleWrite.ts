import { useContractWrite } from '@thirdweb-dev/react'
import { useHandleError } from './useHandleError'

export function useHandleWrite(
  contract: any,
  method: string,
  args?: any[],
  overrides?: any
) {
  const { mutateAsync, isLoading, error } = useContractWrite(contract, method)

  useHandleError(method, error)

  return {
    mutateAsync: async () => {
      try {
        await mutateAsync({ args, overrides })
      } catch (err: any) {
        console.log(err.message)
      }
    },
    isLoading,
    error,
  }
}
