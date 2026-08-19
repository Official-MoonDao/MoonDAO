import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Link helper for docs pages.
 *
 * Docs are served at `/docs/*` by a rewrite onto `/documentation/[...slug]`
 * (a catch-all mounted directly at `/docs/*` fails the Vercel deploy — see
 * docs/DOCUMENTATION_EMBEDDING_VERIFICATION.md). The client router therefore has
 * no route matching `/docs/*`, so `next/link` cannot prefetch or soft-navigate
 * there: it would fetch a data route that 404s, then fall back to a full page
 * load. A plain anchor does the same navigation without the dead prefetch.
 *
 * Links to any other in-app route still use `next/link` and navigate client-side.
 */
export default function DocsLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string
  className?: string
  children: ReactNode
  onClick?: (e: React.MouseEvent) => void
}) {
  if (href.startsWith('/docs')) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  )
}

/** Where a docs URL should send the browser (used for programmatic navigation). */
export function navigateToDoc(href: string) {
  window.location.assign(href)
}
