import { useContractWrite } from '@thirdweb-dev/react'
import { SmartContract } from '@thirdweb-dev/sdk'
import { useEffect, useState } from 'react'
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
    mutateAsync: async () => await mutateAsync({ args, overrides }),
    isLoading,
    error,
  }
}
