import {
  ClockIcon,
  LockClosedIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import { BigNumber, ethers } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import { useEffect, useState } from 'react'
import { bigNumberToDate, dateToReadable } from '../../lib/utils/dates'
import { formatNumberWithCommasAndDecimals } from '../../lib/utils/numbers'

const MAXTIME_SECONDS = 4 * 365 * 86400 // 4 years in seconds (matches VotingEscrow.vy)

type LockDataProps = {
  hasLock: boolean | undefined
  VMOONEYBalance: any
  VMOONEYBalanceLoading: boolean
  VMOONEYLock: any
  VMOONEYLockLoading: boolean
}

/**
 * Calculates current vMOONEY balance based on Curve-style linear decay:
 * balance(t) = amount * (end - t) / MAXTIME
 */
function calculateDynamicVMooney(lockedAmount: number, lockEndSeconds: number): number {
  const nowSeconds = Date.now() / 1000
  if (nowSeconds >= lockEndSeconds) return 0
  return (lockedAmount * (lockEndSeconds - nowSeconds)) / MAXTIME_SECONDS
}

export function LockData({
  hasLock,
  VMOONEYBalance,
  VMOONEYBalanceLoading,
  VMOONEYLock,
  VMOONEYLockLoading,
}: LockDataProps) {
  const { t } = useTranslation('common')
  const [now, setNow] = useState(() => Date.now())

  // Update every 500ms for visible decreasing vMOONEY display
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  if (!hasLock) return null

  const lockedAmount = VMOONEYLock ? parseFloat(ethers.utils.formatEther(VMOONEYLock[0])) : 0
  const lockEndSeconds = VMOONEYLock ? Number(VMOONEYLock[1]) : 0
  const dynamicVMooney = calculateDynamicVMooney(lockedAmount, lockEndSeconds)

  return (
    <section id="lock-data" className="mb-6">
      {/* Locked Amount and vMOONEY Balance */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden mb-4">
        <div className="p-5">
          <h3 className="text-lg font-bold text-white mb-4">
            Your Lock Overview
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Locked Amount */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col min-w-0">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <LockClosedIcon className="h-4 w-4 text-purple-400" />
                </div>
                <p className="text-white text-sm font-medium ml-2">
                  Locked MOONEY
                </p>
              </div>
              <div className="mt-auto min-w-0 overflow-hidden">
                {VMOONEYLockLoading ? (
                  <span className="text-white text-base sm:text-lg md:text-xl font-RobotoMono font-semibold animate-pulse">...</span>
                ) : (
                  <span id="lock-data-locked-mooney" className="text-white text-base sm:text-lg md:text-xl font-RobotoMono font-semibold whitespace-nowrap block">
                    {formatNumberWithCommasAndDecimals(lockedAmount, 2)}
                  </span>
                )}
              </div>
            </div>

            {/* vMOONEY Balance - dynamically decreasing */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col min-w-0">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <MoonIcon className="h-4 w-4 text-blue-400" />
                </div>
                <p className="text-white text-sm font-medium ml-2">
                  vMOONEY
                </p>
              </div>
              <div className="mt-auto min-w-0 overflow-hidden">
                {VMOONEYLockLoading ? (
                  <span className="text-blue-400 text-base sm:text-lg md:text-xl font-RobotoMono font-semibold animate-pulse">...</span>
                ) : (
                  <span id="lock-data-vmooney-balance" className="text-blue-400 text-base sm:text-lg md:text-xl font-RobotoMono font-semibold whitespace-nowrap block">
                    {formatNumberWithCommasAndDecimals(dynamicVMooney, 4)}
                  </span>
                )}
              </div>
            </div>

            {/* Lock Expires */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col min-w-0">
              <div className="flex items-center mb-2">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <ClockIcon className="h-4 w-4 text-yellow-400" />
                </div>
                <p className="text-white text-sm font-medium ml-2">
                  Lock Expires
                </p>
              </div>
              <div className="mt-auto min-w-0 overflow-hidden">
                {VMOONEYLockLoading ? (
                  <span className="text-yellow-400 text-base sm:text-lg md:text-xl font-RobotoMono font-semibold animate-pulse">...</span>
                ) : (
                  <span id="lock-data-expires" className="text-yellow-400 text-base sm:text-lg md:text-xl font-RobotoMono font-semibold whitespace-nowrap block">
                    {VMOONEYLock && dateToReadable(bigNumberToDate(VMOONEYLock[1]))}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
