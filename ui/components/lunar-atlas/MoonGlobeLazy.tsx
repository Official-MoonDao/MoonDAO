// Lazy, client-only mount of the R3F Moon globe. three.js/R3F cannot
// server-render, so MoonGlobe is dynamically imported with ssr:false and only
// mounted once its container scrolls into view. Once mounted it never unmounts
// (avoids tearing down the GL context), mirroring the app's LazyMoon pattern.

import dynamic from 'next/dynamic'
import { startTransition, useEffect, useRef, useState } from 'react'
import type { MoonGlobeProps } from './MoonGlobe'

const MoonGlobe = dynamic(() => import('./MoonGlobe'), {
  ssr: false,
  loading: () => <GlobeFallback />,
})

function GlobeFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#03040a]">
      <div className="flex flex-col items-center gap-3 text-white/50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        <span className="text-sm">Rendering the Moon…</span>
      </div>
    </div>
  )
}

export default function MoonGlobeLazy(props: MoonGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    if (hasMounted) return
    const el = containerRef.current
    if (!el) return

    // Mount immediately if already visible; otherwise wait for intersection.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          // Mounting swaps content inside next/dynamic's lazy boundary; if it
          // lands while the page is still hydrating, React 18 throws
          // "Suspense boundary received an update before it finished
          // hydrating". Marking it as a transition lets React schedule it
          // after hydration instead.
          startTransition(() => setHasMounted(true))
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMounted])

  return (
    <div ref={containerRef} className="h-full w-full bg-[#03040a]">
      {hasMounted ? <MoonGlobe {...props} /> : <GlobeFallback />}
    </div>
  )
}
