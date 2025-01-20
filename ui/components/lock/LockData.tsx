import {
  ClockIcon,
  LockClosedIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import { ethers } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import { bigNumberToDate, dateToReadable } from '../../lib/utils/dates'
import Balance from '../Balance'

type LockDataProps = {
  hasLock: boolean
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
}: any) {
  const { t } = useTranslation('common')
  return (
    <section id="lock-data" className="mt-6 xl:mt-6 xl:w-3/4 bg-dark-cool rounded-[20px] overflow-hidden">
      {/*Lock Data*/}
      {hasLock && (
        <>
          <div className="card stats-vertical lg:stats-horizontal shadow mb-4">
            <div className="stat">
              <div className="white-text stat-figure text-primary">
                <MoonIcon className="h-8 w-8" />
              </div>
              <div className="white-text">{t('hasLockMoney1')}</div>
              <div className="stat-value text-primary">
                <Balance
                  id="lock-data-vmooney-balance"
                  token="VMOONEY"
                  balance={VMOONEYBalance?.toString() / 10 ** 18}
                  loading={VMOONEYBalanceLoading}
                  decimals={
                    VMOONEYBalance &&
                    VMOONEYBalance?.gt(ethers.utils.parseEther('1'))
                      ? 2
                      : 8
                  }
                />
              </div>
            </div>

            <div className="stat">
              <div className="white-text stat-figure text-secondary">
                <LockClosedIcon className="h-8 w-8" />
              </div>
              <div className="white-text">{t('hasLockMoney2')}</div>
              <div className="stat-value text-secondary">
                <Balance
                  id="lock-data-locked-mooney"
                  balance={VMOONEYLock && VMOONEYLock[0]}
                  loading={VMOONEYLockLoading}
                  decimals={2}
                />
              </div>
            </div>
          </div>

          <div className="card stats-vertical lg:stats-horizontal shadow mb-4">
            <div className="stat">
              <div className="stat-figure">
                <ClockIcon className="h-8 w-8" />
              </div>
              <div className="white-text">{t('yourlockExpDate')}</div>
              <div className="yellow-text stat-value">
                {VMOONEYLock &&
                  dateToReadable(bigNumberToDate(VMOONEYLock?.[1]))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
