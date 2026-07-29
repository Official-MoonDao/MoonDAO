import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

// The public production hosts. Some features are merged to main but not meant to
// be visible here yet; everywhere else we develop them (local dev, Vercel
// preview deploys off any branch — including main — and staging).
//
// We key off the HOST rather than NEXT_PUBLIC_CHAIN / NEXT_PUBLIC_ENV on
// purpose: a developer's local env is pulled straight from production with
// `vercel env pull`, so locally those report the exact same mainnet/prod values
// the live site does. The hostname is the only thing that actually separates
// "the public site" from "somewhere we're still building."
const PRODUCTION_HOSTS = new Set(['moondao.com', 'www.moondao.com'])

// Routes that exist in main but aren't public yet. `router.pathname` is the
// matched route pattern, so a dynamic child appears here in its bracket form.
const UNRELEASED_PATHS = ['/moonbase', '/moonbase/[projectId]']

// Bare hostname, no port, lower-cased. Accepts either a `Host` header value or
// a `window.location.host`.
function bareHost(host?: string | null): string {
  return (host ?? '').split(':')[0].toLowerCase()
}

// Is this host the public production site (where unreleased features hide)?
export function isPublicProductionHost(host?: string | null): boolean {
  return PRODUCTION_HOSTS.has(bareHost(host))
}

// Should a given route be hidden on a given host? Used by both the server gate
// (getServerSideProps, off the `Host` header) and the client redirect below.
export function isUnreleasedOnHost(
  pathname: string,
  host?: string | null
): boolean {
  return isPublicProductionHost(host) && UNRELEASED_PATHS.includes(pathname)
}

// Backstop to the per-page server gate: if an unreleased route is somehow
// reached on a production host (e.g. a client-side navigation that outran its
// data fetch), bounce it to /coming-soon.
export function FlagProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    if (isUnreleasedOnHost(router.pathname, window.location.host)) {
      router.replace({
        pathname: '/coming-soon',
        query: { from: router.pathname.replace('/', '') },
      })
    }
  }, [router.pathname])

  return children
}

// Client hook for hiding UI (nav entries, buttons) that points at unreleased
// routes. Starts `false` so the server render and the first client render agree
// — no hydration mismatch — then settles to the real answer after mount. The
// routes themselves are gated server-side regardless, so the brief pre-mount
// visibility of a link on the production site is harmless: following it just
// lands on /coming-soon.
export function useHiddenOnProduction(): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    setHidden(isPublicProductionHost(window.location.host))
  }, [])
  return hidden
}
