import { useEffect, useState } from 'react'
import hatsSubgraphClient from './hatsSubgraphClient'

export function useSubHats(selectedChain: any, hatId: any) {
  const [subHats, setSubHats] = useState<any>()

  async function getSubHats() {
    try {
      const hat = await hatsSubgraphClient.getHat({
        chainId: selectedChain.chainId,
        hatId,
        props: {
          subHats: {
            props: {
              details: true,
              wearers: {
                props: {},
              },
              subHats: {
                props: {
                  details: true,
                  wearers: {
                    props: {},
                  },
                },
              },
            },
          },
        },
      })

      const subHatsLevel1: any = hat?.subHats
      const subHatsLevel2: any = subHatsLevel1
        ?.map((hat: any) => hat.subHats)
        .flat()
      //check lenght of each subHats array and only add the ones that have hats

      const subHats = subHatsLevel1.concat(subHatsLevel2)

      setSubHats(subHats)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    if (hatId) getSubHats()
  }, [selectedChain, hatId])

  return subHats
}
