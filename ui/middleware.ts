import { NextResponse, type NextRequest } from 'next/server'
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
// Static literal — Next reads this at build time, so it cannot import from
// lib/gate/access.ts. Keep these strings identical to GATED_MIDDLEWARE_MATCHERS
// in that file; the access-gate unit test pins the pairing.
export const config = {
  matcher: [
    '/moonbase',
    '/moonbase/:path*',
    '/deprize',
    '/deprize/:path*',
    '/deprize-play',
  ],
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
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
