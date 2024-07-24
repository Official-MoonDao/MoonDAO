import { Token } from '@uniswap/sdk-core'
import { nativeOnChain } from '@uniswap/smart-order-router'
import { useContext, useMemo } from 'react'
import { DAI_ADDRESSES, MOONEY_ADDRESSES } from '../../const/config'
import ChainContext from '../thirdweb/chain-context'

export function useUniswapTokens() {
  const { selectedChain } = useContext(ChainContext)

  const NATIVE_TOKEN: any = nativeOnChain(selectedChain.chainId)
  const MOONEY = useMemo(() => {
    return new Token(
      selectedChain.chainId,
      MOONEY_ADDRESSES[selectedChain.slug],
      18,
      'MOONEY',
      'MOONEY'
    )
  }, [selectedChain])
  const DAI = useMemo(() => {
    return new Token(
      selectedChain.chainId,
      DAI_ADDRESSES[selectedChain.slug],
      18,
      'DAI',
      'DAI Stablecoin'
    )
  }, [selectedChain])

  return { MOONEY, NATIVE_TOKEN, DAI }
}
