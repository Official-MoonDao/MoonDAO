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
    return 'bg-gradient-to-br from-white/5 via-green-500/8 to-emerald-500/8 border-green-500/15 hover:from-white/8 hover:via-green-500/10 hover:to-emerald-500/10 hover:border-green-500/20'
  }
  if (headerLower.includes('added') || headerLower.includes('balance')) {
    return 'bg-gradient-to-br from-white/5 via-blue-500/8 to-cyan-500/8 border-blue-500/15 hover:from-white/8 hover:via-blue-500/10 hover:to-cyan-500/10 hover:border-blue-500/20'
  }
  if (headerLower.includes('burned') || headerLower.includes('burn')) {
    return 'bg-gradient-to-br from-white/5 via-orange-500/8 to-red-500/8 border-orange-500/15 hover:from-white/8 hover:via-orange-500/10 hover:to-red-500/10 hover:border-orange-500/20'
  }
  if (headerLower.includes('minted') || headerLower.includes('mint')) {
    return 'bg-gradient-to-br from-white/5 via-purple-500/8 to-pink-500/8 border-purple-500/15 hover:from-white/8 hover:via-purple-500/10 hover:to-pink-500/10 hover:border-purple-500/20'
  }
  return 'bg-gradient-to-br from-white/5 to-slate-800/20 border-white/10 hover:from-white/8 hover:to-slate-700/25'
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
  const isPayEvent =
    header?.toLowerCase().includes('paid') ||
    header?.toLowerCase().includes('pay')

  return (
    <div
      className={`${colorClass} backdrop-blur-md border rounded-xl p-4 transition-all duration-300 hover:shadow-lg`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {Icon && (
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                isPayEvent
                  ? 'bg-gradient-to-br from-green-500/15 to-emerald-500/15 text-green-400/70'
                  : 'bg-white/10 text-white/70'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-medium uppercase tracking-wide ${
                  isPayEvent ? 'text-green-400/60' : 'text-grey-400'
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
            <div
              className={`mt-2 ${isPayEvent ? 'text-white' : 'text-white/90'}`}
            >
              {subject}
            </div>
            {citizen && (
              <Link
                href={`/citizen/${generatePrettyLinkWithId(
                  citizen?.name,
                  citizen?.id
                )}`}
                className="mt-2 inline-block text-sm text-white/70 hover:text-white hover:underline transition-colors"
              >
                {citizen.name}
              </Link>
            )}
            {!citizen && address && (
              <div className="mt-2 text-sm text-white/70">
                {ens
                  ? ens.name
                  : `${address.slice(0, 6)}...${address.slice(-4)}`}
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
