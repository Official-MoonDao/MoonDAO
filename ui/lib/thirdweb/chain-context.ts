import { Chain, Ethereum, Goerli } from '@thirdweb-dev/chains'
import { createContext } from 'react'

const ChainContext = createContext({
  selectedChain:
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Ethereum : Goerli,
  setSelectedChain: (chain: Chain) => {},
})

export default ChainContext
