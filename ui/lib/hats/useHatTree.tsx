import { BigNumber } from 'ethers'
import { useEffect, useState } from 'react'

export function useHatTree(selectedChain: any, treeId: any, topHatId: any) {
  const [hats, setHats] = useState<any>()

  useEffect(() => {
    async function getHatTree() {
      try {
        if (!treeId) return []
        const res = await fetch('/api/hats/get-tree', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chainId: selectedChain.id,
            treeId,
            props: {
              hats: {
                props: {
                  wearers: {
                    props: {},
                  },
                },
              },
            },
          }),
        })

        const tree = await res.json()

        if (tree.hats) {
          const filteredHats = tree.hats.filter(
            (hat: any) => !BigNumber.from(hat.id).eq(BigNumber.from(topHatId))
          )
          setHats(filteredHats)
        } else {
          throw new Error('No hats found')
        }
      } catch (err) {
        console.log(err)
      }
    }
    if (selectedChain && treeId) getHatTree()
  }, [selectedChain, treeId, topHatId])

  return hats
}
