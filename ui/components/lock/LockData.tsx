import {
  ClockIcon,
  LockClosedIcon,
  MoonIcon,
  StarIcon,
} from '@heroicons/react/24/outline'
import { BigNumber, ethers } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import { bigNumberToDate, dateToReadable } from '../../lib/utils/dates'
import Balance from '../Balance'

type LockDataProps = {
  hasLock: boolean | undefined
  VMOONEYBalance: any
  VMOONEYBalanceLoading: boolean
  VMOONEYLock: any
  VMOONEYLockLoading: boolean
}

export function LockData({
  hasLock,
  VMOONEYBalance,
  VMOONEYBalanceLoading,
  VMOONEYLock,
  VMOONEYLockLoading,
}: LockDataProps) {
  const { t } = useTranslation('common')

  if (!hasLock) return null

  return (
    <section id="lock-data" className="mb-6">
      {/* vMOONEY Balance and Locked Amount */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden mb-4">
        <div className="p-5">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MoonIcon className="h-5 w-5 text-blue-400" />
            Your Lock Overview
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* vMOONEY Balance */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <StarIcon className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">vMOONEY Balance</p>
                    <p className="text-white text-sm font-medium">Governance Token</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center text-left">
                <span className="text-green-400 text-2xl font-RobotoMono font-semibold flex items-center">
                  <Balance
                    id="lock-data-vmooney-balance"
                    balance={VMOONEYBalance?.toString() / 10 ** 18}
                    loading={VMOONEYBalanceLoading}
                    decimals={0}
                    token=""
                  />
                  <span className="ml-1 text-base md:text-lg">vMOONEY</span>
                </span>
              </div>
            </div>

            {/* Locked Amount */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <LockClosedIcon className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Locked Amount</p>
                    <p className="text-white text-sm font-medium">MOONEY Tokens</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center text-left">
                <div className="text-white text-2xl font-RobotoMono font-semibold flex items-center">
                  <Balance
                    id="lock-data-locked-mooney"
                    balance={VMOONEYLock && BigNumber.from(VMOONEYLock[0])}
                    loading={VMOONEYLockLoading}
                    decimals={0}
                  />
                  <Image
                    src="/coins/MOONEY.png"
                    width={20}
                    height={20}
                    alt="MOONEY"
                    className="rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lock Expiration Date */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Lock Expires</p>
                <p className="text-white text-lg font-medium">Unlock Date</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-400 text-2xl font-RobotoMono font-bold">
                {VMOONEYLock &&
                  dateToReadable(bigNumberToDate(VMOONEYLock?.[1]))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
