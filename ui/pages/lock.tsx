import {
  MoonIcon,
  LockClosedIcon,
  ClockIcon,
  InformationCircleIcon,
} from '@heroicons/react/outline'
import { BigNumber, ethers } from 'ethers'
import { useEffect, useState } from 'react'
import React from 'react'
import {
  MOONEYToken,
  vMOONEYToken,
  vMOONEYRequiredStake,
} from '../lib/config'
import { useMOONEYBalance } from '../lib/mooney-token'
import { NumberType, transformNumber } from '../lib/numbers'
import { useAccount } from '../lib/use-wagmi'
import {
  useVMOONEYBalance,
  useVMOONEYLock,
  useVMOONEYCreateLock,
  useVMOONEYIncreaseLock,
  useVMOONEYWithdrawLock,
} from '../lib/ve-token'
import ActionButton from '../components/ActionButton'
import Balance from '../components/Balance'
import GradientLink from '../components/GradientLink'
import Head from '../components/Head'
import MainCard from '../components/MainCard'
import TimeRange from '../components/TimeRange'
import LockPresets from '../components/LockPresets'
import { AllowanceWarning } from '../components/AllowanceWarning'
import useTranslation from 'next-translate/useTranslation';

const dateToReadable = (date: any) => {
  return date && date.toISOString().substring(0, 10)
}

const bigNumberToDate = (bigNumber: any) => {
  return bigNumber && new Date(bigNumber.mul(1000).toNumber())
}

const dateOut = (date: any, { days, years }: any) => {
  if (!date) return
  let dateOut = date
  days && dateOut.setDate(date.getDate() + days)
  years && dateOut.setFullYear(date.getFullYear() + years)
  return dateOut
}

const calculateVMOONEY = ({
  MOONEYAmount,
  VMOONEYAmount,
  time,
  lockTime,
  max,
}: any) => {
  if (!MOONEYAmount) return 0

  const vestingStart = calculateVestingStart({
    MOONEYAmount,
    VMOONEYAmount,
    lockTime,
  })
  const percentage = (time - vestingStart) / (max - vestingStart)
  const finalVMOONEYAmount = MOONEYAmount * percentage
  return finalVMOONEYAmount.toFixed(finalVMOONEYAmount > 1 ? 2 : 8)
}

const calculateVestingStart = ({
  MOONEYAmount,
  VMOONEYAmount,
  lockTime,
}: any) => {
  const fourYears = 31556926000 * 4
  return lockTime - (VMOONEYAmount / MOONEYAmount) * fourYears
}

