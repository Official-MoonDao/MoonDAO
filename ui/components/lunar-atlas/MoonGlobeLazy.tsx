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

    let cancelled = false
    let mountTimer: ReturnType<typeof setTimeout> | undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        // IntersectionObserver can fire synchronously from observe() inside
        // this effect — i.e. during React's hydration passive-effects flush.
        // Mounting a next/dynamic boundary in that same turn races dehydrated
        // Suspense siblings and throws. Defer to a macrotask, then mark the
        // update as a transition so React schedules it after hydration.
        mountTimer = setTimeout(() => {
          if (cancelled) return
          startTransition(() => setHasMounted(true))
        }, 0)
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
      if (mountTimer) clearTimeout(mountTimer)
    }
  }, [hasMounted])

  return (
    <div ref={containerRef} className="h-full w-full bg-[#03040a]">
      {hasMounted ? <MoonGlobe {...props} /> : <GlobeFallback />}
    </div>
  )
}
