import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'

export default function useHatNames(hatsContract: any, hatIds: string[]) {
  const [hatNames, setHatNames] = useState<any>()

  useEffect(() => {
    async function getAllHatNames() {
      // Resolve each hat independently so a single IPFS/RPC hiccup can't blank
      // out every role. A failed lookup returns `name: null`, letting callers
      // fall back to a deterministic label (e.g. via getRoleLabel) instead of
      // mislabeling everyone as a generic member.
      const names = await Promise.all(
        hatIds.map(async (hatId: string) => {
          try {
            const hat: any = await readContract({
              contract: hatsContract,
              method: 'viewHat' as string,
              params: [hatId],
            })
            const details = hat.details ?? hat[0]
            const detailsIpfsHash = details?.split('ipfs://')[1]
            if (!detailsIpfsHash) return { name: null, hatId }
            const hatDetailsRes = await fetch(
              `https://ipfs.io/ipfs/${detailsIpfsHash}`
            )
            const { data: hatDetails } = await hatDetailsRes.json()
            return { name: hatDetails?.name ?? null, hatId }
          } catch (err) {
            console.error(`Failed to fetch hat name for ${hatId}:`, err)
            return { name: null, hatId }
          }
        })
      )
      setHatNames(names)
    }
    if (hatIds.length > 0 && hatsContract) {
      getAllHatNames()
    }
  }, [hatsContract, hatIds])

  return hatNames
}
