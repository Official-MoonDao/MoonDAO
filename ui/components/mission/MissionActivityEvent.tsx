import {
  CurrencyDollarIcon,
  PlusIcon,
  FireIcon,
  SparklesIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { useENS } from '@/lib/utils/hooks/useENS'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'
import TimestampVersion from '../layout/TimestampVersion'

export type MissionActivityEventProps = {
  header?: string
  subject?: React.ReactNode
  extra?: React.ReactNode
  address?: string
  citizen?: any
  event?: any
  withProjectLink?: boolean
  pv?: string
}

function getEventIcon(header?: string) {
  const headerLower = header?.toLowerCase() || ''
  if (headerLower.includes('paid') || headerLower.includes('pay')) {
    return CurrencyDollarIcon
  }
  if (headerLower.includes('added') || headerLower.includes('balance')) {
    return PlusIcon
  }
  if (headerLower.includes('burned') || headerLower.includes('burn')) {
    return FireIcon
  }
  if (headerLower.includes('minted') || headerLower.includes('mint')) {
    return SparklesIcon
  }
  if (headerLower.includes('deployed') || headerLower.includes('create')) {
    return CubeIcon
  }
  return null
}

function getEventColorClass(header?: string) {
  const headerLower = header?.toLowerCase() || ''
  if (headerLower.includes('paid') || headerLower.includes('pay')) {
    return 'bg-emerald-500/[0.04] border-emerald-500/10 hover:bg-emerald-500/[0.07] hover:border-emerald-500/15'
  }
  if (headerLower.includes('added') || headerLower.includes('balance')) {
    return 'bg-blue-500/[0.04] border-blue-500/10 hover:bg-blue-500/[0.07] hover:border-blue-500/15'
  }
  if (headerLower.includes('burned') || headerLower.includes('burn')) {
    return 'bg-orange-500/[0.04] border-orange-500/10 hover:bg-orange-500/[0.07] hover:border-orange-500/15'
  }
  if (headerLower.includes('minted') || headerLower.includes('mint')) {
    return 'bg-purple-500/[0.04] border-purple-500/10 hover:bg-purple-500/[0.07] hover:border-purple-500/15'
  }
  return 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.08]'
}

export default function MissionActivityEvent({
  header,
  subject,
  extra,
  address,
  citizen,
  event,
  withProjectLink,
  pv,
}: MissionActivityEventProps) {
  const { data: ens } = useENS(address)
  const Icon = getEventIcon(header)
  const colorClass = getEventColorClass(header)
  const isPayEvent = header?.toLowerCase().includes('paid') || header?.toLowerCase().includes('pay')

  return (
    <div
      className={`${colorClass} backdrop-blur-sm border rounded-xl p-4 transition-all duration-200`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {Icon && (
            <div
              className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                isPayEvent
                  ? 'bg-emerald-500/10 text-emerald-400/80'
                  : 'bg-white/[0.06] text-white/60'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[11px] font-medium uppercase tracking-wider ${
                  isPayEvent ? 'text-emerald-400/70' : 'text-gray-500'
                }`}
              >
                {header}
              </span>
              {withProjectLink && (
                <span className="flex-shrink-0">
                  <Link href={``} passHref>
                    <JuiceboxLogoWhite />
                  </Link>
                </span>
              )}
            </div>
            <div className={`mt-2 ${isPayEvent ? 'text-white' : 'text-white/90'}`}>{subject}</div>
            {citizen && (
              <Link
                href={`/citizen/${generatePrettyLinkWithId(citizen?.name, citizen?.id)}`}
                className="mt-2 inline-block text-sm text-white/70 hover:text-white hover:underline transition-colors"
              >
                {citizen.name}
              </Link>
            )}
            {!citizen && address && (
              <div className="mt-2 text-sm text-white/70">
                {ens?.name ? ens.name : `${address.slice(0, 6)}...${address.slice(-4)}`}
              </div>
            )}
            {extra && (
              <div
                className={`mt-3 pt-3 border-t ${
                  isPayEvent ? 'border-green-500/10' : 'border-white/10'
                }`}
              >
                {extra}
              </div>
            )}
          </div>
        </div>
        {event?.timestamp && (
          <div className="flex-shrink-0">
            <TimestampVersion timestamp={event.timestamp} />
          </div>
        )}
      </div>
    </div>
  )
}
