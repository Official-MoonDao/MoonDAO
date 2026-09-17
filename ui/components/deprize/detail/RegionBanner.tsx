import type { ReactNode } from 'react'
import { Notice } from './primitives'

export default function RegionBanner({
  restricted,
  bettingBlockedReason,
  children,
}: {
  restricted: boolean
  bettingBlockedReason?: string
  children: ReactNode
}) {
  return (
    <>
      {restricted && <Notice tone="amber">{children}</Notice>}
      {bettingBlockedReason && !bettingBlockedReason.startsWith('Loading') && (
        <Notice tone="amber">{bettingBlockedReason}</Notice>
      )}
    </>
  )
}
