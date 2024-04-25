import { Token } from '@uniswap/sdk-core'
import { nativeOnChain } from '@uniswap/smart-order-router'
import { useContext, useEffect, useMemo, useState } from 'react'
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from '../../const/config'
import ChainContext from '../thirdweb/chain-context'

export function useUniswapTokens(selectedChain: any) {
  const NATIVE_TOKEN = useMemo(() => {
    return nativeOnChain(selectedChain.chainId)
  }, [selectedChain.chainId])

  const MOONEY = useMemo(() => {
    return new Token(
      selectedChain.chainId,
      MOONEY_ADDRESSES[selectedChain.slug],
      18
    )
  }, [selectedChain.chainId])
  const DAI = useMemo(() => {
    return new Token(
      selectedChain.chainId,
      DAI_ADDRESSES[selectedChain.slug],
      18
    )
  }, [selectedChain.chainId])

  return { MOONEY, NATIVE_TOKEN, DAI }
}
