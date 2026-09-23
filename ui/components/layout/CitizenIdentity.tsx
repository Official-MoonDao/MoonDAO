import Image from 'next/image'
import Link from 'next/link'
import type { CitizenRow } from '@/lib/citizen/citizenLookup'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { useENS } from '@/lib/utils/hooks/useENS'

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function CitizenIdentity({
  address,
  citizen,
  fallbackName,
}: {
  address: string
  citizen?: CitizenRow
  fallbackName?: string
}) {
  const { data: ens } = useENS(address, !citizen)
  const name = citizen?.name || ens?.name || fallbackName || shortAddress(address)
  const href = citizen
    ? `/citizen/${generatePrettyLinkWithId(citizen.name, String(citizen.id))}`
    : undefined
  const avatar = citizen?.image ? getIPFSGateway(citizen.image) : undefined
  const initial = (name || '?').slice(0, 1).toUpperCase()

  const inner = (
    <span className="flex items-center gap-2 min-w-0">
      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            width={28}
            height={28}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] font-medium text-white/60">
            {initial}
          </span>
        )}
      </span>
      <span className="truncate text-sm text-gray-200">{name}</span>
    </span>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="min-w-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded"
      >
        {inner}
      </Link>
    )
  }
  return inner
}
