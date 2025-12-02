import { GiftIcon, TrophyIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
import ERC20ABI from 'const/abis/ERC20.json'
import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import { BigNumber } from 'ethers'
import { ethers } from 'ethers'
import Link from 'next/link'
import { useContext, useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { getContract, readContract, prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { arbitrum, base, ethereum, sepolia, arbitrumSepolia, Chain } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '../../lib/marketplace/marketplace-utils/toastConfig'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { useTotalVP } from '@/lib/tokens/hooks/useTotalVP'
import Frame from '@/components/layout/Frame'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function WeeklyRewardPool() {
  const account = useActiveAccount()
  const address = account?.address

  // Fee-related state and logic
  const { wallets } = useWallets()
  const isTestnet = process.env.NEXT_PUBLIC_CHAIN !== 'mainnet'
  const chains: Chain[] = useMemo(
    () => (isTestnet ? [sepolia, arbitrumSepolia] : [ethereum, arbitrum, base]),
    [isTestnet]
  )

  const { selectedChain: contextSelectedChain, setSelectedChain } = useContext(ChainContextV5)
  const { data: currentEthPrice } = useETHPrice(1, 'ETH_TO_USD')
  const { selectedWallet } = useContext(PrivyWalletContext)

  const WEEK = 7 * 24 * 60 * 60

  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null)
  const [feesAvailable, setFeesAvailable] = useState<string | null>(null)
  const [estimatedFees, setEstimatedFees] = useState<string | null>(null)
  const [feeData, setFeeData] = useState<any[]>([])

  const { walletVP: VMOONEYBalance } = useTotalVP(address || '')

  // Fee-related useEffect hooks
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const totalFees = (
          await Promise.all(
            chains.map(async (chain) => {
              const slug = getChainSlug(chain)
              const hookAddress = FEE_HOOK_ADDRESSES[slug]
              if (!hookAddress) return BigNumber.from(0)

              // Get the native ETH balance using thirdweb's RPC
              try {
                const rpcUrl = chain.rpc
                const response = await fetch(rpcUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
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
        )
          .filter((bal) => bal !== undefined && bal !== null)
          .reduce((acc, bal) => acc.add(bal || BigNumber.from(0)), BigNumber.from(0))

        setFeesAvailable(ethers.utils.formatEther(totalFees || BigNumber.from(0)))
      } catch (e) {
        console.error('Error fetching balances:', e)
        // Set to "0" on error instead of leaving as null
        setFeesAvailable('0')
      }
    }

    fetchBalances()
  }, [chains, WEEK]) // Removed address dependency

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
              return readContract({
                contract,
                method: 'estimateFees',
                params: [address],
              }).catch(() => BigNumber.from(0))
            })
          )
        ).reduce((acc, est) => acc.add(est || BigNumber.from(0)), BigNumber.from(0))

        setEstimatedFees(ethers.utils.formatEther(totalEstimated))
      } catch (e) {
        console.error('Error fetching estimates:', e)
      }
    }

    fetchEstimates()
  }, [address, chains, WEEK])

  useEffect(() => {
    if (!address) return

    const fetchStatus = async () => {
      try {
        const raw = await Promise.all(
          chains.map(async (chain) => {
            const slug = getChainSlug(chain)
            const hookAddress = FEE_HOOK_ADDRESSES[slug]
            if (!hookAddress) return null

            const contract = getContract({
              client,
              address: hookAddress,
              abi: FeeHook.abi as any,
              chain,
            })

            const [start, last, count, vMooneyAddress] = await Promise.all([
              readContract({ contract, method: 'weekStart', params: [] }),
              readContract({
                contract,
                method: 'lastCheckIn',
                params: [address],
              }),
              readContract({
                contract,
                method: 'getCheckedInCount',
                params: [],
              }),
              readContract({
                contract,
                method: 'vMooneyAddress',
                params: [],
              }),
            ])

            const vMooneyContract = getContract({
              client,
              address: vMooneyAddress,
              abi: ERC20ABI as any,
              chain,
            })

            const vMooneyBalance = await readContract({
              contract: vMooneyContract,
              method: 'balanceOf',
              params: [address],
            })

            return {
              chain,
              slug,
              contract,
              start,
              last,
              count,
              vMooneyBalance,
              checkedInOnChain: last === start,
            }
          })
        )

        const results = raw.filter((r) => r) as Array<{
          chain: any
          slug: string
          contract: any
          start: bigint
          last: bigint
          count: bigint
          vMooneyBalance: bigint
          checkedInOnChain: boolean
        }>

        setFeeData(results)

        // aggregate counts & allChecked
        const { totalCount, allChecked } = results.reduce(
          (acc, { last, start, count }) => {
            acc.totalCount += Number(count || BigInt(0))
            if (last !== start) {
              acc.allChecked = false
            }
            return acc
          },
          { totalCount: 0, allChecked: true }
        )

        setCheckedInCount(totalCount)
        setIsCheckedIn(allChecked)
      } catch (err) {
        console.error('Error fetching check‑in status:', err)
      }
    }

    fetchStatus()
  }, [address, chains, WEEK])

  const handleCheckIn = async () => {
    try {
      if (!account) throw new Error('No account found')

      if (!feeData || feeData.length === 0) {
        toast.error('No fee data available. Please try again later.', {
          style: toastStyle,
        })
        return
      }

      const currentChain = contextSelectedChain
      let transactionsSent = 0

      const waitForChainSwitch = async (targetChainId: number, maxWait = 5000) => {
        const startTime = Date.now()
        while (Date.now() - startTime < maxWait) {
          const walletChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
          if (walletChainId === targetChainId) {
            return true
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        return false
      }

      for (const data of feeData) {
        if (data.checkedInOnChain) continue
        if (!data.vMooneyBalance || data.vMooneyBalance === BigInt(0)) {
          continue
        }

        const walletChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
        if (walletChainId !== data.chain.id) {
          await wallets[selectedWallet].switchChain(data.chain.id)
          setSelectedChain(data.chain)

          const switched = await waitForChainSwitch(data.chain.id)
          if (!switched) {
            console.warn(`Chain switch to ${data.chain.id} may not have completed`)
            continue
          }

          await new Promise((resolve) => setTimeout(resolve, 500))
        }

        const slug = getChainSlug(data.chain)
        const hookAddress = FEE_HOOK_ADDRESSES[slug]
        if (!hookAddress) continue

        let contract = getContract({
          client,
          address: hookAddress,
          abi: FeeHook.abi as any,
          chain: data.chain,
        })

        const currentWalletChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
        if (currentWalletChainId !== data.chain.id) {
          console.warn(`Expected chain ${data.chain.id} but wallet is on ${currentWalletChainId}`)
          continue
        }

        let retries = 3
        let success = false

        while (retries > 0 && !success) {
          try {
            const tx = prepareContractCall({
              contract,
              method: 'checkIn' as string,
              params: [],
            })

            await sendAndConfirmTransaction({
              transaction: tx,
              account,
            })

            success = true
            transactionsSent++
          } catch (error: any) {
            if (
              error?.code === 'NETWORK_ERROR' ||
              error?.message?.includes('underlying network changed') ||
              error?.message?.includes('network changed')
            ) {
              retries--
              if (retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000))

                const verifyChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
                if (verifyChainId !== data.chain.id) {
                  throw new Error(
                    `Network mismatch: expected ${data.chain.id}, got ${verifyChainId}`
                  )
                }

                contract = getContract({
                  client,
                  address: hookAddress,
                  abi: FeeHook.abi as any,
                  chain: data.chain,
                })
              } else {
                throw error
              }
            } else {
              throw error
            }
          }
        }
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
        setIsCheckedIn(true)
      } else {
        toast.error('No check-ins needed. You may already be checked in or have no vMOONEY.', {
          style: toastStyle,
        })
      }
    } catch (error) {
      console.error('Error checking in:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Error checking in: ${errorMessage}`, { style: toastStyle })
    }
  }

  const formatBalance = (balance: string | null, decimals: number = 4) => {
    return balance !== null ? Number(balance).toFixed(decimals) : '0'
  }

  const formatUSD = (ethAmount: string | null, ethPrice: number | undefined) => {
    if (!ethAmount || !ethPrice) return '0'
    return (Number(ethAmount) * ethPrice).toFixed(2)
  }

  return (
    <div className="relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">Weekly Reward Pool</h3>
        </div>

        {/* Pool Stats Cards */}
        <div className="space-y-4 mb-5">
          {/* Total Pool Card */}
          <div className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-xl p-4 hover:bg-white/12 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
                </svg>
              </div>
              <span className="text-white/70 font-medium text-sm">Total Pool</span>
            </div>
            {feesAvailable !== null ? (
              <div>
                <div className="text-white font-bold text-2xl mb-1">
                  {formatBalance(feesAvailable, 4)}
                </div>
                <div className="text-blue-300 text-sm">
                  ~${formatUSD(feesAvailable, currentEthPrice)} USD
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <LoadingSpinner width="w-4" height="h-4" />
                <span className="text-white/70 text-sm">Loading...</span>
              </div>
            )}
          </div>

          {/* User Reward Card */}
          <div className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-xl p-4 hover:bg-white/12 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <GiftIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/70 font-medium text-sm">Your Reward</span>
            </div>
            {address && VMOONEYBalance && VMOONEYBalance > 0 ? (
              estimatedFees !== null ? (
                <div>
                  <div className="text-white font-bold text-2xl mb-1">
                    {formatBalance(estimatedFees, 6)}
                  </div>
                  <div className="text-purple-300 text-sm">
                    ~${formatUSD(estimatedFees, currentEthPrice)} USD
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LoadingSpinner width="w-4" height="h-4" />
                  <span className="text-white/70 text-sm">Calculating...</span>
                </div>
              )
            ) : (
              <div>
                <div className="text-orange-300 text-lg font-bold mb-1">Need vMOONEY</div>
                <div className="text-white/60 text-sm">Lock MOONEY first</div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        {feesAvailable !== null && Number(feesAvailable) > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrophyIcon className="w-4 h-4 text-yellow-400" />
                <span className="text-white/80 text-sm">
                  {checkedInCount !== null
                    ? checkedInCount > 0
                      ? `${checkedInCount} participants this week`
                      : 'Be the first to participate!'
                    : 'Loading participants...'}
                </span>
              </div>
              {checkedInCount !== null && checkedInCount > 0 && (
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, checkedInCount))].map((_, i) => (
                    <div key={i} className="w-2.5 h-2.5 bg-yellow-400 rounded-full"></div>
                  ))}
                  {checkedInCount > 5 && (
                    <span className="text-xs text-yellow-400 ml-1 font-medium">
                      +{checkedInCount - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="space-y-4">
          {!address || (VMOONEYBalance && VMOONEYBalance > 0) ? (
            <PrivyWeb3Button
              label={isCheckedIn ? 'Already Checked In' : 'Check In & Claim Reward'}
              action={handleCheckIn}
              isDisabled={isCheckedIn}
              className={`w-full py-4 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.01] shadow-lg whitespace-nowrap ${
                isCheckedIn
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 cursor-not-allowed shadow-green-500/25'
                  : 'bg-gradient-to-r from-blue-500 via-purple-600 to-pink-600 hover:from-blue-600 hover:via-purple-700 hover:to-pink-700 shadow-purple-500/25'
              }`}
              requiredChain={ethereum}
            />
          ) : (
            <Link
              href="/lock"
              className="block w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-300 text-center shadow-lg shadow-orange-500/25 transform hover:scale-[1.01]"
            >
              🔒 Get vMOONEY
            </Link>
          )}

          {/* Learn More */}
          <div className="text-center">
            <Link
              href="/fees"
              className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 transition-colors duration-200 group"
            >
              <span>Learn about rewards</span>
              <svg
                className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
