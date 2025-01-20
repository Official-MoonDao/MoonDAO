import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'

export default function useHatNames(hatsContract: any, hatIds: string[]) {
  const [hatNames, setHatNames] = useState<any>()

  useEffect(() => {
    async function getAllHatNames() {
      try {
        const hatNamesPromises = hatIds.map(async (hatId: string) => {
          const hat: any = await readContract({
            contract: hatsContract,
            method: 'viewHat' as string,
            params: [hatId],
          })
          const detailsIpfsHash = hat.details
            ? hat.details.split('ipfs://')[1]
            : hat[0].split('ipfs://')[1]
          const hatDetailsRes = await fetch(
            `https://ipfs.io/ipfs/${detailsIpfsHash}`
          )
          const { data: hatDetails } = await hatDetailsRes.json()
          return { name: hatDetails.name, hatId }
        })

        const names = await Promise.all(hatNamesPromises)
        setHatNames(names)
      } catch (err) {
        console.error('Failed to fetch hat names:', err)
      }
    }
    if (hatIds.length > 0 && hatsContract) {
      getAllHatNames()
    }
  }, [hatsContract, hatIds])

  return hatNames
}
