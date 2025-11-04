import { BoltIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import Tooltip from '../layout/Tooltip'

type MooneyBalancesProps = {
  unlockedMooney?: number | null
  lockedMooney?: number | null
  votingPower?: number | null
  isUnlockedLoading?: boolean
  isLockedLoading?: boolean
  isVotingPowerLoading?: boolean
  unlockDate?: Date | null
}

export default function MooneyBalances({
  unlockedMooney,
  lockedMooney,
  votingPower,
  isUnlockedLoading,
  isLockedLoading,
  isVotingPowerLoading,
  unlockDate,
}: MooneyBalancesProps) {
  const totalMooney = (unlockedMooney || 0) + (lockedMooney || 0)
  const unlockedShare =
    totalMooney > 0 ? (unlockedMooney || 0) / totalMooney : 0
  const lockedShare = totalMooney > 0 ? (lockedMooney || 0) / totalMooney : 0

  const formattedUnlocked = formatToken(unlockedMooney)
  const formattedLocked = formatToken(lockedMooney)
  const formattedVotingPower = formatVotingPower(votingPower)

  return (
    <div className="flex flex-col items-left justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:px-4 sm:py-2.5 text-white backdrop-blur-xl">
      <div className="flex items-center gap-3 w-full">
        <h3 className="text-white/80 font-medium font-GoodTimes">MOONEY</h3>
        {/* MOONEY Logo */}
        <div className="flex-shrink-0">
          <Image
            src="/coins/MOONEY.png"
            alt="MOONEY"
            width={24}
            height={24}
            className="rounded-full"
          />
        </div>

        {/* Balance distribution bar */}
        <div className="relative h-2.5 w-full max-w-[400px] overflow-hidden rounded-full bg-white/10">
          {unlockedShare > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-400 transition-all"
              style={{ width: `${unlockedShare * 100}%` }}
            />
          )}
          {lockedShare > 0 && (
            <div
              className="absolute inset-y-0 transition-all"
              style={{
                left: `${unlockedShare * 100}%`,
                width: `${lockedShare * 100}%`,
                background: 'linear-gradient(to right, #a855f7, #6366f1)',
              }}
            />
          )}
        </div>
      </div>

      {/* Clickable Metrics */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs text-white/80 min-w-0 flex-wrap">
        {/* Available - Clickable to Buy */}
        <Link
          href="/get-mooney"
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer group"
        >
          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 flex-shrink-0" />
          <span className="font-medium whitespace-nowrap">
            {isUnlockedLoading ? '…' : formattedUnlocked}
          </span>
          <span className="text-white/60 group-hover:underline font-semibold">
            Available
          </span>
        </Link>

        <div className="hidden lg:block h-4 w-px bg-white/20" />

        {/* Locked - Clickable to Stake */}
        <Link
          href="/lock"
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer group"
        >
          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex-shrink-0" />
          <span className="font-medium whitespace-nowrap">
            {isLockedLoading ? '…' : formattedLocked}
          </span>
          <span className="text-white/60 group-hover:underline font-semibold">
            Locked
          </span>
        </Link>

        <div className="hidden lg:block h-4 w-px bg-white/20" />

        {/* Voting Power - Clickable to Stake */}
        <Link
          href="/lock"
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
        >
          <div className="group flex items-center justify-center gap-1">
            <BoltIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-400/90" />
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white group-hover:bg-white/20 transition-colors">
              {isVotingPowerLoading ? '…' : formattedVotingPower}
            </span>
            <span className="font-semibold tracking-wide text-white/75 group-hover:underline">
              Voting Power
            </span>
          </div>
          <Tooltip
            buttonClassName="scale-75"
            text={`Your voting power is the square root of your vMOONEY balance. ${votingPower}`}
            compact
          >
            ?
          </Tooltip>
        </Link>
      </div>
    </div>
  )
}

function formatToken(value?: number | null) {
  if (value === undefined || value === null) return '0'

  const absValue = Math.abs(value)

  if (absValue >= 100000) {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })
  }

  if (absValue >= 1000) {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: 1,
    })
  }

  return value.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })
}

function formatVotingPower(value?: number | null) {
  if (value === undefined || value === null) return '0'

  if (value >= 100000) {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })
  }

  return value.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })
}
