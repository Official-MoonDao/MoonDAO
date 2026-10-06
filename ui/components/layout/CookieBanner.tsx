import { XMarkIcon } from '@heroicons/react/20/solid'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cookieBannerDecision, type CookieBannerDecision } from '@/lib/geo/countryCode'

type BannerStatus = 'pending' | 'granted' | 'denied' | 'prompt'

function readStoredConsent(): boolean | null {
  try {
    const stored = localStorage.getItem('cookie_consent')
    if (stored === null) return null
    const parsed = JSON.parse(stored)
    if (parsed === true || parsed === false) return parsed
  } catch {
    // Corrupt value. Resolve from geo instead of forcing the banner.
  }
  return null
}

function applyAnalyticsConsent(granted: boolean) {
  const value = granted ? 'granted' : 'denied'
  try {
    const w = window as Window & { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    if (typeof w.gtag !== 'function') {
      // Same queue the Google tag snippet drains once it loads.
      w.gtag = function gtag() {
        w.dataLayer?.push(arguments)
      }
    }
    w.gtag('consent', 'update', { analytics_storage: value })
  } catch {
    // The choice is already in localStorage and is applied on the next load.
  }
}

async function lookupDecision(isCancelled: () => boolean): Promise<CookieBannerDecision> {
  let decision: CookieBannerDecision = 'skip'
  for (let attempt = 0; attempt < 2; attempt++) {
    if (isCancelled()) return 'skip'
    try {
      const res = await fetch('/api/geo/country', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      if (isCancelled()) return 'skip'
      decision = cookieBannerDecision(data?.country)
      // A real country is final. Unknown can be a one-off header miss, so try once more.
      if (decision !== 'skip') return decision
    } catch {
      decision = 'skip'
    }
    if (attempt === 0 && !isCancelled()) {
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }
  return decision
}

export default function CookieBanner() {
  const [status, setStatus] = useState<BannerStatus>('pending')

  useEffect(() => {
    const stored = readStoredConsent()
    if (stored === true) {
      setStatus('granted')
      return
    }
    if (stored === false) {
      setStatus('denied')
      return
    }

    // US visitors (and US territories) skip the prompt and analytics is
    // granted. A confirmed other country still chooses. Unknown or failed
    // geo stays pending: hidden, not granted, retried on the next full load.
    // Treating "we could not tell" as "ask" was showing the banner to US
    // visitors whenever the country lookup missed.
    let cancelled = false
    ;(async () => {
      const decision = await lookupDecision(() => cancelled)
      if (cancelled) return
      if (decision === 'grant') setStatus('granted')
      else if (decision === 'prompt') setStatus('prompt')
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== 'granted' && status !== 'denied') return
    const granted = status === 'granted'
    try {
      localStorage.setItem('cookie_consent', JSON.stringify(granted))
    } catch {
      // Private mode can reject storage. The in-memory choice still applies.
    }
    applyAnalyticsConsent(granted)
  }, [status])

  if (status !== 'prompt') return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[999]">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-white sm:whitespace-nowrap">
        <p className="text-xs text-gray-300 leading-relaxed">
          {`We use cookies for analytics and personalization. `}
          <Link
            className="underline text-blue-400 hover:text-blue-300 transition-colors"
            href="/privacy-policy"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex items-center justify-center gap-2 w-full sm:w-auto sm:justify-start shrink-0">
          <button
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
            onClick={() => setStatus('denied')}
          >
            Decline
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all duration-200"
            onClick={() => setStatus('granted')}
          >
            Accept
          </button>
          <button
            className="text-gray-400 hover:text-white transition-colors p-0.5"
            onClick={() => setStatus('denied')}
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
