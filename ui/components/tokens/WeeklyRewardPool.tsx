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
import {
  getContract,
  readContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from 'thirdweb'
import {
  arbitrum,
  base,
  sepolia,
  arbitrumSepolia,
  Chain,
} from 'thirdweb/chains'
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
    () => (isTestnet ? [sepolia, arbitrumSepolia] : [arbitrum, base]),
    [isTestnet]
  )

  const { selectedChain: contextSelectedChain, setSelectedChain } =
    useContext(ChainContextV5)
  const { data: currentEthPrice } = useETHPrice(1, 'ETH_TO_USD')
  const { selectedWallet } = useContext(PrivyWalletContext)

  const WEEK = 7 * 24 * 60 * 60

  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null)
  const [feesAvailable, setFeesAvailable] = useState<string | null>(null)
  const [estimatedFees, setEstimatedFees] = useState<string | null>(null)
  const [feeData, setFeeData] = useState<any[]>([])

  const VMOONEYBalance = useTotalVP(address || '')

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
                const rpcUrl = chain.rpc[0]
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
          .reduce(
            (acc, bal) => acc.add(bal || BigNumber.from(0)),
            BigNumber.from(0)
          )

        setFeesAvailable(
          ethers.utils.formatEther(totalFees || BigNumber.from(0))
        )
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
        ).reduce(
          (acc, est) => acc.add(est || BigNumber.from(0)),
          BigNumber.from(0)
        )

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

      for (const data of feeData) {
        if (data.checkedInOnChain) continue
        if (!data.vMooneyBalance || data.vMooneyBalance === BigInt(0)) {
          continue
        }

        if (contextSelectedChain.id !== data.chain.id) {
          await wallets[selectedWallet].switchChain(data.chain.id)
          setSelectedChain(data.chain)
        }

        const tx = prepareContractCall({
          contract: data.contract,
          method: 'checkIn' as string,
          params: [],
        })

        await sendAndConfirmTransaction({
          transaction: tx,
          account,
        })

        transactionsSent++
      }

      // Switch back to original chain
      if (currentChain.id !== contextSelectedChain.id) {
        await wallets[selectedWallet].switchChain(currentChain.id)
        setSelectedChain(currentChain)
      }

      if (transactionsSent > 0) {
        toast.success(
          `Checked in on ${transactionsSent} chain${
            transactionsSent > 1 ? 's' : ''
          }!`,
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
        toast.error(
          'No check-ins needed. You may already be checked in or have no vMOONEY.',
          { style: toastStyle }
        )
      }
    } catch (error) {
      console.error('Error checking in:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Error checking in: ${errorMessage}`, { style: toastStyle })
    }
  }

  const formatBalance = (balance: string | null, decimals: number = 4) => {
    return balance !== null ? Number(balance).toFixed(decimals) : '0'
  }

  const formatUSD = (
    ethAmount: string | null,
    ethPrice: number | undefined
  ) => {
    if (!ethAmount || !ethPrice) return '0'
    return (Number(ethAmount) * ethPrice).toFixed(2)
  }

  return (
    <Frame
      noPadding
      bottomLeft="20px"
      bottomRight="20px"
      topRight="0px"
      topLeft="10px"
      className="h-full"
    >
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-6 h-full flex flex-col justify-between">
        <h3 className="text-sm font-GoodTimes text-white/80">
          WEEKLY REWARD POOL
        </h3>

        {/* Main content area with flex-1 to fill space */}
        <div className="flex-1 flex flex-col justify-between">
          {/* Pool Stats - Side by Side */}
          <div className="mb-3 flex gap-4">
            {/* Total Pool */}
            <div className="flex-1 w-1/2">
              <p className="text-xs text-white/60 mb-1">Total Pool:</p>
              {feesAvailable !== null ? (
                <div className="text-white">
                  <span className="text-lg font-bold">
                    {formatBalance(feesAvailable)} ETH
                  </span>
                  <span className="text-sm text-white/70 ml-2">
                    (~${formatUSD(feesAvailable, currentEthPrice)})
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LoadingSpinner width="w-3" height="h-3" />
                  <span className="text-white/70 text-xs">Loading...</span>
                </div>
              )}
            </div>

            {/* User Rewards */}
            <div className="flex-1 w-1/2">
              <p className="text-xs text-white/60 mb-1">Your Reward:</p>
              {address && VMOONEYBalance && VMOONEYBalance > 0 ? (
                estimatedFees !== null ? (
                  <div className="text-white">
                    <span className="text-sm font-medium">
                      {formatBalance(estimatedFees, 6)} ETH
                    </span>
                    <span className="text-xs text-white/70 ml-2">
                      (~${formatUSD(estimatedFees, currentEthPrice)})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner width="w-3" height="h-3" />
                    <span className="text-white/70 text-xs">
                      Calculating...
                    </span>
                  </div>
                )
              ) : (
                <div className="text-white/50 text-sm">Need vMOONEY</div>
              )}
            </div>
          </div>

          {/* Check-in Stats */}
          {feesAvailable !== null && Number(feesAvailable) > 0 && (
            <div className="mb-3 text-xs text-white/60">
              {checkedInCount !== null
                ? checkedInCount > 0
                  ? `${checkedInCount} checked in this week`
                  : 'No one checked in yet'
                : 'Loading stats...'}
            </div>
          )}

          {/* Action Button */}
          {!address || (VMOONEYBalance && VMOONEYBalance > 0) ? (
            <PrivyWeb3Button
              label={isCheckedIn ? 'Checked In ✓' : 'Check In & Claim'}
              action={handleCheckIn}
              isDisabled={isCheckedIn}
              className={`w-full py-2 text-white text-sm rounded-lg font-medium transition-all duration-200 mb-2 ${
                isCheckedIn
                  ? 'bg-green-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
              }`}
            />
          ) : (
            <Link
              href="/lock"
              className="block w-full py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white text-sm rounded-lg font-medium transition-all duration-200 text-center mb-2"
            >
              Get vMOONEY to Claim
            </Link>
          )}

          {/* Learn More Link */}
          <div className="text-center">
            <Link
              href="/fees"
              className="text-xs text-blue-300 hover:text-blue-200"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </Frame>
  )
}
