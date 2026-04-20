import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

// Client-side check that the user is an allow-listed operator (see
// `OPERATORS` in `const/config.ts`). Server-side gate is `isOperator`
// middleware on `/api/operator/check-eb`.
//
// We only watch the NextAuth session — that's the cookie the API route
// reads. Privy/Thirdweb wallet activation timing is irrelevant.
export function useIsExecutive() {
  const { data: session, status: sessionStatus } = useSession()

  const [isExecutive, setIsExecutive] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  const checkedKey = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (sessionStatus === 'loading') return
      if (sessionStatus !== 'authenticated') {
        setIsExecutive(false)
        setStatus('idle')
        setLastError(null)
        checkedKey.current = null
        return
      }

      const key = (session as any)?.accessToken?.slice(-12) || 'session'
      if (checkedKey.current === key) return
      checkedKey.current = key

      setStatus('loading')
      setLastError(null)
      try {
        const res = await fetch('/api/operator/check-eb', {
          credentials: 'include',
        })
        if (cancelled) return
        if (res.ok) {
          setIsExecutive(true)
          setStatus('success')
        } else {
          let body: any = null
          try {
            body = await res.json()
          } catch {}
          setIsExecutive(false)
          setStatus(res.status === 401 || res.status === 403 ? 'success' : 'error')
          setLastError(body?.error || `check-eb returned ${res.status}`)
        }
      } catch (err: any) {
        if (cancelled) return
        setIsExecutive(false)
        setStatus('error')
        setLastError(err?.message || 'check-eb fetch failed')
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [sessionStatus, session])

  return { isExecutive, status, lastError, session }
}
