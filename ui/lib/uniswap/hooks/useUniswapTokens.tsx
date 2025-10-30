import { Token } from '@uniswap/sdk-core'
// @ts-ignore
import { nativeOnChain } from '@uniswap/smart-order-router'
import { DAI_ADDRESSES, MOONEY_ADDRESSES, USDT_ADDRESSES } from 'const/config'
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

  const USDT = useMemo(() => {
    return new Token(selectedChain.id, USDT_ADDRESSES[chainSlug], 6)
  }, [selectedChain, chainSlug])

  return { NATIVE, MOONEY, DAI, USDT }
}
