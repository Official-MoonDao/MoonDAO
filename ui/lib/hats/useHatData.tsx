import { useResolvedMediaType } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'

export function useHatData(selectedChain: any, hatsContract: any, hatId: any) {
  const [hat, setHat] = useState<any>({})
  const [hatMetadataURI, setHatMetadataURI] = useState('')
  const resolvedMetadata = useResolvedMediaType(hatMetadataURI)
  const [hatData, setHatData] = useState({
    name: '',
    description: '',
    supply: 0,
    active: null,
    prettyId: '',
  })

  async function getHatAndMetadata() {
    const hat = await hatsContract.call('viewHat', [hatId])
    setHat(hat)
    setHatMetadataURI(hat.details)
  }

  async function getHatData() {
    const { supply, active } = hat

    try {
      const metadataRes = await fetch(resolvedMetadata.url)
      const { data } = await metadataRes.json()

      const res = await fetch('/api/hats/get-hat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chainId: selectedChain.id ?? selectedChain.chainId,
          hatId,
          props: {
            prettyId: true,
          },
        }),
      })

      const hatSubgraphData = await res.json()

      setHatData({
        name: data.name,
        description: data.description,
        supply: supply,
        active: active,
        prettyId: hatSubgraphData?.prettyId?.toString() as string,
      })
    } catch (err: any) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (hatsContract) {
      getHatAndMetadata()
      if (resolvedMetadata?.url) {
        getHatData()
      }
    }
  }, [hatsContract, resolvedMetadata.url, hatId])

  return hatData
}
