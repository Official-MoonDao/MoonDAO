import { useResolvedMediaType } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'

export function useHatData(hatsContract: any, hatId: string) {
  const [hat, setHat] = useState<any>({})
  const [hatMetadataURI, setHatMetadataURI] = useState('')
  const resolvedMetadata = useResolvedMediaType(hatMetadataURI)
  const [hatData, setHatData] = useState({
    name: 'Undefined',
    description: '',
    supply: 0,
    active: null,
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
      setHatData({
        name: data.name,
        description: data.description,
        supply: supply,
        active: active,
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
