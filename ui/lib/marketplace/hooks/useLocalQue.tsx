import { useEffect, useState } from 'react'
import { LocalQue } from '../marketplace-utils'

export function useLocalQue(address: string) {
  const [localQue, setLocalQue] = useState<LocalQue | undefined>(getLocalQue())

  function getLocalQue() {
    if (!address) return
    const storedQue = localStorage.getItem(`multicallQue-${address}`)
    if (storedQue) {
      return JSON.parse(storedQue) as LocalQue
    }
  }

  useEffect(() => {
    function storeLocalQue() {
      address &&
        localStorage.setItem(
          `multicallQue-${address}`,
          JSON.stringify(localQue)
        )
    }

    if (localQue) storeLocalQue()
  }, [address, localQue])

  useEffect(() => {
    if (address) setLocalQue(getLocalQue())
  }, [address, setLocalQue])

  return [localQue, setLocalQue]
}
