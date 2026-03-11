/**
 * NavLink - Navigation link that works around Next.js dev-mode client navigation issues.
 *
 * In development (localhost), uses a plain <a> tag for full page navigation.
 * This bypasses client-side routing which can fail when pages compile on-demand.
 *
 * In production, uses Next.js Link for fast client-side navigation.
 */
import Link from 'next/link'
import { ComponentProps } from 'react'

type NavLinkProps = ComponentProps<typeof Link> & {
  href: string
}

export function NavLink({ href, children, className, onClick, ...props }: NavLinkProps) {
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    return (
      <a href={href} className={className} onClick={onClick as any} {...(props as any)}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} prefetch={false} className={className} onClick={onClick} {...props}>
      {children}
    </Link>
  )
}
