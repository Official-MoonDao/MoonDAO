import { createContext } from 'react'
import { arbitrum, sepolia, Chain } from 'thirdweb/chains'

const ChainContextV5 = createContext({
  selectedChain:
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia,
  setSelectedChain: (chain: Chain) => {},
})

export default ChainContextV5
