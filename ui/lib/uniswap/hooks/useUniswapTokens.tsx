'use client';

import { Token } from '@uniswap/sdk-core'
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from 'const/config'
import {useMemo } from 'react'

if (typeof window !== "undefined") {
  // @ts-ignore
    window.Browser = {
      T: () => {
      }
    };
  }

export function useUniswapTokens(selectedChain: any) {

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

  return { MOONEY, DAI }
}
