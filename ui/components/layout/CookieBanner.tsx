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

  return (
    <div
      className={`my-10 mx-auto max-w-max md:max-w-screen-sm fixed -bottom-5 left-0 right-0 z-[100] ${
        cookieConsent != null ? 'hidden' : 'flex'
      } px-4 md:px-6 py-4 justify-between items-center flex-col gap-4 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white`}
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
      }}
    >
      <div className="text-left">
        <p className="text-sm text-gray-300">
          {`We use cookies to enhance your experience. By clicking "Allow
            Cookies" you agree to the use of cookies for analytics,
            personalization, and marketing. Learn more in our `}
          <Link
            className="underline text-blue-400 hover:text-blue-300 transition-colors"
            href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div className="flex gap-3">
        <button
          className="px-5 py-2 rounded-lg bg-black/20 border border-white/10 text-white hover:bg-black/30 hover:border-white/20 transition-all duration-200 font-medium"
          onClick={() => setCookieConsent(false)}
        >
          Decline
        </button>
        <button
          className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
          onClick={() => setCookieConsent(true)}
        >
          Allow Cookies
        </button>
      </div>
    </div>
  )
}
