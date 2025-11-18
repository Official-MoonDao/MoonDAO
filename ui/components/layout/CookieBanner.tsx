import Link from 'next/link'
import { useEffect, useState } from 'react'
import Modal from './Modal'

export default function CookieBanner() {
  const [cookieConsent, setCookieConsent] = useState<any>(null)
  const [hasLoadedLocalStorage, setHasLoadedLocalStorage] = useState(false)

  useEffect(() => {
    const storedCookieConsent = localStorage.getItem('cookie_consent')

    if (storedCookieConsent !== null && storedCookieConsent !== undefined) {
      setCookieConsent(JSON.parse(storedCookieConsent))
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

  if (cookieConsent != null || !hasLoadedLocalStorage) return null

  return (
    <Modal
      id="cookie-banner"
      setEnabled={() => {}}
      className={`mx-auto max-w-max md:max-w-screen-sm fixed -bottom-0 md:bottom-8 left-0 right-0 px-4 md:px-6 py-4 justify-between items-center flex-col bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white z-[10000]`}
    >
      <div className="">
        <p className="text-sm text-gray-300">
          {`We use cookies to enhance your experience. By clicking "Allow
            Cookies" you agree to the use of cookies for analytics,
            personalization, and marketing. Learn more in our `}
          <Link
            className="underline text-blue-400 hover:text-blue-300 transition-colors"
            href="/privacy-policy"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div className="mt-2 flex gap-3 items-center justify-center">
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
    </Modal>
  )
}
