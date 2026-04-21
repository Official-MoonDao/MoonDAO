import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  CheckBadgeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  GiftIcon,
  LockClosedIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { usePrivy } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
import ERC20ABI from 'const/abis/ERC20.json'
import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { BigNumber } from 'ethers'
import { ethers } from 'ethers'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useContext, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  readContract,
  getContract,
} from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import {
  arbitrum,
  base,
  ethereum,
  sepolia,
  arbitrumSepolia,
  Chain,
} from '@/lib/rpc/chains'
import toastStyle from '../lib/marketplace/marketplace-utils/toastConfig'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

type FeeChainData = {
  chain: Chain
  slug: string
  contract: any
  start: bigint
  last: bigint
  count: bigint
  vMooneyBalance: bigint
  hasVMooney: boolean
  checkedInOnChain: boolean
}

const WEEK = 7 * 24 * 60 * 60

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * `readContract` calls occasionally fail with
 * `TypeError: Cannot read properties of undefined (reading 'buffer')`.
 *
 * This happens deep inside `decodeAbiParameters` when the RPC returns a
 * malformed/empty response — usually a transient symptom of Infura
 * rate-limiting batched JSON-RPC reads. Retrying once or twice with a
 * short backoff almost always succeeds, and prevents the per-chain
 * `Promise.all` from rejecting (which previously dropped Arbitrum's row
 * from `feeData` entirely).
 */
async function safeRead<T>(
  fn: () => Promise<T>,
  label: string,
  retries = 2,
  baseDelay = 250
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const isLast = attempt === retries
      const isBufferDecodeError =
        err?.message?.includes("reading 'buffer'") ||
        err?.message?.includes('decodeAbiParameters')
      if (!isLast && isBufferDecodeError) {
        await sleep(baseDelay * Math.pow(2, attempt))
        continue
      }
      console.error(`safeRead [${label}] failed:`, err)
      return null
    }
  }
  return null
}

function formatEth(value: string | null, decimals = 4) {
  if (value === null) return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  return num.toFixed(decimals)
}

