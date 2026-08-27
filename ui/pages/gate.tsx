import { LockClosedIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { GATE_NEXT_PARAM, safeNextPath } from '@/lib/gate/access'
import Container from '@/components/layout/Container'

// The form the middleware sends people to when they ask for a gated route
// without the cookie. It never sees the password it is checking against — it
// posts to /api/gate, which does the comparison on the server.
export default function Gate() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const next = safeNextPath(
    typeof router.query[GATE_NEXT_PARAM] === 'string'
      ? (router.query[GATE_NEXT_PARAM] as string)
      : null
  )

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
    <Container>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 text-white shadow-2xl backdrop-blur-xl">
          <div className="space-y-6 p-6">
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-500/20 to-purple-500/20">
                <LockClosedIcon className="h-10 w-10 text-blue-300" />
              </div>
              <div>
                <h1 className="mb-2 font-GoodTimes text-2xl font-bold text-white">Not open yet</h1>
                <p className="text-sm leading-relaxed text-gray-300">
                  This part of the site is still being built. Enter the access password to have a
                  look around.
                </p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <label htmlFor="gate-password" className="sr-only">
                Access password
              </label>
              <input
                id="gate-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Access password"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-blue-400/60"
              />

              {error && (
                <p role="alert" className="text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !password}
                className="flex w-full transform items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:from-blue-600 hover:to-purple-700 enabled:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{submitting ? 'Checking…' : 'Enter'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </Container>
  )
}
