import { useWallets } from '@privy-io/react-auth'
import { Chain } from '@thirdweb-dev/chains'
import { NFT, useAddress, useSDK } from '@thirdweb-dev/react'
import { CITIZEN_ADDRESSES } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'

export default function useCitizen(
  selectedChain: Chain,
  citizenContract?: any
) {
  const sdk = useSDK()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [citizenNFT, setCitizenNFT] = useState<NFT>()

  useEffect(() => {
    async function getCitizenNFTByAddress() {
      try {
        let contract
        if (citizenContract) {
          contract = citizenContract
        } else {
          contract = await sdk?.getContract(
            CITIZEN_ADDRESSES[selectedChain.slug]
          )
        }

        const citizenAddress = wallets[selectedWallet].address

        const ownedTokenId = await contract?.call('getOwnedToken', [
          citizenAddress,
        ])

        const nft = await contract?.erc721.get(ownedTokenId)

        setCitizenNFT(nft)
      } catch (err: any) {
        if (err.reason === 'No token owned') setCitizenNFT(undefined)
      }
    }

    if (sdk && selectedChain) getCitizenNFTByAddress()
  }, [sdk, selectedChain, citizenContract, selectedWallet, wallets])

  return citizenNFT
}
