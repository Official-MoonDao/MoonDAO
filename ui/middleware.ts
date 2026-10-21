import { NextResponse, type NextRequest } from 'next/server'
import {
  LEGACY_DOCS_HOST,
  legacyDocsHostDestination,
  removedDocRedirectForPathname,
} from '@/lib/docs/slug'
import {
  GATE_COOKIE,
  GATE_NEXT_PARAM,
  GATE_PATH,
  isGatedPath,
  isSessionValid,
} from '@/lib/gate/access'

// Guards the routes that ship in the repo but are not ready to be public. See
// lib/gate/access.ts for why the check has to happen here on the server rather
// than in the page: a gate the browser evaluates is a gate whose password is in
// the bundle.
//
// Also 308s removed docs (Press kit/coverage, tags/press, tags/media) to
// /press. Those paths are not prerendered — returning `redirect` from
// getStaticProps fails `next build` — and a next.config.js redirect under
// /docs/* breaks the Vercel deploy. Keep the Press matchers in step with
// REMOVED_DOC_REDIRECTS; the docs pipeline test reads them back out of this
// file.
//
// The catch-all is what makes `docs.moondao.com/<quartz slug>` redirect.
// That host used to be the documentation repo; it now serves this app, so
// `/Reference/Nested-Docs/About-Pablo-Moncada` 404s unless we prefix `/docs`.
// A next.config.js redirect was the wrong place for that map: a source under
// `/docs/*` is what breaks the Vercel deploy, and the two renamed slugs
// contain parentheses and a non-ASCII apostrophe. The catch-all excludes API
// routes and Next internals. Every other host falls through.
//
// Static literal — Next reads this at build time, so it cannot import from
// lib/gate/access.ts. Keep the gate strings identical to
// GATED_MIDDLEWARE_MATCHERS in that file; the access-gate unit test pins the
// pairing.
export const config = {
  matcher: [
    '/moonbase',
    '/moonbase/:path*',
    '/deprize',
    '/deprize/:path*',
    '/deprize-play',
    '/docs/Press',
    '/docs/Press/:path*',
    '/docs/tags/press',
    '/docs/tags/media',
    '/documentation/Press',
    '/documentation/Press/:path*',
    '/documentation/tags/press',
    '/documentation/tags/media',
    // Root is separate: with next-translate's i18n config Next rewrites `/` to
    // `/en` before matching, and a catch-all does not cover that.
    '/',
    // Skip API routes, Next internals, and static files. `@name.get` stays
    // matched — its extension is not in this list. Next prepends the default
    // locale before testing this pattern, so the exclusion is on the public path.
    '/((?!api(?:/|$)|_next(?:/|$)|favicon\\.ico)(?!.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|map|txt|xml|woff2?|ttf|json|webmanifest)$).*)',
  ],
}

function requestHost(req: NextRequest): string {
  // Host, not x-forwarded-host: the latter can be set by the caller and would
  // redirect ordinary moondao.com traffic if it were trusted first.
  const raw = req.headers.get('host') || req.nextUrl.hostname || ''
  return raw.split(',')[0].trim().split(':')[0].toLowerCase()
}

export function middleware(req: NextRequest) {
  if (requestHost(req) === LEGACY_DOCS_HOST) {
    const destination = legacyDocsHostDestination(req.nextUrl.pathname, req.nextUrl.search)
    return NextResponse.redirect(destination, 308)
  }

  const { pathname } = req.nextUrl
  const removed = removedDocRedirectForPathname(pathname)
  if (removed) {
    const url = req.nextUrl.clone()
    url.pathname = removed
    return NextResponse.redirect(url, 308)
  }
  if (!isGatedPath(pathname)) return NextResponse.next()

  const granted = isSessionValid(
    req.cookies.get(GATE_COOKIE)?.value,
    process.env.MOONBASE_GATE_TOKEN
  )
  if (granted) {
    // Cursor's browser sends HEAD and waits on it before it will leave the
    // loading state. In dev that HEAD enters the page compiler and never
    // returns while the GET for the same URL is still compiling.
    if (req.method === 'HEAD' && process.env.NODE_ENV === 'development') {
      return new NextResponse(null, { status: 200 })
    }
    return NextResponse.next()
  }

  // Redirect rather than rewrite. A rewrite would leave the address bar showing
  // /moonbase while the gate renders, which reads as the real page failing to
  // load, and it confuses the client-side router on the way back out.
  const gate = req.nextUrl.clone()
  gate.pathname = GATE_PATH
  gate.search = ''
  gate.searchParams.set(GATE_NEXT_PARAM, pathname + req.nextUrl.search)
  return NextResponse.redirect(gate)
}