function formatUsd(value: string | null, ethPrice?: number) {
  if (value === null || !ethPrice) return null
  const num = Number(value) * ethPrice
  if (Number.isNaN(num)) return null
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  loading,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  subValue?: React.ReactNode
  loading?: boolean
  accent?: string
}) {
  return (
    <div className="bg-black/20 rounded-none sm:rounded-xl px-3 py-4 sm:p-5 border-y sm:border border-white/10 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            accent ?? 'bg-gradient-to-br from-blue-500/40 to-purple-600/40'
          }`}
        >
          {icon}
        </div>
        <span className="text-xs sm:text-sm uppercase tracking-wider text-gray-400 font-RobotoMono">
          {label}
        </span>
      </div>
      <div className="mt-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <LoadingSpinner width="w-4" height="h-4" />
            Loading...
          </div>
        ) : (
          <>
            <div className="text-white font-GoodTimes text-xl sm:text-2xl break-words">
              {value}
            </div>
            {subValue && (
              <div className="text-gray-400 text-xs sm:text-sm mt-1">{subValue}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function HowItWorksStep({
  step,
  title,
  description,
  icon,
}: {
  step: number
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex gap-3 sm:gap-4 items-start">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 border border-white/15 flex items-center justify-center text-white">
          {icon}
        </div>
        <div className="mt-1 text-[10px] tracking-wider text-gray-500 font-RobotoMono uppercase">
          Step {step}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-GoodTimes text-white text-sm sm:text-base">{title}</h3>
        <p className="mt-1 text-sm text-gray-300 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

export default function Fees() {
  const account = useActiveAccount()
  const address = account?.address
  const { authenticated } = usePrivy()
  const router = useRouter()

  const { wallets } = useWallets()
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains: Chain[] = useMemo(
    () => (isTestnet ? [sepolia, arbitrumSepolia] : [ethereum, arbitrum, base]),
    [isTestnet]
  )

  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { data: ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null)
  const [feesAvailable, setFeesAvailable] = useState<string | null>(null)
  const [estimatedFees, setEstimatedFees] = useState<string | null>(null)
  const [feeData, setFeeData] = useState<FeeChainData[]>([])
  const [weekEnd, setWeekEnd] = useState<number | null>(null)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { walletVP: VMOONEYBalance } = useTotalVP(address || '')

  // Fetch reward pool balance across chains. We hit each FeeHook's native ETH
  // balance directly via JSON-RPC because that's what `distributeFees` will
  // pay out from at the end of the week.
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const totalFees = (
          await Promise.all(
            chains.map(async (chain) => {
              const slug = getChainSlug(chain)
              const hookAddress = FEE_HOOK_ADDRESSES[slug]
              if (!hookAddress) return BigNumber.from(0)
              try {
                const response = await fetch(chain.rpc, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    method: 'eth_getBalance',
                    params: [hookAddress, 'latest'],
                    id: 1,
                    jsonrpc: '2.0',
                  }),
                })
                const data = await response.json()
                return BigNumber.from(data.result || '0')
              } catch (error) {
                console.error(`Error fetching balance for ${slug}:`, error)
                return BigNumber.from(0)
              }
            })
          )
        ).reduce((acc, bal) => acc.add(bal || BigNumber.from(0)), BigNumber.from(0))

        setFeesAvailable(ethers.utils.formatEther(totalFees || BigNumber.from(0)))
      } catch (e) {
        console.error('Error fetching balances:', e)
        setFeesAvailable('0')
      }
    }

    fetchBalances()
  }, [chains])

  useEffect(() => {
    if (!feeData.length) {
      setWeekEnd(null)
      return
    }
    const starts = feeData.map((d) => Number(d.start))
    const earliest = Math.min(...starts)
    setWeekEnd((earliest + WEEK) * 1000)
  }, [feeData])

  useEffect(() => {
    if (!address) return

    const fetchEstimates = async () => {
      try {
        const totalEstimated = (
          await Promise.all(
            chains.map(async (chain) => {
              const slug = getChainSlug(chain)
              const hookAddress = FEE_HOOK_ADDRESSES[slug]
              if (!hookAddress) return BigNumber.from(0)

              const contract = getContract({
                client,
                address: hookAddress,
                abi: FeeHook.abi as any,
                chain,
              })
              const estimate = await safeRead(
                () =>
                  readContract({
                    contract,
                    method: 'estimateFees',
                    params: [address],
                  }),
                `${slug}.estimateFees`
              )
              return BigNumber.from(estimate?.toString() || '0')
            })
          )
        ).reduce((acc, est) => acc.add(est || BigNumber.from(0)), BigNumber.from(0))

        setEstimatedFees(ethers.utils.formatEther(totalEstimated))
      } catch (e) {
        console.error('Error fetching estimates:', e)
        setEstimatedFees('0')
      }
    }

    fetchEstimates()
  }, [address, chains])

  useEffect(() => {
    if (!address) return

    const fetchStatus = async () => {
      // Each chain is fetched independently. A single chain failure (RPC
      // hiccup, rate limit, etc.) used to reject the whole Promise.all and
      // leave `feeData` empty, surfacing as "No fee data available" when the
      // user tried to check in. Isolate failures per-chain so the remaining
      // chains still populate.
      const raw = await Promise.all(
        chains.map(async (chain) => {
          const slug = getChainSlug(chain)
          try {
            const hookAddress = FEE_HOOK_ADDRESSES[slug]
            if (!hookAddress) return null

            const contract = getContract({
              client,
              address: hookAddress,
              abi: FeeHook.abi as any,
              chain,
            })

            // Read each method independently with retry. Previously these
            // were batched in `Promise.all`; if any single read failed (the
            // recurring `decodeAbiParameters → buffer` error from a flaky
            // RPC batch), the whole chain row was dropped from `feeData`,
            // which surfaced as Arbitrum data going missing.
            const [start, last, count, vMooneyAddress] = await Promise.all([
              safeRead(
                () => readContract({ contract, method: 'weekStart', params: [] }),
                `${slug}.weekStart`
              ),
              safeRead(
                () =>
                  readContract({
                    contract,
                    method: 'lastCheckIn',
                    params: [address],
                  }),
                `${slug}.lastCheckIn`
              ),
              safeRead(
                () =>
                  readContract({
                    contract,
                    method: 'getCheckedInCount',
                    params: [],
                  }),
                `${slug}.getCheckedInCount`
              ),
              safeRead(
                () =>
                  readContract({
                    contract,
                    method: 'vMooneyAddress',
                    params: [],
                  }),
                `${slug}.vMooneyAddress`
              ),
            ])

            // We need at least the week boundaries + vMooney address to do
            // anything useful. If those are missing the chain is unusable
            // for this render, but we still don't want to throw — other
            // chains should keep populating.
            if (start == null || vMooneyAddress == null) {
              console.warn(
                `Skipping ${slug}: missing required FeeHook reads (start=${start}, vMooneyAddress=${vMooneyAddress})`
              )
              return null
            }

            const vMooneyContract = getContract({
              client,
              address: vMooneyAddress as `0x${string}`,
              abi: ERC20ABI as any,
              chain,
            })

            const vMooneyBalance = await safeRead(
              () =>
                readContract({
                  contract: vMooneyContract,
                  method: 'balanceOf',
                  params: [address],
                }),
              `${slug}.balanceOf`
            )

            const balance = (vMooneyBalance as bigint | null) ?? BigInt(0)
            const safeLast = (last as bigint | null) ?? BigInt(0)
            const safeCount = (count as bigint | null) ?? BigInt(0)
            const hasVMooney = balance > BigInt(0)

            return {
              chain,
              slug,
              contract,
              start: start as bigint,
              last: safeLast,
              count: safeCount,
              vMooneyBalance: balance,
              hasVMooney,
              checkedInOnChain: safeLast === (start as bigint),
            }
          } catch (err) {
            console.error(`Error fetching check-in status for ${slug}:`, err)
            return null
          }
        })
      )

      const results = raw.filter((r) => r !== null) as FeeChainData[]
      setFeeData(results)

      // Only chains where the user actually holds vMOONEY are eligible to
      // check in (the FeeHook reverts otherwise). Aggregating "checked in"
      // across all chains regardless of balance would mean a user with
      // vMOONEY only on Arbitrum is forever shown as "not checked in"
      // because they can never check in on Ethereum / Base.
      const eligibleChains = results.filter((r) => r.hasVMooney)
      const totalCount = results.reduce(
        (acc, { count }) => acc + Number(count || BigInt(0)),
        0
      )
      const allChecked =
        eligibleChains.length > 0 &&
        eligibleChains.every(({ checkedInOnChain }) => checkedInOnChain)

      setCheckedInCount(totalCount)
      setIsCheckedIn(allChecked)
    }

    fetchStatus()
  }, [address, chains])

  const handleCheckIn = async () => {
    try {
      if (!account) throw new Error('No account found')

      if (!feeData || feeData.length === 0) {
        toast.error('Fee data is still loading. Please try again in a moment.', {
          style: toastStyle,
        })
        return
      }

      const currentChain = selectedChain
      let transactionsSent = 0
      let alreadyCheckedInCount = 0
      let eligibleChainsCount = 0

      const waitForChainSwitch = async (targetChainId: number, maxWait = 5000) => {
        const startTime = Date.now()
        while (Date.now() - startTime < maxWait) {
          const walletChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
          if (walletChainId === targetChainId) return true
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        return false
      }

      for (const data of feeData) {
        if (!data.hasVMooney) continue
        eligibleChainsCount++
        if (data.checkedInOnChain) {
          alreadyCheckedInCount++
          continue
        }

        const walletChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
        if (walletChainId !== data.chain.id) {
          await wallets[selectedWallet].switchChain(data.chain.id)
          setSelectedChain(data.chain)
          const switched = await waitForChainSwitch(data.chain.id)
          if (!switched) continue
          await new Promise((resolve) => setTimeout(resolve, 500))
        }

        const tx = prepareContractCall({
          contract: data.contract,
          method: 'checkIn' as string,
          params: [],
        })
        await sendAndConfirmTransaction({ transaction: tx, account })
        transactionsSent++
      }

      const finalWalletChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
      if (finalWalletChainId !== currentChain.id) {
        await wallets[selectedWallet].switchChain(currentChain.id)
        setSelectedChain(currentChain)
        await waitForChainSwitch(currentChain.id)
      }

      if (transactionsSent > 0) {
        toast.success(
          `Checked in on ${transactionsSent} chain${transactionsSent > 1 ? 's' : ''}!`,
          { style: toastStyle }
        )
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          shapes: ['circle', 'star'],
          colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
        })
        if (alreadyCheckedInCount + transactionsSent === eligibleChainsCount) {
          setIsCheckedIn(true)
        }
      } else if (eligibleChainsCount === 0) {
        toast.error(
          'No vMOONEY detected on Ethereum, Arbitrum, or Base. Lock MOONEY to participate.',
          { style: toastStyle }
        )
      } else if (alreadyCheckedInCount === eligibleChainsCount) {
        toast(
          "You're already checked in for this week. Rewards are distributed automatically every Thursday.",
          { style: toastStyle }
        )
        setIsCheckedIn(true)
      } else {
        toast.error('No check-ins were submitted. Please try again.', {
          style: toastStyle,
        })
      }
    } catch (error) {
      console.error('Error checking in:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Check-in failed: ${errorMessage}`, { style: toastStyle })
    }
  }

  const hasVMooney = !!(VMOONEYBalance && VMOONEYBalance > 0)
  const poolEth = formatEth(feesAvailable)
  const poolUsd = formatUsd(feesAvailable, ethPrice)
  const yourEth = formatEth(estimatedFees)
  const yourUsd = formatUsd(estimatedFees, ethPrice)

  return (
    <>
      <WebsiteHead
        title="Liquidity Rewards"
        description="Liquidity providers can claim a share of the weekly trading-fee reward pool by checking in. Rewards are distributed automatically each week."
      />
      <section id="fees-container" className="overflow-hidden">
        <Container>
          <ContentLayout
            header={
              // Render the title + tagline together so we can control the
              // spacing tightly. ContentLayout's built-in `description` slot
              // injects a wrapper with `md:mt-20` (when `branded={false}`)
              // that pushes the tagline ~80px below the title on desktop —
              // way too airy. Passing both in `header` sidesteps that.
              <div className="flex flex-col gap-2 sm:gap-3 max-w-3xl">
                <span
                  className="font-GoodTimes text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] block"
                  style={{
                    // clamp keeps the title readable on phones (28px floor)
                    // without ballooning on ultrawide monitors (52px ceiling).
                    // The default `.header-responsive` could push the title
                    // up to 64px on a 1600px viewport, which combined with
                    // the dark gradient backdrop made it hard to read.
                    fontSize: 'clamp(28px, 4.2vw, 48px)',
                    lineHeight: 1.05,
                    letterSpacing: '0.01em',
                  }}
                >
                  Liquidity Rewards
                </span>
                <p
                  className="text-white/80 font-RobotoMono leading-snug max-w-2xl"
                  style={{
                    // Tighter clamp than `.sub-header`'s `max(2vmin, 20px)`
                    // which jumped between sizes oddly on tablet widths.
                    fontSize: 'clamp(14px, 1.4vw, 17px)',
                  }}
                >
                  Earn a share of MoonDAO&apos;s weekly trading-fee reward
                  pool by checking in.
                </p>
              </div>
            }
            preFooter={
              <NoticeFooter
                defaultImage="../assets/MoonDAO-Logo-White.svg"
                defaultTitle="Need Help?"
                defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
                defaultButtonText="Submit a Ticket"
                defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
                imageWidth={200}
                imageHeight={200}
              />
            }
            mainPadding
            isProfile
            mode="compact"
            popOverEffect={false}
            branded={false}
          >
            <div className="mt-8 md:mt-12 flex flex-col gap-3 sm:gap-6">
              {/* How it works */}
              <div className="bg-black/20 rounded-none sm:rounded-xl px-3 py-4 sm:p-5 border-y sm:border border-white/10">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="font-GoodTimes text-white text-base sm:text-lg">
                      How Liquidity Rewards Work
                    </h2>
                    <p className="mt-2 text-sm sm:text-base text-gray-300 leading-relaxed">
                      MoonDAO captures trading fees from MOONEY/ETH liquidity
                      pools on Ethereum, Arbitrum, and Base. Each week the
                      collected ETH is split pro-rata among vMOONEY holders
                      who checked in for that week — your share is proportional
                      to your vMOONEY balance.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <HowItWorksStep
                      step={1}
                      title="Lock MOONEY"
                      description="Lock MOONEY to receive vMOONEY. The longer and larger you lock, the more vMOONEY (and the larger your share)."
                      icon={<LockClosedIcon className="w-5 h-5" />}
                    />
                    <HowItWorksStep
                      step={2}
                      title="Check In Weekly"
                      description="Sign one transaction per chain where you hold vMOONEY. This registers you as a participant in this week's pool."
                      icon={<CheckBadgeIcon className="w-5 h-5" />}
                    />
                    <HowItWorksStep
                      step={3}
                      title="Receive ETH Automatically"
                      description="Every Thursday a cron calls distributeFees() on each chain. ETH is sent directly to checked-in wallets — no claim required."
                      icon={<GiftIcon className="w-5 h-5" />}
                    />
                  </div>

                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs sm:text-sm text-gray-400 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4" />
                      <span>
                        Distribution runs every Thursday at 1pm Pacific
                      </span>
                    </div>
                    <Link
                      href="https://docs.moondao.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 transition-colors"
                    >
                      Read the docs
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                  icon={<CurrencyDollarIcon className="w-5 h-5 text-white" />}
                  label="Reward Pool"
                  value={poolEth ? `${poolEth} ETH` : 'Loading...'}
                  subValue={poolUsd ? `~$${poolUsd}` : undefined}
                  loading={feesAvailable === null}
                  accent="bg-gradient-to-br from-emerald-500/40 to-teal-600/40"
                />
                <StatCard
                  icon={<GiftIcon className="w-5 h-5 text-white" />}
                  label="Your Estimated Reward"
                  value={
                    !address
                      ? 'Connect wallet'
                      : !hasVMooney
                      ? 'Lock MOONEY'
                      : yourEth
                      ? `${yourEth} ETH`
                      : 'Calculating...'
                  }
                  subValue={
                    address && hasVMooney && yourUsd ? `~$${yourUsd}` : undefined
                  }
                  loading={!!address && hasVMooney && estimatedFees === null}
                  accent="bg-gradient-to-br from-purple-500/40 to-pink-600/40"
                />
                <StatCard
                  icon={<UserGroupIcon className="w-5 h-5 text-white" />}
                  label="Participants This Week"
                  value={
                    checkedInCount === null
                      ? 'Loading...'
                      : checkedInCount.toLocaleString()
                  }
                  subValue={
                    checkedInCount !== null
                      ? checkedInCount === 1
                        ? '1 check-in across all chains'
                        : `${checkedInCount} check-ins across all chains`
                      : undefined
                  }
                  loading={checkedInCount === null}
                  accent="bg-gradient-to-br from-blue-500/40 to-indigo-600/40"
                />
                <StatCard
                  icon={<ClockIcon className="w-5 h-5 text-white" />}
                  label="Next Distribution"
                  value={
                    weekEnd
                      ? new Date(weekEnd).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'TBD'
                  }
                  subValue={
                    weekEnd
                      ? new Date(weekEnd).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : undefined
                  }
                  loading={weekEnd === null && !!address}
                  accent="bg-gradient-to-br from-amber-500/40 to-orange-600/40"
                />
              </div>

              {/* Action card */}
              <div className="bg-black/20 rounded-none sm:rounded-xl px-3 py-4 sm:p-5 border-y sm:border border-white/10">
                {!authenticated ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="font-GoodTimes text-white text-base sm:text-lg">
                        Connect your wallet to check in
                      </h2>
                      <p className="mt-1 text-sm text-gray-300">
                        You need a connected wallet with vMOONEY to participate
                        in this week's reward pool.
                      </p>
                    </div>
                    <PrivyWeb3Button
                      v5
                      requiredChain={DEFAULT_CHAIN_V5}
                      label="Connect Wallet"
                      action={() => {}}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 shadow-lg whitespace-nowrap"
                    />
                  </div>
                ) : !hasVMooney ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="font-GoodTimes text-white text-base sm:text-lg">
                        Lock MOONEY to start earning
                      </h2>
                      <p className="mt-1 text-sm text-gray-300">
                        Only vMOONEY holders qualify for the weekly reward pool.
                        Lock MOONEY to receive vMOONEY.
                      </p>
                    </div>
                    <PrivyWeb3Button
                      v5
                      requiredChain={DEFAULT_CHAIN_V5}
                      label="Get vMOONEY"
                      action={() => router.push('/lock')}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-RobotoMono rounded-xl transition-all duration-300 shadow-lg whitespace-nowrap"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="font-GoodTimes text-white text-base sm:text-lg">
                        {isCheckedIn
                          ? "You're checked in for this week"
                          : 'Check in for this week'}
                      </h2>
                      <p className="mt-1 text-sm text-gray-300">
                        {isCheckedIn
                          ? 'Your share will be sent to your wallet automatically when distribution runs on Thursday.'
                          : 'Sign one transaction per chain where you hold vMOONEY to register for this week. The wallet may prompt you to switch networks.'}
                      </p>
                    </div>
                    <PrivyWeb3Button
                      skipNetworkCheck
                      action={handleCheckIn}
                      label={isCheckedIn ? 'Checked In' : 'Check In Now'}
                      className={`px-6 py-3 font-RobotoMono rounded-xl transition-all duration-300 shadow-lg whitespace-nowrap ${
                        isCheckedIn
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 via-purple-600 to-pink-600 hover:from-blue-600 hover:via-purple-700 hover:to-pink-700 text-white'
                      }`}
                      isDisabled={!address || isCheckedIn}
                    />
                  </div>
                )}
              </div>

              {/* Per-chain breakdown */}
              {address && hasVMooney && feeData.length > 0 && (
                <div className="bg-black/20 rounded-none sm:rounded-xl px-3 py-4 sm:p-5 border-y sm:border border-white/10">
                  <h2 className="font-GoodTimes text-white text-base sm:text-lg mb-3">
                    Your Status By Chain
                  </h2>
                  <div className="overflow-x-auto -mx-3 sm:mx-0">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-white/10">
                          <th className="px-3 py-2 font-RobotoMono uppercase text-xs tracking-wider">
                            Chain
                          </th>
                          <th className="px-3 py-2 font-RobotoMono uppercase text-xs tracking-wider">
                            vMOONEY
                          </th>
                          <th className="px-3 py-2 font-RobotoMono uppercase text-xs tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeData.map((d) => {
                          const balance = Number(
                            ethers.utils.formatEther(BigNumber.from(d.vMooneyBalance ?? 0))
                          )
                          let status: React.ReactNode = (
                            <span className="text-gray-500">Not eligible</span>
                          )
                          if (d.hasVMooney) {
                            status = d.checkedInOnChain ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                Checked in
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-amber-300">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                Needs check-in
                              </span>
                            )
                          }
                          return (
                            <tr
                              key={d.slug}
                              className="border-b border-white/5 last:border-b-0"
                            >
                              <td className="px-3 py-3 text-white capitalize">
                                {d.chain.name ?? d.slug}
                              </td>
                              <td className="px-3 py-3 text-gray-200 font-RobotoMono">
                                {balance.toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 4,
                                })}
                              </td>
                              <td className="px-3 py-3">{status}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    A check-in transaction is required on each chain where you
                    hold vMOONEY. Chains where you have a 0 balance are skipped
                    automatically.
                  </p>
                </div>
              )}

              {/* Footer link to in-app dashboard widget */}
              <div className="text-center pt-2 pb-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 transition-colors"
                >
                  <span>Back to dashboard</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}
