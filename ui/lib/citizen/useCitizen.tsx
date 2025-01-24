import { usePrivy, useWallets } from '@privy-io/react-auth'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import PrivyWalletContext from '../privy/privy-wallet-context'
import { getChainSlug } from '../thirdweb/chain'
import client from '../thirdweb/client'

export function useCitizen(
  selectedChain: any,
  citizenContract?: any,
  citizenAddress?: string
) {
  const chainSlug = getChainSlug(selectedChain)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const { user, authenticated } = usePrivy()
  const [citizenNFT, setCitizenNFT] = useState<any>()

  useEffect(() => {
    async function getCitizenNFTByAddress() {
      if (
        citizenNFT &&
        citizenNFT?.owner === wallets?.[selectedWallet]?.address
      )
        return

      if (!authenticated || !user) return setCitizenNFT(undefined)
      try {
        let contract
        if (citizenContract) {
          contract = citizenContract
        } else {
          contract = getContract({
            client,
            address: CITIZEN_ADDRESSES[chainSlug],
            chain: selectedChain,
            abi: CitizenABI as any,
          })
        }

        const selectedWalletAddress = wallets[selectedWallet].address

        const ownedTokenId: any = await readContract({
          contract: contract,
          method: 'getOwnedToken' as string,
          params: [citizenAddress || selectedWalletAddress],
        })

        const nft = await getNFT({
          contract: contract,
          tokenId: BigInt(ownedTokenId),
        })

        setCitizenNFT(nft)
      } catch (err: any) {
        if (err.reason === 'No token owned') setCitizenNFT(undefined)
      }
    }

    if (selectedChain) getCitizenNFTByAddress()
  }, [
    selectedChain,
    chainSlug,
    citizenContract,
    selectedWallet,
    user,
    wallets,
    authenticated,
    citizenAddress,
  ])

  return citizenNFT
}

export function useCitizens(selectedChain: any, citizenAddresses: string[]) {
  const chainSlug = getChainSlug(selectedChain)
  const [areCitizens, setAreCitizens] = useState<boolean[]>([])

  useEffect(() => {
    async function getAreCitizens() {
      try {
        const contract = getContract({
          client,
          address: CITIZEN_ADDRESSES[chainSlug],
          chain: selectedChain,
          abi: CitizenABI as any,
        })

        const areCitizens = await Promise.all(
          citizenAddresses.map(async (address) => {
            try {
              const ownedTokenId = await readContract({
                contract: contract,
                method: 'getOwnedToken' as string,
                params: [address],
              })
              return !!ownedTokenId
            } catch (error) {
              console.error(`Failed to fetch for address ${address}:`, error)
              return false // or handle it differently if needed
            }
          })
        )
        setAreCitizens(areCitizens)
      } catch (err: any) {
        console.error(err)
      }
    }

    if (selectedChain) getAreCitizens()
  }, [selectedChain, chainSlug, citizenAddresses])

  return areCitizens
}
