import confetti from 'canvas-confetti'
import VotesTableABI from 'const/abis/Votes.json'
import {
  CITIZEN_TABLE_NAMES,
  OVERVIEW_BLOCKED_CITIZEN_IDS,
  OVERVIEW_DELEGATION_VOTE_ID,
  OVERVIEW_TOKEN_ADDRESS,
  OVERVIEW_TOKEN_DECIMALS,
  TABLELAND_ENDPOINT,
  VOTES_TABLE_ADDRESSES,
  VOTES_TABLE_NAMES,
} from 'const/config'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { getAccessToken } from '@privy-io/react-auth'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { formatUnits } from 'ethers'
import {
  applyOptimisticUpdate,
  isValidEthAddress,
  parseDelegations,
  aggregateDelegations,
  buildLeaderboard,
} from '@/lib/overview-delegate/leaderboard'
import type { LeaderboardEntry } from '@/lib/overview-delegate/leaderboard'
import { arbitrum } from '@/lib/rpc/chains'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { engineBatchRead } from '@/lib/thirdweb/engine'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import Container from '@/components/layout/Container'
import Head from '@/components/layout/Head'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

const ERC20_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]

type Citizen = {
  id: string
  name: string
  owner: string
  image?: string
  displayName: string
}

type OverviewDelegateProps = {
  leaderboard: LeaderboardEntry[]
  tokenAddress: string
}

