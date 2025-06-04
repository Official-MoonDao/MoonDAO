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
      className={`my-10 mx-auto max-w-max md:max-w-screen-sm fixed bottom-0 left-0 right-0 z-[100] ${
        cookieConsent != null ? 'hidden' : 'flex'
      } px-3 md:px-4 py-3 justify-between items-center flex-col gap-4 bg-dark-cool rounded-lg shadow`}
    >
      <div className="text-left">
        <Link
          href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
          passHref
        >
          <p className="text-sm">
            {`We use cookies to enhance your experience. By clicking "Allow
            Cookies" you agree to the use of cookies for analytics,
            personalization, and marketing. Learn more in our `}
            <Link
              className="underline text-blue-500"
              href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </Link>
      </div>

      <div className="flex gap-2">
        <button
          className="px-5 py-2 rounded-md border-2 border-light-warm border-gradient-2"
          onClick={() => setCookieConsent(false)}
        >
          Decline
        </button>
        <button
          className="px-5 py-2 rounded-md gradient-2"
          onClick={() => setCookieConsent(true)}
        >
          Allow Cookies
        </button>
      </div>
    </div>
  )
}
