import Link from 'next/link'
import type { ReactNode } from 'react'
import type { UpdateMeta } from '@/lib/updates/types'

/**
 * Opens an entry: on-site at `/updates/<slug>`, or at `externalUrl` for one
 * that lives elsewhere. Cards use this so every kind sits in one list.
 */
export default function UpdateEntryLink({
  update,
  className,
  children,
}: {
  update: Pick<UpdateMeta, 'slug' | 'externalUrl'>
  className?: string
  children: ReactNode
}) {
  if (update.externalUrl) {
    return (
      <a href={update.externalUrl} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link href={`/updates/${update.slug}`} className={className}>
      {children}
    </Link>
  )
}
