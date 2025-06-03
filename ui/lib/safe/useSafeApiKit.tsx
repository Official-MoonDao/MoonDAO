import SafeApiKit from '@safe-global/api-kit'
import { useMemo } from 'react'
import { Chain } from 'thirdweb'

export default function useSafeApiKit(selectedChain: Chain): SafeApiKit {
  return useMemo(() => {
    return new SafeApiKit({
      chainId: BigInt(selectedChain.id),
    })
  }, [selectedChain])
}
