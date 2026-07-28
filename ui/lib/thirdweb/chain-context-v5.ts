import { createContext, Dispatch, SetStateAction } from 'react'
import { arbitrum, sepolia, Chain } from '@/lib/rpc/chains'

type ChainContextValue = {
  selectedChain: Chain
  setSelectedChain: Dispatch<SetStateAction<Chain>>
}

const ChainContextV5 = createContext<ChainContextValue>({
  selectedChain:
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia,
  setSelectedChain: () => {},
})

export default ChainContextV5
