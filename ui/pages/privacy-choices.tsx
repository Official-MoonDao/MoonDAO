import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readAdOptOut, readGlobalPrivacyControl, setAdOptOut } from '@/lib/analytics/metaPixel'
import Container from '@/components/layout/Container'
import Head from '@/components/layout/Head'

/**
 * "Do Not Sell or Share My Personal Information". Opting out stops the Meta
 * Pixel on this browser. A Global Privacy Control signal is honored the same
 * way without any action here.
 */
export default function PrivacyChoices() {
  const [ready, setReady] = useState(false)
  const [optedOut, setOptedOut] = useState(false)
  const [gpc, setGpc] = useState(false)

  useEffect(() => {
    setOptedOut(readAdOptOut())
    setGpc(readGlobalPrivacyControl())
    setReady(true)
  }, [])

  const toggle = () => {
    const next = !optedOut
    setAdOptOut(next)
    setOptedOut(next)
  }

  const sharingOff = optedOut || gpc

  return (
    <Container>
      <Head
        title="Your Privacy Choices | MoonDAO"
        description="Opt out of the sale or sharing of your personal information for advertising."
      />
      <div className="mx-auto max-w-2xl py-16 text-white">
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          Do Not Sell or Share My Personal Information
        </h1>
        <p className="mt-6 leading-relaxed text-white/80">
          MoonDAO does not sell personal information for money. On our membership pages we use the
          Meta Pixel to measure and improve our own ads on Facebook and Instagram. Some US state
          laws, including California&apos;s, treat that as &ldquo;sharing&rdquo; personal
          information for cross-context behavioral advertising. You can opt out here.
        </p>
        <p className="mt-4 leading-relaxed text-white/80">
          Your choice is saved in this browser. If you use another browser or device, or clear your
          site data, opt out there too. If your browser sends a{' '}
          <a
            className="underline"
            href="https://globalprivacycontrol.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Global Privacy Control
          </a>{' '}
          signal, we treat it as an opt-out automatically.
        </p>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="font-semibold" aria-live="polite">
            {!ready
              ? 'Checking your settings...'
              : sharingOff
              ? 'Sharing for advertising is off in this browser.'
              : 'Sharing for advertising is on in this browser.'}
          </p>
          {ready && gpc && (
            <p className="mt-2 text-sm text-white/70">
              Your browser is sending a Global Privacy Control signal, so sharing stays off.
            </p>
          )}
          {ready && !gpc && (
            <button
              type="button"
              onClick={toggle}
              className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90"
            >
              {optedOut ? 'Allow sharing for advertising' : 'Opt out of sharing'}
            </button>
          )}
        </div>

        <p className="mt-8 text-sm text-white/60">
          You can also email{' '}
          <a className="underline" href="mailto:info@moondao.com">
            info@moondao.com
          </a>
          . Read the full{' '}
          <Link className="underline" href="/privacy-policy">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </Container>
  )
}
