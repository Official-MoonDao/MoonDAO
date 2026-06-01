import { GiftIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import confetti from 'canvas-confetti'
import ERC20ABI from 'const/abis/ERC20.json'
import FeeHook from 'const/abis/FeeHook.json'
import { FEE_HOOK_ADDRESSES } from 'const/config'
import { BigNumber } from 'ethers'
import { ethers } from 'ethers'
import Link from 'next/link'
import { useContext, useState, useEffect, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import { getContract, readContract, prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { useActiveAccount } from 'thirdweb/react'
import {
  arbitrum,
  base,
  ethereum,
  sepolia,
  arbitrumSepolia,
  Chain,
} from '@/lib/rpc/chains'
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * `readContract` occasionally fails with
 * `TypeError: Cannot read properties of undefined (reading 'buffer')` when
 * the underlying RPC returns a malformed/empty response (typically Infura
 * batch hiccups). Retry on that specific failure mode so a transient blip
 * on a single chain (most often Arbitrum) doesn't drop its row from the
 * weekly reward pool data — that was the root cause of the dashboard
 * showing "0 check-ins" while the user was actually checked in.
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
  }, [address, chains, WEEK])

  // Reusable on-chain status loader. Exposed as a callback so it can be
  // re-run after a check-in to reconcile the UI with the real on-chain state
  // (the txs are already confirmed at that point, so lastCheckIn is updated).
  const refreshFeeData = useCallback(async () => {
    if (!address) return

    // Each chain is fetched independently. A single chain failure (e.g.
    // public RPC hiccup or rate limit) used to reject the whole Promise.all
    // and leave `feeData` empty, which surfaced as "No fee data available"
    // when the user tried to check in. Isolate failures per-chain so the
    // remaining chains still populate.
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

            // Drop the chain only if the truly required reads are missing
            // after retries. Previously a single rejected read would null
            // out the whole chain, which is what was making Arbitrum's
            // check-in count silently disappear.
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

      const results = raw.filter((r) => r) as Array<{
        chain: any
        slug: string
        contract: any
        start: bigint
        last: bigint
        count: bigint
        vMooneyBalance: bigint
        hasVMooney: boolean
        checkedInOnChain: boolean
      }>

      setFeeData(results)

      // Only chains where the user actually holds vMOONEY are eligible for
      // check-in (the FeeHook reverts otherwise). The "checked in" state
      // should therefore only consider those chains; otherwise a user who
      // has vMOONEY on one chain (e.g. Arbitrum) and is already checked in
      // there would be incorrectly shown as "not checked in" because they
      // have a 0 balance on the other chains.
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
  }, [address, chains, WEEK])

  useEffect(() => {
    refreshFeeData()
  }, [refreshFeeData])

  // Keep the button's checked-in state in sync with feeData. This covers both
  // the initial on-chain load and the optimistic update applied right after a
  // successful check-in, so the button reliably flips to "Checked In ✓"
  // without depending on the exact tx/skip counts inside handleCheckIn.
  useEffect(() => {
    if (!feeData || feeData.length === 0) return
    const eligibleChains = feeData.filter((d) => d.hasVMooney)
    const allChecked =
      eligibleChains.length > 0 &&
      eligibleChains.every((d) => d.checkedInOnChain)
    setIsCheckedIn(allChecked)
  }, [feeData])

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
      let alreadyCheckedInCount = 0
      let eligibleChainsCount = 0
      // Chains the user is confirmed checked in on after this run (either they
      // already were, or we just submitted). Used to optimistically update
      // feeData so re-clicking the button doesn't re-broadcast no-op txs.
      const checkedInChainIds = new Set<number>()
      // Capture the most useful failure reason so we can show the user what
      // actually went wrong instead of a generic "please try again".
      let lastError: string | null = null

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

      // Robustly switch the wallet to a target chain. Injected wallets (e.g.
      // MetaMask) pop a confirmation the user has to approve, so we (a) give a
      // generous window for that, (b) retry the request a couple of times, and
      // (c) report WHY it failed (user rejected vs. timed out) so the toast is
      // actionable. Returns true only once the wallet actually reports the
      // target chain.
      const switchToChain = async (chain: any): Promise<boolean> => {
        const alreadyOn = () =>
          +wallets[selectedWallet]?.chainId?.split(':')[1] === chain.id
        if (alreadyOn()) return true

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await wallets[selectedWallet].switchChain(chain.id)
            setSelectedChain(chain)
          } catch (err: any) {
            // 4001 / ACTION_REJECTED = user dismissed the wallet prompt.
            if (
              err?.code === 4001 ||
              err?.code === 'ACTION_REJECTED' ||
              err?.message?.toLowerCase().includes('reject') ||
              err?.message?.toLowerCase().includes('denied')
            ) {
              lastError = `You declined the network switch to ${chain.name}. Approve it in your wallet to check in there.`
              return false
            }
            console.warn(`switchChain to ${chain.name} threw:`, err)
          }
          // Wait up to 20s for the wallet to report the new chain (covers the
          // time the user spends approving the MetaMask popup).
          if (await waitForChainSwitch(chain.id, 20000)) {
            await new Promise((resolve) => setTimeout(resolve, 500))
            return true
          }
        }
        lastError = `Could not switch your wallet to ${chain.name}. Open your wallet, switch to ${chain.name} manually, then press Check In again.`
        return false
      }

      // Build a thirdweb account from the Privy wallet's CURRENT ethers
      // provider. The `account` returned by useActiveAccount() is bound (via
      // ethers5Adapter) to whatever chain was selected when the component
      // rendered. Reusing it after switching chains makes ethers v5 throw
      // `underlying network changed` because the signer's cached network no
      // longer matches the wallet's actual chain. Re-deriving the signer (and
      // therefore its provider) after every switch keeps them in lockstep.
      const getAccountForChain = async () => {
        try {
          const wallet = wallets[selectedWallet]
          const provider = await wallet?.getEthersProvider()
          const signer = provider?.getSigner()
          if (!signer) return account
          return await ethers5Adapter.signer.fromEthers({ signer })
        } catch (err) {
          console.warn('Failed to derive fresh account, falling back to active account:', err)
          return account
        }
      }

      for (const data of feeData) {
        if (!data.vMooneyBalance || data.vMooneyBalance === BigInt(0)) {
          continue
        }
        eligibleChainsCount++
        if (data.checkedInOnChain) {
          alreadyCheckedInCount++
          checkedInChainIds.add(data.chain.id)
          continue
        }

        const walletChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
        if (walletChainId !== data.chain.id) {
          const switched = await switchToChain(data.chain)
          if (!switched) continue
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

        // Derive an account whose underlying ethers provider is on the chain
        // we just switched to. Using the stale `account` here is what produced
        // the `underlying network changed` error on check-in.
        let txAccount = await getAccountForChain()

        // The ONLY source of truth for "did the check-in happen" is the
        // on-chain state: lastCheckIn[address] === weekStart. Never trust the
        // tx promise (or a nonce collision) on its own — a tx that looked
        // confirmed but never landed previously produced a false "checked in"
        // toast while nothing changed on-chain.
        const verifyCheckedIn = async () => {
          for (let i = 0; i < 3; i++) {
            try {
              const [ws, lc] = await Promise.all([
                readContract({ contract, method: 'weekStart', params: [] }),
                readContract({
                  contract,
                  method: 'lastCheckIn',
                  params: [address],
                }),
              ])
              if (ws != null && lc != null) {
                return BigInt(lc as any) === BigInt(ws as any)
              }
            } catch (err) {
              console.warn(`verify lastCheckIn failed for ${slug}:`, err)
            }
            await new Promise((r) => setTimeout(r, 800))
          }
          return false
        }

        while (retries > 0 && !success) {
          retries--
          try {
            const tx = prepareContractCall({
              contract,
              method: 'checkIn' as string,
              params: [],
            })

            await sendAndConfirmTransaction({
              transaction: tx,
              account: txAccount,
            })
          } catch (error: any) {
            const isNonceUsed =
              error?.code === 'NONCE_EXPIRED' ||
              error?.message?.includes('nonce has already been used') ||
              error?.message?.includes('nonce too low')
            const isNetworkChanged =
              error?.code === 'NETWORK_ERROR' ||
              error?.message?.includes('underlying network changed') ||
              error?.message?.includes('network changed')

            // For a nonce collision we don't retry the send — instead we fall
            // through to on-chain verification below, which decides whether it
            // actually counts. For a network-changed error we rebuild the
            // contract/account and let the while loop re-send.
            if (isNetworkChanged && retries > 0) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
              const verifyChainId = +wallets[selectedWallet]?.chainId?.split(':')[1]
              if (verifyChainId !== data.chain.id) {
                console.warn(
                  `Network mismatch on ${slug}: expected ${data.chain.id}, got ${verifyChainId}`
                )
                break
              }
              contract = getContract({
                client,
                address: hookAddress,
                abi: FeeHook.abi as any,
                chain: data.chain,
              })
              txAccount = await getAccountForChain()
            } else if (!isNonceUsed && !isNetworkChanged) {
              // Genuine, unexpected failure on this chain. Don't abort the
              // whole loop — move on so other chains still get a chance.
              console.error(`Check-in failed for ${slug}:`, error)
              lastError =
                error?.shortMessage || error?.message || 'Transaction failed'
              break
            }
          }

          // Regardless of what the send did, only a verified on-chain state
          // counts as a successful check-in.
          if (await verifyCheckedIn()) {
            success = true
            transactionsSent++
            checkedInChainIds.add(data.chain.id)
            lastError = null
          } else if (retries === 0 && !lastError) {
            // The send didn't throw, but the on-chain state never flipped.
            // This usually means the tx silently failed or was sent on the
            // wrong network. Record it so the user sees something actionable.
            lastError = `Your ${data.chain.name} check-in transaction did not register on-chain. Make sure your wallet is on ${data.chain.name} and try again.`
          }
        }
      }

      // Optimistically mark the chains we just checked in on so the button
      // disables and a second click doesn't re-broadcast no-op transactions
      // (the on-chain checkIn() is idempotent, so re-sending only produces a
      // "No changes" wallet prompt that confuses users).
      if (checkedInChainIds.size > 0) {
        setFeeData((prev) =>
          prev.map((d) =>
            checkedInChainIds.has(d.chain.id)
              ? { ...d, checkedInOnChain: true }
              : d
          )
        )
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
          "You're already checked in for this week. Rewards are distributed automatically each week.",
          { style: toastStyle }
        )
        setIsCheckedIn(true)
      } else {
        toast.error(
          lastError
            ? `Error checking in: ${lastError}`
            : 'No check-ins were submitted. Please try again.',
          { style: toastStyle }
        )
      }
    } catch (error) {
      console.error('Error checking in:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Error checking in: ${errorMessage}`, { style: toastStyle })
    } finally {
      // Reconcile the UI with the real on-chain state. The check-in txs are
      // confirmed by this point, so lastCheckIn is updated on-chain. A short
      // delay gives the RPC a moment to propagate before we re-read.
      setTimeout(() => {
        refreshFeeData()
      }, 1500)
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
    <div className="relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 h-full">
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">Weekly Reward Pool</h3>
        </div>

        {/* Your Reward - simplified */}
        <div className="flex items-center justify-between bg-white/5 rounded-xl p-4 mb-5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <GiftIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white/60 text-sm block">Your Reward</span>
              {address && VMOONEYBalance && VMOONEYBalance > 0 ? (
                estimatedFees !== null ? (
                  <div>
                    <span className="text-white font-bold text-lg">
                      {formatBalance(estimatedFees, 4)} ETH
                    </span>
                    <span className="text-purple-300 text-xs block mt-0.5">
                      ~${formatUSD(estimatedFees, currentEthPrice)}
                    </span>
                  </div>
                ) : (
                  <span className="text-white/60 text-sm">Calculating...</span>
                )
              ) : (
                <span className="text-orange-300 font-medium">Lock MOONEY to earn</span>
              )}
            </div>
          </div>
          {address && VMOONEYBalance && VMOONEYBalance > 0 && estimatedFees === null && (
            <LoadingSpinner width="w-4" height="h-4" />
          )}
        </div>

        {/* Action Button */}
        <div className="space-y-4">
          {!address || (VMOONEYBalance && VMOONEYBalance > 0) ? (
            <div className="space-y-2">
              <PrivyWeb3Button
                label={isCheckedIn ? 'Checked In ✓' : 'Check In This Week'}
                action={handleCheckIn}
                isDisabled={isCheckedIn}
                className={`w-full py-4 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.01] shadow-lg truncate ${
                  isCheckedIn
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 cursor-not-allowed shadow-green-500/25'
                    : 'bg-gradient-to-r from-blue-500 via-purple-600 to-pink-600 hover:from-blue-600 hover:via-purple-700 hover:to-pink-700 shadow-purple-500/25'
                }`}
              />
              {isCheckedIn && (
                <p className="text-center text-xs text-green-300/80">
                  Rewards auto-distribute weekly
                </p>
              )}
            </div>
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
            <div className="relative inline-block group">
              <Link
                href="/fees"
                aria-describedby="reward-tooltip"
                className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200 transition-colors duration-200"
              >
                <span>Learn about rewards</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Link>
              <div
                id="reward-tooltip"
                role="tooltip"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-gray-900 border border-white/20 rounded-xl p-4 text-left shadow-2xl z-50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200"
              >
                <p className="text-white font-semibold text-sm mb-2">How Weekly Rewards Work</p>
                <ul className="text-white/70 text-xs space-y-1.5">
                  <li>• Lock MOONEY to earn vMOONEY voting power</li>
                  <li>• Protocol fees are collected each week from MoonDAO activity</li>
                  <li>• Rewards are distributed proportionally to vMOONEY holders</li>
                  <li>• More vMOONEY = a larger share of the weekly pool</li>
                  <li>• Check in weekly to claim your portion</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
