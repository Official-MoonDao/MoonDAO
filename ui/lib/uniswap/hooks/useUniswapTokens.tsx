import { Token } from '@uniswap/sdk-core'
import { nativeOnChain } from '@uniswap/smart-order-router';
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from 'const/config'
import {useMemo } from 'react'

export function useUniswapTokens(selectedChain: any) {

  const NATIVE = useMemo(() => {
    return nativeOnChain(selectedChain.chainId)
  }, [selectedChain])

  const MOONEY = useMemo(() => {
    return new Token(
      selectedChain.chainId,
      MOONEY_ADDRESSES[selectedChain.slug],
      18
    )
  }, [selectedChain])
  const DAI = useMemo(() => {
    return new Token(
      selectedChain.chainId,
      DAI_ADDRESSES[selectedChain.slug],
      18
    )
  }, [selectedChain])

  return { NATIVE,MOONEY, DAI }
}
