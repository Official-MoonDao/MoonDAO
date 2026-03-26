import { XMarkIcon } from '@heroicons/react/20/solid'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function CookieBanner() {
  const [cookieConsent, setCookieConsent] = useState<any>(false)
  const [hasLoadedLocalStorage, setHasLoadedLocalStorage] = useState(false)

  useEffect(() => {
    const storedCookieConsent = localStorage.getItem('cookie_consent')

    if (storedCookieConsent !== null && storedCookieConsent !== undefined) {
      setCookieConsent(JSON.parse(storedCookieConsent))
    } else {
      setCookieConsent(null)
    }

    setHasLoadedLocalStorage(true)
  }, [setCookieConsent])

  useEffect(() => {
    if (cookieConsent != null && hasLoadedLocalStorage) {
      const newValue = cookieConsent ? 'granted' : 'denied'

      window.gtag('consent', 'update', { analytics_storage: newValue })

      localStorage.setItem('cookie_consent', JSON.stringify(cookieConsent))
    }
  }, [cookieConsent, hasLoadedLocalStorage])

  if (cookieConsent != null) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[999]">
      <div className="flex items-center gap-3 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-white whitespace-nowrap">
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
            onClick={() => setCookieConsent(false)}
          >
            Decline
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all duration-200"
            onClick={() => setCookieConsent(true)}
          >
            Accept
          </button>
          <button
            className="text-gray-400 hover:text-white transition-colors p-0.5"
            onClick={() => setCookieConsent(false)}
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
