import { usePrivy } from '@privy-io/react-auth'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '../thirdweb/chain'
import client from '../thirdweb/client'

export function useCitizen(
  selectedChain: any,
  citizenContract?: any,
  citizenAddress?: string,
  skipFetch: boolean = false
) {
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address
  const { user, authenticated } = usePrivy()
  const [citizenNFT, setCitizenNFT] = useState<any>()

  useEffect(() => {
    // Check skipFetch FIRST, before changing any state
    if (skipFetch) {
      console.log('Skipping citizen fetch - cache not checked yet')
      return
    }

    async function getCitizenNFTByAddress() {
      setCitizenNFT(undefined)
      if (!authenticated || !user) return

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

        const ownedTokenId: any = await readContract({
          contract: contract,
          method: 'getOwnedToken' as string,
          params: [citizenAddress || address],
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
    address,
    user,
    authenticated,
    citizenAddress,
    skipFetch,
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