export default function Lock() {
  const { data: account } = useAccount()

  const { data: MOONEYBalance, isLoading: MOONEYBalanceLoading } =
    useMOONEYBalance(account?.address)

  const { data: VMOONEYBalance, isLoading: VMOONEYBalanceLoading } =
    useVMOONEYBalance(account?.address)

  const { data: VMOONEYLock, isLoading: VMOONEYLockLoading } =
    useVMOONEYLock(account?.address)

  const [hasLock, setHasLock] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading && setHasLock(VMOONEYLock && VMOONEYLock[0] != 0)
  }, [VMOONEYLock])

  const [hasExpired, setHasExpired] = useState<boolean>()
  useEffect(() => {
    !VMOONEYLockLoading &&
      setHasExpired(
        VMOONEYLock &&
          VMOONEYLock[1] != 0 &&
          ethers.BigNumber.from(+new Date()).gte(VMOONEYLock[1].mul(1000))
      )
  }, [VMOONEYLock])

  const [lockAmount, setLockAmount] = useState<string>()

  const oneWeekOut = dateOut(new Date(), { days: 7 })

  const [lockTime, setLockTime] = useState({
    value: ethers.BigNumber.from(+oneWeekOut),
    formatted: dateToReadable(oneWeekOut),
  } as any)

  const [minMaxLockTime, setMinMaxLockTime] = useState({} as any)

  const [canIncrease, setCanIncrease] = useState({ amount: true, time: true })
  const [wantsToIncrease, setWantsToIncrease] = useState(false)

  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      !lockAmount && setLockAmount(ethers.utils.formatEther(VMOONEYLock[0]))
      const origTime = {
        value: VMOONEYLock[1],
        formatted: dateToReadable(bigNumberToDate(VMOONEYLock[1])),
      }
      !lockTime && lockTime.orig
      setLockTime({
        ...origTime,
        orig: origTime,
      })
    }
  }, [hasLock, VMOONEYLock])

  useEffect(() => {
    if (hasLock && VMOONEYLock) {
      setMinMaxLockTime({
        min: dateToReadable(
          oneWeekOut
        ),
        max: dateToReadable(dateOut(new Date(), { years: 4 })),
      })
      setCanIncrease({
        amount: (lockAmount &&
          ethers.utils.parseEther(lockAmount).gt(VMOONEYLock[0])) as boolean,
        time:
          lockTime?.value &&
          lockTime.value.gt(
            +dateOut(bigNumberToDate(VMOONEYLock[1]), { days: 7 })
          ),
      })
    } else {
      setMinMaxLockTime({
        min: dateToReadable(oneWeekOut),
        max: dateToReadable(dateOut(new Date(), { years: 4 })),
      })
    }
  }, [hasLock, lockAmount, lockTime, VMOONEYLock])

  const createLock = useVMOONEYCreateLock(
    lockAmount && ethers.utils.parseEther(lockAmount),
    lockTime.value.div(1000)
  )

  const increaseLock = useVMOONEYIncreaseLock({
    currentAmount: VMOONEYLock && VMOONEYLock[0],
    newAmount:
      lockAmount &&
      VMOONEYLock &&
      ethers.utils.parseEther(lockAmount).sub(VMOONEYLock[0]),
    currentTime: VMOONEYLock && VMOONEYLock[1],
    newTime: lockTime?.value.div(1000),
  })

  const withdraw = useVMOONEYWithdrawLock()

  const { t } = useTranslation('common');

  return (
    <div className='animate-fadeIn'>
      <Head title="$vMOONEY" />

      <MainCard title={t('lockCardTitle')}>
        <p className="mb-4">
          {t('lockTitle')}{' '}
          <GradientLink
            text={t('learnMore')}
            href="#"
            internal={false}
            textSize={'md'}
          ></GradientLink>
        </p>
        {!hasLock ? (
          <>
            <p>
            {t('lockDesc')}
              <br />
              <br />
          
            </p>
          </>
        ) : (
          ''
        )}
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
                    balance={VMOONEYBalance.value}
                    loading={VMOONEYBalanceLoading}
                    decimals={
                      VMOONEYBalance &&
                      VMOONEYBalance.value.gt(ethers.utils.parseEther('1'))
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
                    dateToReadable(bigNumberToDate(VMOONEYLock[1]))}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="card bg-base-100 rounded-[15px] border-[0.5px] border-gray-300 bg-black bg-opacity-30 shadow-indigo-40 text-white shadow overflow-visible">
          <div className="card-body">
            <div className="form-control">
              {!hasExpired ? (
                <>
                  <p className="mb-4">
                    {t('lockAvailableMoney')}{' '}
                    <Balance
                      balance={MOONEYBalance?.formatted}
                      loading={MOONEYBalanceLoading}
                    />{' '}
                    $MOONEY
                  </p>
                  <label className="label">
                    <span className="label-text white-text">
                      {t('lockAmount')}
                      <br />
                      <span className="text-xs ">
                        {t('lockAmountDesc')}
                        {hasLock && canIncrease.time ? t('lockAmountNote') : ''}
                      </span>
                    </span>
                  </label>
                  <div className="input-group mb-4 black-text">
                    <input
                      type="number"
                      placeholder="0"
                      className="input input-bordered w-full"
                      value={lockAmount}
                      disabled={MOONEYBalance?.formatted == 0 || (hasLock && canIncrease.time) ? true : false }
                      min={
                        VMOONEYLock
                          ? ethers.utils.formatEther(VMOONEYLock[0])
                          : 0
                      }
                      onChange={(e: any) => {
                        setLockAmount(e.target.value)
                        setWantsToIncrease(true)
                      }}
                    />

                    <button
                      className="btn btn-outline white-text hover:bg-accent"
                      disabled={MOONEYBalance?.formatted == 0 || (hasLock && canIncrease.time) ? true : false }
                      onClick={() => {
                        setLockAmount(
                          VMOONEYLock
                            ? ethers.utils.formatEther(
                                VMOONEYLock[0].add(MOONEYBalance?.value)
                              )
                            : MOONEYBalance?.formatted
                        )
                        setWantsToIncrease(true)
                      }}
                    >
                      Max
                    </button>
                  </div>
                  <label className="label">
                    <span className="label-text white-text">
                      {t('lockExpDate')}
                      <br />
                      <span className="text-xs">
                        {t('lockDesc2')}
                        {hasLock && canIncrease.amount ? t('lockAmountNote') : ''}
                      </span>
                    </span>
                  </label>
                  <input
                    type="date"
                    placeholder={t('lockExpDate')}
                    className="input input-bordered w-full black-text"
                    value={lockTime.formatted}
                    min={hasLock ? dateToReadable(bigNumberToDate(VMOONEYLock[1])) : minMaxLockTime.min}
                    max={minMaxLockTime.max}
                    disabled={MOONEYBalance?.formatted == 0 || (hasLock && canIncrease.amount) ? true : false }
                    onChange={(e: any) => {
                      setLockTime({
                        ...lockTime,
                        formatted: e.target.value
                          ? e.target.value
                          : lockTime.orig.formatted,
                        value: e.target.value
                          ? ethers.BigNumber.from(Date.parse(e.target.value))
                          : lockTime.orig.value,
                      })
                      setWantsToIncrease(!!e.target.value)
                    }}
                  />

                  <LockPresets
                    disabled={MOONEYBalance?.formatted == 0 || (hasLock && canIncrease.amount) ? true : false }
                    expirationTime={VMOONEYLock ? Date.parse(bigNumberToDate(VMOONEYLock[1])) : Date.now}
                    displaySteps={!hasLock}
                    onChange={(newDate: any) => {
                      console.log(newDate)
                      setWantsToIncrease(true);
                      setLockTime({
                        ...lockTime,
                        formatted: dateToReadable(newDate),
                        value: ethers.BigNumber.from(Date.parse(newDate)),
                      })
                    }}
                  />

                  <TimeRange
                    disabled={MOONEYBalance?.formatted == 0 || (hasLock && canIncrease.amount) ? true : false }
                    time={Date.parse(lockTime.formatted)}
                    min={Date.parse(minMaxLockTime.min)}
                    max={Date.parse(minMaxLockTime.max)}
                    displaySteps={!hasLock}
                    onChange={(newDate: any) => {
                      if (Date.parse(newDate) < Date.parse(dateToReadable(bigNumberToDate(VMOONEYLock[1])))) {
                        setWantsToIncrease(false);
                      }
                      else {
                        setWantsToIncrease(true);
                        setLockTime({
                          ...lockTime,
                          formatted: dateToReadable(newDate),
                          value: ethers.BigNumber.from(Date.parse(newDate)),
                        })
                        console.log(lockTime)
                      }
                    }}
                  />
                  {(canIncrease.time || canIncrease.amount) && wantsToIncrease ? (
                    <p>
                      {t('lockBalance')}{' '}
                      {calculateVMOONEY({
                        MOONEYAmount: lockAmount && +lockAmount,
                        VMOONEYAmount: transformNumber(
                          VMOONEYBalance?.value || 0,
                          NumberType.number
                        ),
                        time: Date.parse(lockTime.formatted),
                        lockTime: Date.parse(
                          hasLock && lockTime?.orig
                            ? lockTime.orig.formatted
                            : new Date()
                        ),
                        max: Date.parse(minMaxLockTime.max),
                      })}{' '}
                      $vMOONEY
                    </p>
                  ) : (
                    ''
                  )}
                  <div className="card-actions mt-4 white-text">
                    <ActionButton
                      className={`border-style btn text-black normal-case font-medium w-full ${
                        (
                          (hasLock && ((canIncrease.amount && canIncrease.time) || (!canIncrease.amount && !canIncrease.time))) || 
                          (lockAmount && parseFloat(lockAmount) > parseFloat(ethers.utils.formatEther(VMOONEYLock[0].add(MOONEYBalance?.value)))) ||
                          !lockAmount
                        ) 
                          ? 'border-disabled btn-disabled bg-transparent'
                          : 'bg-primary'
                      }`}
                      action={hasLock ? increaseLock : createLock}
                      approval={{
                        token: MOONEYToken,
                        spender: vMOONEYToken,
                        amountNeeded:
                          hasLock && VMOONEYLock
                            ? (
                                transformNumber(
                                  lockAmount ?? '0',
                                  NumberType.bignumber
                                ) as BigNumber
                              ).sub(VMOONEYLock[0])
                            : transformNumber(
                                lockAmount ?? '0',
                                NumberType.bignumber
                              ),
                        approveText: t('lockApproveText'),
                      }}
                    >
                      {!hasLock
                        ? t('lock')
                        : `${t('lockInc')} ${
                            (canIncrease.amount && !canIncrease.time) ? t('amount') : ''
                          }  
                          ${(!canIncrease.amount && canIncrease.time) ? t('time') : ''}`
                        }
                    </ActionButton>
                  </div>
                </>
              ) : (
                <>
                  <p className='white-text'>{t('expDesc')} </p>

                  <div className="card-actions mt-4">
                    <ActionButton
                      className="btn btn-primary normal-case font-medium w-full"
                      action={withdraw}
                    >
                      {t('withdraw')}
                    </ActionButton>
                  </div>
                </>
              )}
            </div>
            <AllowanceWarning token={MOONEYToken} spender={vMOONEYToken} />
          </div>
        </div>
      </MainCard>
    </div>
  )
}
