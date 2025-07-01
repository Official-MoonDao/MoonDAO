import { useEffect, useState } from 'react'

export function useSubHats(selectedChain: any, hatId: any) {
  const [subHats, setSubHats] = useState<any>()

  useEffect(() => {
    async function getSubHats() {
      if (!hatId || !selectedChain) return
      try {
        const res = await fetch('/api/hats/sub-hats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chainId: selectedChain?.id || selectedChain?.chainId,
            hatId: hatId.toString(),
          }),
        })
        const hats = await res.json()
        setSubHats(hats)
      } catch (err) {
        console.log(err)
      }
    }

    if (hatId && selectedChain) getSubHats()
  }, [selectedChain, hatId])

  return subHats
}
