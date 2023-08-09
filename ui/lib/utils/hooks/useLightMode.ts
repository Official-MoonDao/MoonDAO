import { useEffect, useState } from 'react'

export function useLightMode() {
  const [lightMode, setLightMode] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (lightMode === undefined) {
      setLightMode(localStorage.getItem('lightMode') === 'true')
    } else {
      localStorage.setItem('lightMode', lightMode.toString())
    }
  }, [lightMode])

  return [lightMode, setLightMode]
}
