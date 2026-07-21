import { useEffect, useState } from 'react'

export function useLightMode() {
  // Always start as `false` on both server and client. Reading localStorage
  // during the first client effect used to flip `undefined` → boolean while
  // Layout's `dynamic(..., { ssr: false })` Suspense boundaries were still
  // hydrating, which triggers React 18's
  // "Suspense boundary received an update before it finished hydrating".
  // The app forces dark mode anyway; keep storage in sync after the fact.
  const [lightMode, setLightMode] = useState(false)

  useEffect(() => {
    localStorage.setItem('lightMode', lightMode.toString())
  }, [lightMode])

  return [lightMode, setLightMode] as const
}
