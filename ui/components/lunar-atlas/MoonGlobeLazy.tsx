// Lazy, client-only mount of the R3F Moon globe. three.js/R3F cannot
// server-render, so MoonGlobe is dynamically imported with ssr:false and only
// mounted once its container scrolls into view. Once mounted it never unmounts
// (avoids tearing down the GL context), mirroring the app's LazyMoon pattern.

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { startTransition, useEffect, useRef, useState } from 'react'
import { TOUR_POSTER } from '@/lib/moonbase-tour/stops'
import useTourRenderMode from '@/components/moonbase/tour/useTourRenderMode'
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

function GlobePoster({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="relative h-full w-full">
      <Image src={TOUR_POSTER} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#03040a] via-[#03040a]/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-3 px-6 text-center">
        <p className="max-w-sm text-sm text-white/70">
          The 3D base is heavy on phones and battery. The races and competitors are all in the
          panels.
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:border-white/40 hover:bg-white/20"
        >
          Open 3D view
        </button>
      </div>
    </div>
  )
}

export default function MoonGlobeLazy({
  posterOnLowPower = false,
  ...props
}: MoonGlobeProps & {
  /** Phones, low-core machines and reduced motion get a still until asked. */
  posterOnLowPower?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasMounted, setHasMounted] = useState(false)
  // Headless CI / Playwright has no usable WebGL; ?noglobe=1 keeps the
  // fallback so the race panel and odds bridge can still be smoke-tested.
  const [skipGlobe, setSkipGlobe] = useState(false)
  const renderMode = useTourRenderMode()
  const [openedByUser, setOpenedByUser] = useState(false)
  const showPoster = posterOnLowPower && renderMode === 'still' && !openedByUser
  const awaitingMode = posterOnLowPower && renderMode === null

  useEffect(() => {
    try {
      setSkipGlobe(new URLSearchParams(window.location.search).has('noglobe'))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (hasMounted || skipGlobe || showPoster || awaitingMode) return
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    let mountTimer: ReturnType<typeof setTimeout> | undefined

    // Mount immediately if already visible; otherwise wait for intersection.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        // IntersectionObserver can fire synchronously from observe() inside
        // this effect — i.e. during React's hydration passive-effects flush.
        // Mounting a next/dynamic boundary in that same turn races dehydrated
        // Suspense siblings. Defer to a macrotask, then mark as a transition.
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
  }, [hasMounted, skipGlobe, showPoster, awaitingMode])

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Moon Base Zero, interactive 3D map of the lunar south pole base"
      className="h-full w-full bg-[#03040a]"
    >
      {hasMounted && !skipGlobe ? (
        <MoonGlobe {...props} />
      ) : showPoster && !skipGlobe ? (
        <GlobePoster onOpen={() => setOpenedByUser(true)} />
      ) : (
        <GlobeFallback />
      )}
    </div>
  )
}
