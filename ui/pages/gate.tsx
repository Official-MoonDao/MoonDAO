import { LockClosedIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'
import { CK_NEWSLETTER_FORM_ID } from 'const/config'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { trackSignUp } from '@/lib/analytics/ga4'
import useSubscribe from '@/lib/convert-kit/useSubscribe'
import { GATE_NEXT_PARAM, safeNextPath } from '@/lib/gate/access'
import Container from '@/components/layout/Container'
import WebsiteHead from '@/components/layout/Head'
import { SignupHoneypot } from '@/components/newsletter/SignupHoneypot'

type Mode = 'signup' | 'password'

const INPUT_CLASS =
  'w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-blue-400/60'
const BUTTON_CLASS =
  'flex w-full transform items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:from-blue-600 hover:to-purple-700 enabled:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50'
// Occupies both rows of the panel grid and shares their tracks (see Gate).
const PANEL_CLASS = 'col-start-1 row-span-2 row-start-1 grid [grid-template-rows:subgrid]'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The form the middleware sends people to when they ask for a gated route
// without the cookie. It does two jobs: by default it collects early-access
// signups (Kit newsletter form + the "moonbase" tag), and a toggle swaps in the
// access-password form for people who already have one. The password form never
// sees the password it is checking against — it posts to /api/gate, which does
// the comparison on the server.
export default function Gate() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signup')

  const next = safeNextPath(
    typeof router.query[GATE_NEXT_PARAM] === 'string'
      ? (router.query[GATE_NEXT_PARAM] as string)
      : null
  )

  // Move focus to the active panel's input when the toggle is used. The
  // inactive panel stays mounted (see below), so autoFocus cannot do this.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    document.getElementById(mode === 'signup' ? 'gate-email' : 'gate-password')?.focus()
  }, [mode])

  return (
    <>
      {/* Links to /moonbase, /base and /deprize land here while they are
          gated, so this is the preview social sites show for all of them. */}
      <WebsiteHead
        title="Coming Soon"
        secondaryTitle="MoonDAO"
        description="Moon Base Zero is a true-to-scale lunar base, built race by race through DePrize. Request early access."
        image="/moonbase-og.png"
        imageWidth={1200}
        imageHeight={630}
      />
      <Container>
        <div className="relative min-h-screen bg-black">
          {/* Earthrise backdrop. On phones the square photo sits at the top with
            Earth visible above the card; on wider screens it covers the page,
            anchored to the bottom so Earth rises above the card and the card
            rests on the lunar horizon. */}
          <div aria-hidden="true" className="pointer-events-none fixed inset-0">
            <Image
              src="/assets/landing/earthrise.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-contain object-top md:object-cover md:object-bottom"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70" />
            <div className="absolute inset-x-0 top-[100vw] h-24 -translate-y-full bg-gradient-to-b from-transparent to-black md:hidden" />
          </div>

          <div className="relative z-10 flex min-h-screen justify-center px-4 pb-12 pt-[55vw] md:items-center md:py-12">
            <div className="mx-auto h-fit w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-blue-900/30 to-purple-900/30 text-white shadow-2xl backdrop-blur-xl">
              <div className="space-y-6 p-6">
                {/* Both panels sit in the same two grid rows (header, form) via
                  subgrid, so each row is as tall as the taller panel's version
                  of it: the card, the inputs, the buttons and the toggle below
                  stay put when switching, however the copy wraps. The hidden
                  panel is visibility:hidden, which also drops it from the tab
                  order and the accessibility tree. */}
                <div className="grid grid-rows-[auto_auto] gap-6">
                  <div
                    className={`${PANEL_CLASS} ${mode === 'signup' ? '' : 'invisible'}`}
                    aria-hidden={mode !== 'signup'}
                  >
                    <EarlyAccessForm />
                  </div>
                  <div
                    className={`${PANEL_CLASS} ${mode === 'password' ? '' : 'invisible'}`}
                    aria-hidden={mode !== 'password'}
                  >
                    <PasswordForm next={next} />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'signup' ? 'password' : 'signup')}
                    className="text-sm text-blue-300 underline-offset-4 hover:text-blue-200 hover:underline"
                  >
                    {mode === 'signup'
                      ? 'Have an access password? Enter password'
                      : 'No password? Sign up to learn more'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </>
  )
}

function GateHeader({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-500/20 to-purple-500/20">
        {icon}
      </div>
      <div>
        <h1 className="mb-2 font-heading text-2xl font-bold text-white">{title}</h1>
        <p className="text-sm leading-relaxed text-gray-300">{children}</p>
      </div>
    </div>
  )
}

function EarlyAccessForm() {
  const subscribe = useSubscribe(CK_NEWSLETTER_FORM_ID, 'moonbase')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const startedAt = useRef(Date.now())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL.test(trimmed)) {
      setError('Please enter a valid email.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await subscribe(trimmed, { company, formStartedAt: startedAt.current })
      if (!res.ok) {
        setError('Could not sign you up. Please try again.')
        setSubmitting(false)
        return
      }
      trackSignUp({ cta_location: 'moonbase_gate' })
      setDone(true)
    } catch {
      setError('Could not reach the server')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <GateHeader
        icon={<RocketLaunchIcon className="h-10 w-10 text-blue-300" />}
        title="You're on the list"
      >
        Check your inbox to confirm your email. We'll let you know as soon as it opens up.
      </GateHeader>
    )
  }

  return (
    <>
      <GateHeader
        icon={<RocketLaunchIcon className="h-10 w-10 text-blue-300" />}
        title="Want access?"
      >
        This part of the site is still being built. Drop your email and we'll let you know as soon
        as it opens.
      </GateHeader>

      <form onSubmit={submit} className="relative space-y-3" noValidate>
        <SignupHoneypot company={company} setCompany={setCompany} />
        <label htmlFor="gate-email" className="sr-only">
          Email address
        </label>
        <input
          id="gate-email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          aria-invalid={error ? true : undefined}
          className={INPUT_CLASS}
        />

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting || !email} className={BUTTON_CLASS}>
          <span>{submitting ? 'Requesting…' : 'Request access'}</span>
        </button>
      </form>
    </>
  )
}

function PasswordForm({ next }: { next: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message ?? 'Could not check that password')
        setSubmitting(false)
        return
      }
      // Full navigation rather than router.push: the cookie was just set, and
      // the middleware only sees it on a fresh request to the server. A
      // client-side transition would render the gated page without ever asking.
      window.location.assign(next)
    } catch {
      setError('Could not reach the server')
      setSubmitting(false)
    }
  }

  return (
    <>
      <GateHeader
        icon={<LockClosedIcon className="h-10 w-10 text-blue-300" />}
        title="Not open yet"
      >
        This part of the site is still being built. Enter the access password to have a look around.
      </GateHeader>

      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="gate-password" className="sr-only">
          Access password
        </label>
        <input
          id="gate-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Access password"
          className={INPUT_CLASS}
        />

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting || !password} className={BUTTON_CLASS}>
          <span>{submitting ? 'Checking…' : 'Enter'}</span>
        </button>
      </form>
    </>
  )
}
