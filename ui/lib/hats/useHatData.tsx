import { useEffect, useState } from 'react'
import { Chain, readContract } from 'thirdweb'

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

        const hatMetadataRes = await fetch(
          `https://ipfs.io/ipfs/${
            hat?.details
              ? hat.details.split('ipfs://')[1]
              : hat[0].split('ipfs://')[1]
          }`
        )
        const { data: hatMetadataData } = await hatMetadataRes.json()

        const hatRes = await fetch('/api/hats/get-hat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chainId: selectedChain.id,
            hatId,
            props: {
              prettyId: true,
            },
          }),
        })

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
