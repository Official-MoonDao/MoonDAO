//Takes an array of wearers and returns a unique array of wearers with their hatIds
import { useEffect, useState } from 'react'

type Wearer = {
  address: string
  hatIds: string[]
}

export default function useUniqueHatWearers(hats: any) {
  const [uniqueWearers, setUniqueWearers] = useState<any>()

  useEffect(() => {
    async function hatsToUniqueWearers() {
      const uniqueWearers: Wearer[] = []
      hats?.forEach((hat: any) => {
        hat.wearers.forEach((w: any) => {
          const existingWearer = uniqueWearers.find((u) => u.address === w.id)
          if (existingWearer) {
            existingWearer.hatIds.push(hat.id)
          } else {
            uniqueWearers.push({
              address: w.id,
              hatIds: [hat.id],
            })
          }
        })
      })
      setUniqueWearers(uniqueWearers)
    }

    if (hats) {
      hatsToUniqueWearers()
    }
  }, [hats])

  return uniqueWearers
}