export default function OverviewDelegate({
  leaderboard,
  tokenAddress,
}: OverviewDelegateProps) {
  const router = useRouter()
  const overviewChain = arbitrum
  const overviewChainSlug = getChainSlug(overviewChain)
  const account = useActiveAccount()
  const userAddress = account?.address

  const userBalance = useWatchTokenBalance(overviewChain, tokenAddress)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Citizen[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasExistingDelegation, setHasExistingDelegation] = useState(false)
  const [previousDelegation, setPreviousDelegation] = useState<{
    delegatee: string
    amount: number
    citizenName?: string
    citizenImage?: string
    citizenId?: string | number
  } | null>(null)
  const [displayLeaderboard, setDisplayLeaderboard] = useState(leaderboard)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDisplayLeaderboard(leaderboard)
  }, [leaderboard])

  const votesContract = useContract({
    address: VOTES_TABLE_ADDRESSES[overviewChainSlug],
    chain: overviewChain,
    abi: VotesTableABI.abi as any,
  })

  const votesTableName = VOTES_TABLE_NAMES[overviewChainSlug]

  useEffect(() => {
    if (!userAddress || !votesTableName) return
    const checkExisting = async () => {
      try {
        const stmt = `SELECT * FROM ${votesTableName} WHERE voteId = ${OVERVIEW_DELEGATION_VOTE_ID} AND address = '${userAddress.toLowerCase()}'`
        const res = await fetch(
          `https://tableland.network/api/v1/query?statement=${encodeURIComponent(stmt)}`
        )
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setHasExistingDelegation(true)
            try {
              const vote =
                typeof data[0].vote === 'string'
                  ? JSON.parse(data[0].vote)
                  : data[0].vote
              const entries = Object.entries(vote)
              if (entries.length > 0) {
                const [delegatee, amount] = entries[0]
                const delegateeLower = delegatee.toLowerCase()

                const match = leaderboard.find(
                  (e) => e.delegateeAddress.toLowerCase() === delegateeLower
                )

                let citizenName: string | undefined
                let citizenImage: string | undefined
                let citizenId: string | number | undefined

                if (match) {
                  citizenName = match.citizenName
                  citizenImage = match.citizenImage
                  citizenId = match.citizenId
                } else {
                  try {
                    const citizenTableName =
                      CITIZEN_TABLE_NAMES[overviewChainSlug]
                    if (citizenTableName) {
                      const citizenStmt = `SELECT id, name, image FROM ${citizenTableName} WHERE LOWER(owner) = '${delegateeLower}'`
                      const citizenRes = await fetch(
                        `${TABLELAND_ENDPOINT}/api/v1/query?statement=${encodeURIComponent(citizenStmt)}`
                      )
                      if (citizenRes.ok) {
                        const citizenData = await citizenRes.json()
                        if (
                          Array.isArray(citizenData) &&
                          citizenData.length > 0
                        ) {
                          citizenName = citizenData[0].name
                          citizenImage = citizenData[0].image
                          citizenId = citizenData[0].id
                        }
                      }
                    }
                  } catch {}
                }

                setPreviousDelegation({
                  delegatee: delegateeLower,
                  amount: Number(amount) || 0,
                  citizenName,
                  citizenImage,
                  citizenId,
                })
              }
            } catch {}
          } else {
            setHasExistingDelegation(false)
          }
        }
      } catch {
        setHasExistingDelegation(false)
      }
    }
    checkExisting()
  }, [userAddress, votesTableName, leaderboard, overviewChainSlug])

  // Citizen search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedCitizen(null)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      const isNumeric = /^\d+$/.test(value.trim())
      if (!isNumeric && value.length < 2) {
        setSearchResults([])
        setShowDropdown(false)
        return
      }
      if (!value.trim()) {
        setSearchResults([])
        setShowDropdown(false)
        return
      }
      setIsSearching(true)
      try {
        const res = await fetch(
          `/api/citizens/search?q=${encodeURIComponent(value)}&chain=arbitrum`
        )
        const data = await res.json()
        if (res.ok) {
          setSearchResults(data.citizens || [])
          setShowDropdown(true)
        } else {
          setSearchResults([])
          setShowDropdown(false)
        }
      } catch {
        setSearchResults([])
        setShowDropdown(false)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  const handleCitizenSelect = (citizen: Citizen) => {
    setSelectedCitizen(citizen)
    setSearchQuery(citizen.displayName)
    setShowDropdown(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  const handleSubmit = async () => {
    if (!account) return
    if (!selectedCitizen) {
      toast.error('Please select a citizen.', { style: toastStyle })
      return
    }
    if (!userBalance || userBalance <= 0) {
      toast.error('You have no $OVERVIEW tokens to delegate.', {
        style: toastStyle,
      })
      return
    }
    if (!votesContract) {
      toast.error('Voting contract is not ready yet. Please wait a moment and try again.', {
        style: toastStyle,
      })
      return
    }

    const delegateAmount = Math.floor(userBalance)
    if (delegateAmount <= 0) {
      toast.error('You do not have enough $OVERVIEW tokens to delegate.', {
        style: toastStyle,
      })
      return
    }
    setIsSubmitting(true)
    const vote = JSON.stringify({ [selectedCitizen.owner]: delegateAmount })

    try {
      const method = hasExistingDelegation ? 'updateTableCol' : 'insertIntoTable'
      const tx = prepareContractCall({
        contract: votesContract,
        method: method as string,
        params: [OVERVIEW_DELEGATION_VOTE_ID, vote],
      })
      const receipt: any = await sendAndConfirmTransaction({ transaction: tx, account })
      setHasExistingDelegation(true)

      // Send Discord notification (fire-and-forget)
      getAccessToken().then((accessToken) => {
        fetch('/api/overview/leaderboard-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: receipt.transactionHash,
            accessToken,
            delegateeAddress: selectedCitizen.owner,
          }),
        }).catch(() => {})
      }).catch(() => {})

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
      })
      toast.success('Delegation submitted!', { style: toastStyle })

      const updatedLeaderboard = applyOptimisticUpdate(
        displayLeaderboard,
        {
          delegateeAddress: selectedCitizen.owner.toLowerCase(),
          citizenId: selectedCitizen.id,
          citizenName: selectedCitizen.name || selectedCitizen.displayName,
          citizenImage: selectedCitizen.image,
          amount: delegateAmount,
        },
        previousDelegation,
        hasExistingDelegation
      )
      setDisplayLeaderboard(updatedLeaderboard)

      setPreviousDelegation({
        delegatee: selectedCitizen.owner.toLowerCase(),
        amount: delegateAmount,
        citizenName: selectedCitizen.name || selectedCitizen.displayName,
        citizenImage: selectedCitizen.image,
        citizenId: selectedCitizen.id,
      })

      // Poll for real data in background
      setIsRefreshing(true)
      const pollForUpdate = async (retries = 5) => {
        for (let i = 0; i < retries; i++) {
          await new Promise((r) => setTimeout(r, 4000 + i * 2000))
          try {
            await fetch('/api/revalidate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                secret: process.env.NEXT_PUBLIC_REVALIDATE_SECRET,
                path: '/overview-vote',
              }),
            })
            const res = await fetch('/overview-vote', {
              headers: { Accept: 'text/html' },
            })
            if (res.ok) {
              router.replace(router.asPath)
              break
            }
          } catch {}
        }
        setIsRefreshing(false)
      }
      pollForUpdate()
    } catch (error) {
      console.error('Error submitting delegation:', error)
      toast.error('Failed to submit delegation. Please try again.', {
        style: toastStyle,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fromMission = router?.query?.from === 'mission'
  const missionId = router?.query?.missionId as string | undefined
  const isOverviewMission = missionId === '4' || missionId === 4

  return (
    <section className="overflow-visible">
      <Head
        title="Fly to Space with Frank White"
        description="Help fund the mission to send Frank White to space. Earn $OVERVIEW tokens to vote for the citizen you want to fly alongside him."
      />
      <Container>
        <div className="w-full">
          <div className="flex flex-col gap-6 md:gap-8 w-full max-w-[900px] mx-auto px-4 md:px-6 lg:px-0 py-8 md:py-12">
            {/* Contextual banner when arriving from Overview mission (mission 4) contribution */}
            {fromMission && isOverviewMission && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 sm:p-5 flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-xl">✓</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-indigo-200 font-medium">
                    You contributed! Back a candidate to support the community.
                  </p>
                  <p className="text-indigo-300/80 text-sm mt-1">
                    Pledge your $OVERVIEW balance to your chosen candidate. Your tokens stay in your wallet — only your voting power is recorded.
                  </p>
                  {missionId && (
                    <Link
                      href={`/mission/${missionId}`}
                      className="inline-block mt-3 text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
                    >
                      ← Back to mission
                    </Link>
                  )}
                </div>
              </div>
            )}
            {/* Page Header */}
            <div className="pt-6 sm:pt-8">
              <h1 className="font-GoodTimes text-white leading-tight text-2xl sm:text-3xl md:text-4xl">
                Fly to Space with Frank White
              </h1>
              <p className="text-gray-300 text-sm sm:text-base mt-3 sm:mt-4 leading-relaxed">
                Help fund the mission to send Frank White to space. Earn $OVERVIEW tokens to help govern decision-making, including voting for the citizen you want to fly alongside him.
              </p>
            </div>
            {/* Delegation Form */}
            <div className="relative z-10 p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-visible">
              <h2 className="text-lg sm:text-xl font-GoodTimes text-white mb-2 sm:mb-3">
                Back a Candidate
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
                Pledge your $OVERVIEW balance to your chosen candidate. Your tokens remain securely in your wallet. Only your voting power is recorded. You can only back one candidate, but you can change your vote at any time until the voting period ends or accrue more voting power.
              </p>

              {/* Balance */}
              <div className="mb-4 sm:mb-6 bg-black/20 border border-white/10 rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-gray-400 text-xs sm:text-sm">Your $OVERVIEW Balance</p>
                  <p className="text-white text-xl sm:text-2xl font-semibold">
                    {userAddress
                      ? userBalance != null && Number.isFinite(userBalance)
                        ? userBalance.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : '...'
                      : 'Connect wallet'}
                  </p>
                </div>
                <Link
                  href="/mission/4"
                  className="flex-shrink-0 px-3 sm:px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-xs sm:text-sm font-medium rounded-lg transition-colors"
                >
                  Get $OVERVIEW
                </Link>
              </div>

              {/* Current Vote */}
              {previousDelegation && (
                <div className="mb-4 sm:mb-6 bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 sm:p-4">
                  <p className="text-indigo-300 text-xs sm:text-sm font-medium mb-2">
                    Your Current Vote
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0">
                      {previousDelegation.citizenImage ? (
                        <IPFSRenderer
                          src={previousDelegation.citizenImage}
                          alt={previousDelegation.citizenName || 'Citizen'}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                          {previousDelegation.citizenName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {previousDelegation.citizenName ? (
                        <Link
                          href={
                            previousDelegation.citizenId
                              ? `/citizen/${generatePrettyLinkWithId(previousDelegation.citizenName, String(previousDelegation.citizenId))}`
                              : '#'
                          }
                          className="text-white text-sm sm:text-base font-medium hover:underline truncate block"
                        >
                          {previousDelegation.citizenName}
                        </Link>
                      ) : (
                        <p className="text-white text-sm sm:text-base font-medium truncate">
                          {previousDelegation.delegatee.slice(0, 6)}...{previousDelegation.delegatee.slice(-4)}
                        </p>
                      )}
                      <p className="text-gray-400 text-xs sm:text-sm">
                        {previousDelegation.amount.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{' '}
                        $OVERVIEW delegated
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Citizen Search */}
              <div className="mb-4 relative z-10" ref={dropdownRef}>
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <label className="text-xs sm:text-sm font-medium text-white">
                    Find a Citizen
                  </label>
                  <Link
                    href="/network"
                    className="text-xs sm:text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Browse Directory →
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search by name or citizen ID..."
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/20 rounded-xl text-sm sm:text-base text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {isSearching && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-white/20 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((citizen) => (
                      <button
                        key={citizen.id}
                        onClick={() => handleCitizenSelect(citizen)}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0"
                      >
                        <div className="text-white text-sm sm:text-base font-medium">
                          {citizen.displayName}
                        </div>
                        <div className="text-gray-400 text-xs sm:text-sm truncate">
                          {citizen.owner}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown &&
                  searchResults.length === 0 &&
                  searchQuery.trim().length >= 2 &&
                  !isSearching && (
                    <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-white/20 rounded-xl shadow-lg p-4">
                      <div className="text-gray-400 text-sm text-center">
                        No citizens found
                      </div>
                    </div>
                  )}
              </div>

              {/* Selected Citizen */}
              {selectedCitizen && (
                <div className="mb-4 bg-white/5 border border-white/20 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white text-sm sm:text-base font-medium truncate">
                      {selectedCitizen.displayName}
                    </div>
                    <div className="text-gray-400 text-xs sm:text-sm truncate">
                      {selectedCitizen.owner}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCitizen(null)
                      setSearchQuery('')
                    }}
                    className="flex-shrink-0 text-gray-400 hover:text-white transition-colors text-xl leading-none"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Submit */}
              <PrivyWeb3Button
                label={isSubmitting ? 'Submitting...' : 'Back This Candidate'}
                action={handleSubmit}
                requiredChain={overviewChain}
                isDisabled={
                  isSubmitting ||
                  !selectedCitizen ||
                  !userBalance ||
                  userBalance <= 0
                }
                className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border-0 disabled:opacity-50"
              />
            </div>

            {/* Leaderboard */}
            <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h2 className="text-lg sm:text-xl font-GoodTimes text-white">
                  Overview Flight Leaderboard
                </h2>
                {isRefreshing && (
                  <div className="flex items-center gap-2 text-indigo-400 text-xs sm:text-sm">
                    <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    Updating...
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
                The 25 citizens with the most $OVERVIEW support advance to Round 2.
              </p>

              {displayLeaderboard.length === 0 ? (
                <p className="text-gray-400 text-center py-6 sm:py-8 text-sm">
                  No delegations yet. Be the first to back a candidate!
                </p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {displayLeaderboard.slice(0, 25).map((entry, index) => {
                    const citizenLink = entry.citizenName
                      ? `/citizen/${generatePrettyLinkWithId(entry.citizenName, entry.citizenId)}`
                      : `/citizen/${entry.citizenId}`

                    return (
                      <div
                        key={entry.delegateeAddress}
                        className="flex items-center gap-2.5 sm:gap-4 p-3 sm:p-4 bg-black/20 border border-white/10 rounded-xl"
                      >
                        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/10 text-white font-bold text-xs sm:text-sm">
                          {index + 1}
                        </div>

                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden flex-shrink-0">
                          {entry.citizenImage ? (
                            <IPFSRenderer
                              src={entry.citizenImage}
                              alt={entry.citizenName || 'Citizen'}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                              {entry.citizenName?.[0]?.toUpperCase() || 'C'}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <Link
                            href={citizenLink}
                            className="text-white text-sm sm:text-base font-medium hover:underline truncate block"
                          >
                            {entry.citizenName || `Citizen #${entry.citizenId}`}
                          </Link>
                          <p className="text-gray-400 text-xs sm:text-sm">
                            {entry.delegatorCount} backer
                            {entry.delegatorCount !== 1 ? 's' : ''}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-white text-sm sm:text-base font-semibold">
                            {entry.totalDelegated.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-gray-400 text-xs sm:text-sm">$OVERVIEW</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Get $OVERVIEW CTA */}
              <Link
                href="/mission/4"
                className="group p-4 sm:p-6 bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border border-indigo-500/20 hover:border-indigo-400/40 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <div className="text-2xl sm:text-3xl mb-3">🚀</div>
                <h3 className="font-GoodTimes text-white text-sm sm:text-base mb-2">
                  Get $OVERVIEW Tokens
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                  Contribute to the spaceflight mission. Every contribution grants you $OVERVIEW so you can back a candidate. Contributions over $100 automatically include MoonDAO Citizenship.
                </p>
                <span className="inline-block mt-3 text-indigo-400 text-xs sm:text-sm font-medium group-hover:text-indigo-300 transition-colors">
                  Go to Mission &rarr;
                </span>
              </Link>

              {/* Want to Compete CTA */}
              <Link
                href="/citizen"
                className="group p-4 sm:p-6 bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border border-emerald-500/20 hover:border-emerald-400/40 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10"
              >
                <div className="text-2xl sm:text-3xl mb-3">🌍</div>
                <h3 className="font-GoodTimes text-white text-sm sm:text-base mb-2">
                  Want to Compete?
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                  Only MoonDAO Citizens are eligible for the leaderboard. Rally your network to back you and secure your spot in the top 25.
                </p>
                <span className="inline-block mt-3 text-emerald-400 text-xs sm:text-sm font-medium group-hover:text-emerald-300 transition-colors">
                  Become a Citizen &rarr;
                </span>
              </Link>
            </div>
          </div>
          <NoticeFooter />
        </div>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    const chain = arbitrum
    const chainSlug = getChainSlug(chain)
    const tokenAddress = OVERVIEW_TOKEN_ADDRESS

    // 1. Query delegations from Tableland
    const votesTableName = VOTES_TABLE_NAMES[chainSlug]
    if (!votesTableName) {
      return {
        props: { leaderboard: [], tokenAddress },
        revalidate: 60,
      }
    }

    const statement = `SELECT * FROM ${votesTableName} WHERE voteId = ${OVERVIEW_DELEGATION_VOTE_ID}`
    const rows = await queryTable(chain, statement)

    if (!rows || rows.length === 0) {
      return {
        props: { leaderboard: [], tokenAddress },
        revalidate: 60,
      }
    }

    const delegations = parseDelegations(rows)

    if (delegations.length === 0) {
      return {
        props: { leaderboard: [], tokenAddress },
        revalidate: 60,
      }
    }

    // 2. Batch-fetch current balances (anti-gaming)
    const uniqueDelegators = [...new Set(delegations.map((d) => d.delegatorAddress))]

    let balanceMap: Record<string, number> = {}
    try {
      const balances = await engineBatchRead<string>(
        tokenAddress,
        'balanceOf',
        uniqueDelegators.map((addr) => [addr]),
        ERC20_BALANCE_OF_ABI,
        chain.id
      )
      for (let i = 0; i < uniqueDelegators.length; i++) {
        const raw = balances[i]
        const wei = BigInt(raw || '0')
        const normalized = parseFloat(
          formatUnits(wei, OVERVIEW_TOKEN_DECIMALS)
        )
        balanceMap[uniqueDelegators[i].toLowerCase()] = normalized
      }
    } catch (error) {
      console.error('Error fetching balances, using stored amounts:', error)
      for (const addr of uniqueDelegators) {
        balanceMap[addr.toLowerCase()] = Infinity
      }
    }

    const aggregated = aggregateDelegations(delegations, balanceMap)

    if (aggregated.length === 0) {
      return {
        props: { leaderboard: [], tokenAddress },
        revalidate: 60,
      }
    }

    const safeAddresses = aggregated
      .map((e) => e.delegateeAddress)
      .filter(isValidEthAddress)

    let citizenMap: Record<
      string,
      { id: number | string; name: string; image?: string }
    > = {}

    if (safeAddresses.length > 0) {
      try {
        const citizenTableName = CITIZEN_TABLE_NAMES[chainSlug]
        if (citizenTableName) {
          const inClause = safeAddresses
            .map((a) => `'${a}'`)
            .join(',')
          const citizenStatement = `SELECT id, name, owner, image FROM ${citizenTableName} WHERE LOWER(owner) IN (${inClause})`
          const citizenRows = await queryTable(chain, citizenStatement)

          if (citizenRows) {
            for (const c of citizenRows) {
              if (OVERVIEW_BLOCKED_CITIZEN_IDS.includes(c.id)) continue
              citizenMap[c.owner.toLowerCase()] = {
                id: c.id,
                name: c.name,
                image: c.image,
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching citizen data:', error)
      }
    }

    const leaderboardResult = buildLeaderboard(aggregated, citizenMap, 25)

    return {
      props: { leaderboard: leaderboardResult, tokenAddress },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error in getStaticProps:', error)
    return {
      props: { leaderboard: [], tokenAddress: OVERVIEW_TOKEN_ADDRESS },
      revalidate: 60,
    }
  }
}
