import SafeApiKit from '@safe-global/api-kit'
import { useMemo } from 'react'
import { Chain } from 'thirdweb'

export default function useSafeApiKit(selectedChain: Chain): SafeApiKit {
  const chainId = selectedChain?.id
  return useMemo(() => {
    // api-kit builds some URLs with `new URL()`, so the base must be absolute.
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return new SafeApiKit({
      chainId: BigInt(chainId),
      txServiceUrl: `${origin}/api/safe/${chainId}`,
    })
  }, [chainId])
}
