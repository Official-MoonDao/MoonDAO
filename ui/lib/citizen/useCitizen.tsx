import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Chain } from '@thirdweb-dev/chains'
import { NFT, useSDK } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'

export function useCitizen(
  selectedChain: Chain,
  citizenContract?: any,
  citizenAddress?: string
) {
  const sdk = useSDK()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const { authenticated } = usePrivy()
  const [citizenNFT, setCitizenNFT] = useState<NFT>()

  useEffect(() => {
    async function getCitizenNFTByAddress() {
      if (!authenticated) return setCitizenNFT(undefined)

      try {
        let contract
        if (citizenContract) {
          contract = citizenContract
        } else {
          contract = await sdk?.getContract(
            CITIZEN_ADDRESSES[selectedChain.slug]
          )
        }

        const selectedWalletAddress = wallets[selectedWallet].address

        const ownedTokenId = await contract?.call('getOwnedToken', [
          citizenAddress || selectedWalletAddress,
        ])

        const nft = await contract?.erc721.get(ownedTokenId)

        setCitizenNFT(nft)
      } catch (err: any) {
        if (err.reason === 'No token owned') setCitizenNFT(undefined)
      }
    }

    if (sdk && selectedChain) getCitizenNFTByAddress()
  }, [
    sdk,
    selectedChain,
    citizenContract,
    selectedWallet,
    wallets,
    authenticated,
    citizenAddress,
  ])

  return citizenNFT
}

export function useCitizens(
  selectedChain: Chain,
  citizenContract?: any,
  citizenAddresses?: string[]
) {
  return citizenAddresses.map((address) => {
    return useCitizen(selectedChain, citizenContract, address)
  })
}
