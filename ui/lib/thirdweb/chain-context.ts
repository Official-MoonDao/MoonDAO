import { Chain, Ethereum, Goerli, Mumbai, Polygon } from '@thirdweb-dev/chains'
import { createContext } from 'react'

const ChainContext = createContext({
  selectedChain: process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai,
  setSelectedChain: (chain: Chain) => {},
})

export default ChainContext
