import { useEffect, useState } from 'react'
import { Chain, readContract } from 'thirdweb'
import { fetchFromIPFSWithFallback } from '@/lib/ipfs/gateway'

export function useHatData(selectedChain: any, hatsContract: any, hatId: any) {
  const [hatData, setHatData] = useState({
    name: '',
    description: '',
    supply: 0,
    active: null,
    prettyId: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function getHatAndMetadata() {
      if (!hatsContract || !hatId) return

      setIsLoading(true)
      setError(null)

      try {
        const hat: any = await readContract({
          contract: hatsContract,
          method: 'viewHat' as string,
          params: [hatId],
        })

        const { data: hatMetadataData } = await fetchFromIPFSWithFallback(
          hat?.details ?? hat[0]
        )

        const propsParam = encodeURIComponent(
          JSON.stringify({ prettyId: true })
        )
        const hatRes = await fetch(
          `/api/hats/get-hat?chainId=${selectedChain.id}&hatId=${hatId}&props=${propsParam}`
        )

        const hatSubgraphData = await hatRes.json()

        setHatData({
          name: hatMetadataData.name,
          description: hatMetadataData.description,
          supply: hat.supply,
          active: hat.active,
          prettyId: hatSubgraphData?.prettyId?.toString() as string,
        })
      } catch (err) {
        console.error('Error fetching hat data:', err)
        setError('Failed to load hat data')
      } finally {
        setIsLoading(false)
      }
    }

    getHatAndMetadata()
  }, [hatsContract, hatId, selectedChain?.id])

  return { hatData, isLoading, error }
}
