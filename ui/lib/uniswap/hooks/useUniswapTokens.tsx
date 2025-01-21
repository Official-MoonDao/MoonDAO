import { Token } from '@uniswap/sdk-core'
import { nativeOnChain } from '@uniswap/smart-order-router'
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from 'const/config'
import { useMemo } from 'react'
import { getChainSlug } from '@/lib/thirdweb/chain'

export function useUniswapTokens(selectedChain: any) {
  const chainSlug = getChainSlug(selectedChain)

  const NATIVE = useMemo(() => {
    return nativeOnChain(selectedChain.id)
  }, [selectedChain])

  const MOONEY = useMemo(() => {
    return new Token(selectedChain.id, MOONEY_ADDRESSES[chainSlug], 18)
  }, [selectedChain, chainSlug])
  const DAI = useMemo(() => {
    return new Token(selectedChain.id, DAI_ADDRESSES[chainSlug], 18)
  }, [selectedChain, chainSlug])

  return { NATIVE, MOONEY, DAI }
}
