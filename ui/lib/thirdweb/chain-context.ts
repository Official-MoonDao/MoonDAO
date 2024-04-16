import { Chain, Polygon, Sepolia } from '@thirdweb-dev/chains'
import { createContext } from 'react'

const ChainContext = createContext({
  selectedChain:
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Sepolia,
  setSelectedChain: (chain: Chain) => {},
})

export default ChainContext
