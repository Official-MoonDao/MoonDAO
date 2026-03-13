import VotesTableABI from 'const/abis/Votes.json'
import {
  CITIZEN_TABLE_NAMES,
  OVERVIEW_DELEGATION_VOTE_ID,
  OVERVIEW_TOKEN_ADDRESS,
  OVERVIEW_TOKEN_DECIMALS,
  VOTES_TABLE_ADDRESSES,
  VOTES_TABLE_NAMES,
} from 'const/config'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { arbitrum } from '@/lib/rpc/chains'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { engineBatchRead } from '@/lib/thirdweb/engine'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
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
  displayName: string
}

type LeaderboardEntry = {
  delegateeAddress: string
  citizenId: number
  citizenName: string
  citizenImage?: string
  totalDelegated: number
  delegatorCount: number
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
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const votesContract = useContract({
    address: VOTES_TABLE_ADDRESSES[overviewChainSlug],
    chain: overviewChain,
    abi: VotesTableABI.abi as any,
  })

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
          `/api/citizens/search?q=${encodeURIComponent(value)}`
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

    const delegateAmount = Math.floor(userBalance)
    setIsSubmitting(true)
    const vote = JSON.stringify({ [selectedCitizen.owner]: delegateAmount })

    try {
      try {
        const tx = prepareContractCall({
          contract: votesContract,
          method: 'insertIntoTable' as string,
          params: [OVERVIEW_DELEGATION_VOTE_ID, vote],
        })
        await sendAndConfirmTransaction({ transaction: tx, account })
      } catch {
        const tx = prepareContractCall({
          contract: votesContract,
          method: 'updateTableCol' as string,
          params: [OVERVIEW_DELEGATION_VOTE_ID, vote],
        })
        await sendAndConfirmTransaction({ transaction: tx, account })
      }
      toast.success('Delegation submitted!', { style: toastStyle })
      setTimeout(() => router.reload(), 5000)
    } catch (error) {
      console.error('Error submitting delegation:', error)
      toast.error('Failed to submit delegation. Please try again.', {
        style: toastStyle,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="overflow-hidden">
      <Head
        title="Delegate $OVERVIEW"
        description="Delegate your $OVERVIEW tokens to a MoonDAO citizen and help them climb the leaderboard."
      />
      <Container>
        <ContentLayout
          header="Delegate $OVERVIEW"
          description="Delegate your full $OVERVIEW balance to a MoonDAO citizen. The leaderboard ranks citizens by total delegated tokens, capped at each delegator's current balance."
          headerSize="max(20px, 3vw)"
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="flex flex-col gap-8 w-full max-w-[900px] mx-auto">
            {/* Delegation Form */}
            <div className="p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <h2 className="text-xl font-GoodTimes text-white mb-6">
                Delegate Tokens
              </h2>

              {/* Balance */}
              <div className="mb-6 bg-black/20 border border-white/10 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Your $OVERVIEW Balance</p>
                <p className="text-white text-2xl font-semibold">
                  {userAddress
                    ? userBalance != null
                      ? userBalance.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })
                      : '...'
                    : 'Connect wallet'}
                </p>
              </div>

              {/* Citizen Search */}
              <div className="mb-4 relative" ref={dropdownRef}>
                <label className="block text-sm font-medium text-white mb-2">
                  Search Citizen
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search by name or token ID..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0"
                      >
                        <div className="text-white font-medium">
                          {citizen.displayName}
                        </div>
                        <div className="text-gray-400 text-sm truncate">
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
                      <div className="text-gray-400 text-center">
                        No citizens found
                      </div>
                    </div>
                  )}
              </div>

              {/* Selected Citizen */}
              {selectedCitizen && (
                <div className="mb-4 bg-white/5 border border-white/20 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">
                      {selectedCitizen.displayName}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {selectedCitizen.owner}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCitizen(null)
                      setSearchQuery('')
                    }}
                    className="text-gray-400 hover:text-white transition-colors text-xl"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Submit */}
              <PrivyWeb3Button
                label={isSubmitting ? 'Submitting...' : 'Delegate All $OVERVIEW'}
                action={handleSubmit}
                requiredChain={overviewChain}
                isDisabled={
                  isSubmitting ||
                  !selectedCitizen ||
                  !userBalance ||
                  userBalance <= 0
                }
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border-0 disabled:opacity-50"
              />
            </div>

            {/* Leaderboard */}
            <div className="p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <h2 className="text-xl font-GoodTimes text-white mb-6">
                Leaderboard
              </h2>

              {leaderboard.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No delegations yet. Be the first!
                </p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry, index) => {
                    const citizenLink = entry.citizenName
                      ? `/citizen/${generatePrettyLinkWithId(entry.citizenName, entry.citizenId)}`
                      : `/citizen/${entry.citizenId}`

                    return (
                      <div
                        key={entry.delegateeAddress}
                        className="flex items-center gap-4 p-4 bg-black/20 border border-white/10 rounded-xl"
                      >
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white font-bold text-sm">
                          {index + 1}
                        </div>

                        {entry.citizenImage && (
                          <img
                            src={entry.citizenImage}
                            alt={entry.citizenName}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <Link
                            href={citizenLink}
                            className="text-white font-medium hover:underline truncate block"
                          >
                            {entry.citizenName || `Citizen #${entry.citizenId}`}
                          </Link>
                          <p className="text-gray-400 text-sm">
                            {entry.delegatorCount} delegator
                            {entry.delegatorCount !== 1 ? 's' : ''}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-white font-semibold">
                            {entry.totalDelegated.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-gray-400 text-sm">$OVERVIEW</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </ContentLayout>
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

    // Parse delegations
    type ParsedDelegation = {
      delegatorAddress: string
      delegateeAddress: string
      storedAmount: number
    }

    const delegations: ParsedDelegation[] = []
    for (const row of rows) {
      try {
        const vote =
          typeof row.vote === 'string' ? JSON.parse(row.vote) : row.vote
        const entries = Object.entries(vote)
        if (entries.length > 0) {
          const [delegateeAddress, amount] = entries[0]
          delegations.push({
            delegatorAddress: row.address,
            delegateeAddress,
            storedAmount: Number(amount) || 0,
          })
        }
      } catch {
        continue
      }
    }

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
        balanceMap[uniqueDelegators[i].toLowerCase()] =
          Number(wei) / 10 ** OVERVIEW_TOKEN_DECIMALS
      }
    } catch (error) {
      console.error('Error fetching balances, using stored amounts:', error)
      for (const addr of uniqueDelegators) {
        balanceMap[addr.toLowerCase()] = Infinity
      }
    }

    // 3. Compute leaderboard
    const aggregated: Record<
      string,
      { totalDelegated: number; delegatorCount: number }
    > = {}

    for (const d of delegations) {
      const currentBalance =
        balanceMap[d.delegatorAddress.toLowerCase()] ?? 0
      const effective = Math.min(d.storedAmount, currentBalance)
      if (effective <= 0) continue

      const key = d.delegateeAddress.toLowerCase()
      if (!aggregated[key]) {
        aggregated[key] = { totalDelegated: 0, delegatorCount: 0 }
      }
      aggregated[key].totalDelegated += effective
      aggregated[key].delegatorCount += 1
    }

    // 4. Enrich with citizen data
    const delegateeAddresses = Object.keys(aggregated)
    if (delegateeAddresses.length === 0) {
      return {
        props: { leaderboard: [], tokenAddress },
        revalidate: 60,
      }
    }

    const isValidHex = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s)
    const safeAddresses = delegateeAddresses.filter(isValidHex)

    let citizenMap: Record<
      string,
      { id: number; name: string; image?: string }
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

    const leaderboard: LeaderboardEntry[] = []
    for (const [addr, data] of Object.entries(aggregated)) {
      const citizen = citizenMap[addr]
      if (!citizen) continue
      leaderboard.push({
        delegateeAddress: addr,
        citizenId: citizen.id,
        citizenName: citizen.name || '',
        citizenImage: citizen.image,
        totalDelegated: Math.round(data.totalDelegated * 100) / 100,
        delegatorCount: data.delegatorCount,
      })
    }

    leaderboard.sort((a, b) => b.totalDelegated - a.totalDelegated)

    return {
      props: { leaderboard, tokenAddress },
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
