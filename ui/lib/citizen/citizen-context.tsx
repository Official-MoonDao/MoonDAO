import { NFT } from '@thirdweb-dev/sdk'
import { createContext } from 'react'

const CitizenContext = createContext<{
  citizen: NFT | undefined
  setCitizen: (citizen: NFT | undefined) => void
}>({
  citizen: undefined,
  setCitizen: (citizen: NFT | undefined) => {},
})

export default CitizenContext
