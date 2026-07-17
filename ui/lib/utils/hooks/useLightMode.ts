import { startTransition, useEffect, useState } from 'react'

export function useLightMode() {
  const [lightMode, setLightMode] = useState<any>(undefined)

  useEffect(() => {
    if (lightMode === undefined) {
      // startTransition: Layout mounts several dynamic(ssr:false) Suspense
      // boundaries; a sync setState here trips React's hydration race.
      startTransition(() => {
        setLightMode(localStorage.getItem('lightMode') === 'true')
      })
    } else {
      localStorage.setItem('lightMode', lightMode.toString())
    }
  }, [lightMode])

  return [lightMode, setLightMode]
}
