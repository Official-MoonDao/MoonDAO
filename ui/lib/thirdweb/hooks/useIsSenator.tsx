import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { usePrivy } from '@privy-io/react-auth'
import SenatorsABI from 'const/abis/Senators.json'
import { DEFAULT_CHAIN_V5, SENATORS_ADDRESSES } from 'const/config'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'

// Hook to check if the current user is a Senator
export const useIsSenator = () => {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const { authenticated } = usePrivy()
  const [isSenator, setIsSenator] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const senatorsContract = useContract({
    address: SENATORS_ADDRESSES[chainSlug],
    chain: chain,
    abi: SenatorsABI.abi as any,
  })

  useEffect(() => {
    async function checkSenator() {
      // Only check senator status if user is authenticated via Privy
      if (!authenticated || !account?.address || !senatorsContract) {
        setIsSenator(false)
        setIsLoading(false)
        return
      }

      try {
        const result = await readContract({
          contract: senatorsContract,
          method: 'isSenator' as string,
          params: [account.address],
        })
        setIsSenator(Boolean(result))
      } catch (error) {
        console.error('Error checking senator status:', error)
        setIsSenator(false)
      }
      setIsLoading(false)
    }

    checkSenator()
  }, [authenticated, account?.address, senatorsContract])

  return { isSenator, isLoading }
}
