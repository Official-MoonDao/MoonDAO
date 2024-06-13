import { useResolvedMediaType } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import hatsSubgraphClient from './hatsSubgraphClient'

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

  async function getHatPrettyId() {
    const hat: any = await hatsSubgraphClient.getHat({
      chainId: selectedChain.chainId,
      hatId,
      props: {
        prettyId: true,
      },
    })
  }

  async function getHatData() {
    const { supply, active } = hat

    try {
      const metadataRes = await fetch(resolvedMetadata.url)
      const { data } = await metadataRes.json()

      const hatSubgraphData = await hatsSubgraphClient.getHat({
        chainId: selectedChain.chainId,
        hatId,
        props: {
          prettyId: true,
        },
      })

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
