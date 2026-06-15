import confetti from 'canvas-confetti'
import VotesTableABI from 'const/abis/Votes.json'
import {
  OVERVIEW_PATH_VOTE_DEADLINE,
  OVERVIEW_PATH_VOTE_ID,
  OVERVIEW_TOKEN_ADDRESS,
  TABLELAND_ENDPOINT,
  VOTES_TABLE_ADDRESSES,
  VOTES_TABLE_NAMES,
} from 'const/config'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import {
  emptyPathVoteResults,
  fetchPathVoteResults,
} from '@/lib/overview-path-vote/fetchResults'
import type { PathVoteResults } from '@/lib/overview-path-vote/fetchResults'
import {
  getPathVoteOption,
  isPathVoteOptionId,
  PATH_VOTE_AT_A_GLANCE,
  PATH_VOTE_DILIGENCE_AXES,
  PATH_VOTE_FINDINGS,
  PATH_VOTE_OPTIONS,
} from '@/lib/overview-path-vote/options'
import type { PathVoteOptionId } from '@/lib/overview-path-vote/options'
import { arbitrum } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import YouTubeEmbed from '@/components/townhall/YouTubeEmbed'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

type OverviewPathVoteProps = {
  voteResults: PathVoteResults
  tokenAddress: string
}

const OPTION_ACCENTS: Record<
  PathVoteOptionId,
  { border: string; bg: string; badge: string; bar: string }
> = {
  'option-a': {
    border: 'border-blue-400/60',
    bg: 'bg-blue-500/10',
    badge: 'bg-blue-500/20 text-blue-300',
    bar: 'bg-gradient-to-r from-blue-500 to-blue-400',
  },
  'option-b': {
    border: 'border-purple-400/60',
    bg: 'bg-purple-500/10',
    badge: 'bg-purple-500/20 text-purple-300',
    bar: 'bg-gradient-to-r from-purple-500 to-purple-400',
  },
  'option-c': {
    border: 'border-amber-400/60',
    bg: 'bg-amber-500/10',
    badge: 'bg-amber-500/20 text-amber-300',
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
  },
}

export default function OverviewPathVote({
  voteResults,
  tokenAddress,
}: OverviewPathVoteProps) {
  const router = useRouter()
  const overviewChain = arbitrum
  const overviewChainSlug = getChainSlug(overviewChain)
  const account = useActiveAccount()
  const userAddress = account?.address

  const userBalance = useWatchTokenBalance(overviewChain, tokenAddress)

  const [selectedOption, setSelectedOption] =
    useState<PathVoteOptionId | null>(null)
  const [expandedOption, setExpandedOption] =
    useState<PathVoteOptionId | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasExistingVote, setHasExistingVote] = useState(false)
  const [previousVote, setPreviousVote] = useState<{
    optionId: PathVoteOptionId
    amount: number
  } | null>(null)
  const [displayResults, setDisplayResults] = useState(voteResults)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setDisplayResults(voteResults)
  }, [voteResults])

  const deadline = OVERVIEW_PATH_VOTE_DEADLINE
    ? new Date(OVERVIEW_PATH_VOTE_DEADLINE)
    : null
  const votingClosed = deadline != null && Date.now() > deadline.getTime()

  const votesContract = useContract({
    address: VOTES_TABLE_ADDRESSES[overviewChainSlug],
    chain: overviewChain,
    abi: VotesTableABI.abi as any,
  })

  const votesTableName = VOTES_TABLE_NAMES[overviewChainSlug]

  // Load the connected wallet's existing vote (if any) so we can show it and
  // route the submit to updateTableCol instead of insertIntoTable.
  useEffect(() => {
    if (!userAddress || !votesTableName) {
      setHasExistingVote(false)
      setPreviousVote(null)
      return
    }
    const checkExisting = async () => {
      try {
        const stmt = `SELECT * FROM ${votesTableName} WHERE voteId = ${OVERVIEW_PATH_VOTE_ID} AND address = '${userAddress.toLowerCase()}'`
        const res = await fetch(
          `${TABLELAND_ENDPOINT}?statement=${encodeURIComponent(stmt)}`
        )
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setHasExistingVote(true)
            try {
              const vote =
                typeof data[0].vote === 'string'
                  ? JSON.parse(data[0].vote)
                  : data[0].vote
              const entries = Object.entries(vote)
              if (entries.length > 0) {
                const [optionId, amount] = entries[0]
                if (isPathVoteOptionId(optionId)) {
                  setPreviousVote({
                    optionId,
                    amount: Number(amount) || 0,
                  })
                  setSelectedOption(optionId)
                }
              }
            } catch {}
          } else {
            setHasExistingVote(false)
            setPreviousVote(null)
          }
        }
      } catch {
        setHasExistingVote(false)
      }
    }
    checkExisting()
  }, [userAddress, votesTableName])

  // Overlay the connected user's live balance onto the displayed tallies, so
  // the totals don't look stale relative to the balance shown right above
  // them (ISR revalidates every 60s; the balance hook is live).
  const visibleResults = useMemo(() => {
    if (
      !previousVote ||
      userBalance == null ||
      !Number.isFinite(userBalance) ||
      userBalance <= 0
    ) {
      return displayResults
    }
    const liveAmount = Math.floor(userBalance)
    const entry = displayResults.results.find(
      (r) => r.optionId === previousVote.optionId
    )
    if (!entry || entry.totalVoted >= liveAmount) return displayResults

    const userServerContribution = Math.min(
      entry.totalVoted,
      previousVote.amount
    )
    const adjustedResults = displayResults.results.map((r) =>
      r.optionId === previousVote.optionId
        ? {
            ...r,
            totalVoted: Math.max(
              0,
              r.totalVoted - userServerContribution + liveAmount
            ),
          }
        : r
    )
    const totalVoted = adjustedResults.reduce((s, r) => s + r.totalVoted, 0)
    return {
      ...displayResults,
      results: adjustedResults.map((r) => ({
        ...r,
        percentage:
          totalVoted > 0
            ? Math.round((r.totalVoted / totalVoted) * 1000) / 10
            : 0,
      })),
      totalVoted: Math.round(totalVoted * 100) / 100,
    }
  }, [displayResults, previousVote, userBalance])

  const handleSubmit = async () => {
    if (!account) return
    if (votingClosed) {
      toast.error('Voting has closed.', { style: toastStyle })
      return
    }
    if (!selectedOption) {
      toast.error('Please select an option.', { style: toastStyle })
      return
    }
    if (
      userBalance == null ||
      !Number.isFinite(userBalance) ||
      userBalance <= 0
    ) {
      toast.error(
        userBalance == null || !Number.isFinite(userBalance)
          ? 'Your $OVERVIEW balance is still loading. Please wait a moment and try again.'
          : 'You need $OVERVIEW tokens to vote.',
        { style: toastStyle }
      )
      return
    }
    if (!votesContract) {
      toast.error(
        'Voting contract is not ready yet. Please wait a moment and try again.',
        { style: toastStyle }
      )
      return
    }

    const voteAmount = Math.floor(userBalance)
    if (!Number.isFinite(voteAmount) || voteAmount <= 0) {
      toast.error('You do not have enough $OVERVIEW tokens to vote.', {
        style: toastStyle,
      })
      return
    }

    setIsSubmitting(true)
    const vote = JSON.stringify({ [selectedOption]: voteAmount })

    try {
      // Re-check existence right before submitting: the mount-time check can
      // be stale (vote landed in another tab, wallet hop). Picking the wrong
      // method fails server-side — insert violates the unique(address,voteId)
      // constraint, update on a missing row silently no-ops.
      let existsNow = hasExistingVote
      try {
        const stmt = `SELECT id FROM ${votesTableName} WHERE voteId = ${OVERVIEW_PATH_VOTE_ID} AND address = '${userAddress!.toLowerCase()}'`
        const res = await fetch(
          `${TABLELAND_ENDPOINT}?statement=${encodeURIComponent(stmt)}`
        )
        if (res.ok) {
          const data = await res.json()
          existsNow = Array.isArray(data) && data.length > 0
        }
      } catch (lookupErr) {
        console.warn(
          '[overview-path-vote] pre-submit existence check failed; falling back to cached value',
          lookupErr
        )
      }

      const method = existsNow ? 'updateTableCol' : 'insertIntoTable'
      const tx = prepareContractCall({
        contract: votesContract,
        method: method as string,
        params: [OVERVIEW_PATH_VOTE_ID, vote],
      })
      await sendAndConfirmTransaction({ transaction: tx, account })
      setHasExistingVote(true)

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
      })
      const optionTitle = getPathVoteOption(selectedOption)?.title
      toast.success(
        `Vote submitted for Option ${getPathVoteOption(selectedOption)?.letter}${optionTitle ? ` — ${optionTitle}` : ''}.`,
        { style: toastStyle }
      )

      // Optimistic tally update: move the user's weight from their previous
      // option (if any) onto the newly selected one.
      setDisplayResults((current) => {
        const adjusted = current.results.map((r) => {
          let totalVoted = r.totalVoted
          let voterCount = r.voterCount
          if (previousVote && r.optionId === previousVote.optionId) {
            totalVoted = Math.max(0, totalVoted - previousVote.amount)
            if (previousVote.optionId !== selectedOption) {
              voterCount = Math.max(0, voterCount - 1)
            }
          }
          if (r.optionId === selectedOption) {
            totalVoted += voteAmount
            if (!previousVote || previousVote.optionId !== selectedOption) {
              voterCount += 1
            }
          }
          return { ...r, totalVoted, voterCount }
        })
        const totalVoted = adjusted.reduce((s, r) => s + r.totalVoted, 0)
        const totalVoters = adjusted.reduce((s, r) => s + r.voterCount, 0)
        return {
          results: adjusted.map((r) => ({
            ...r,
            percentage:
              totalVoted > 0
                ? Math.round((r.totalVoted / totalVoted) * 1000) / 10
                : 0,
          })),
          totalVoted: Math.round(totalVoted * 100) / 100,
          totalVoters,
        }
      })

      setPreviousVote({ optionId: selectedOption, amount: voteAmount })

      // Poll for real data in the background, mirroring overview-vote.tsx.
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
                path: '/overview-path-vote',
              }),
            })
            const res = await fetch('/overview-path-vote', {
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
    } catch (error: any) {
      console.error('Error submitting vote:', error)
      const rawMessage: string =
        error?.shortMessage ||
        error?.cause?.shortMessage ||
        error?.cause?.message ||
        error?.message ||
        ''
      const lower = rawMessage.toLowerCase()

      let toastMessage = 'Failed to submit vote. Please try again.'
      if (
        lower.includes('user rejected') ||
        lower.includes('user denied') ||
        lower.includes('rejected the request') ||
        lower.includes('action_rejected')
      ) {
        toastMessage = 'Transaction cancelled in your wallet.'
      } else if (
        lower.includes('insufficient funds') ||
        lower.includes('insufficient balance')
      ) {
        toastMessage =
          'Not enough ETH on Arbitrum to cover gas. Add a small amount of ETH to your wallet on Arbitrum and try again.'
      } else if (
        lower.includes('chain') &&
        (lower.includes('mismatch') || lower.includes('switch'))
      ) {
        toastMessage =
          'Wallet is on the wrong network. Please switch to Arbitrum and try again.'
      } else if (
        lower.includes('invalid bignumber') ||
        lower.includes('value="nan"') ||
        lower.includes("value='nan'")
      ) {
        toastMessage =
          'Your wallet returned an unexpected value. Please refresh the page (or disconnect + reconnect your wallet) and try again.'
      } else if (rawMessage) {
        toastMessage = `Failed to submit vote: ${rawMessage.slice(0, 160)}`
      }

      toast.error(toastMessage, { style: toastStyle, duration: 8000 })
    } finally {
      setIsSubmitting(false)
    }
  }

  const previousOption = previousVote
    ? getPathVoteOption(previousVote.optionId)
    : null

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="Send Frank to Space — Choose the Path Forward"
        description="A formal $OVERVIEW-weighted vote on the path forward for the Overview Effect Flight: commit to a stratospheric balloon now, keep options open and continue fundraising, or activate refunds."
      />
      <Container>
        <ContentLayout
          header="Choose the Path Forward"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          branded={false}
          maxWidth="900px"
          description={
            <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-3xl">
              A formal $OVERVIEW-weighted vote on the next step for the
              Overview Effect Flight (&quot;Send Frank to Space&quot;). ~$172k
              has been raised or pledged and none of it has been spent. Token
              holders now decide between three paths.
            </p>
          }
          preFooter={<NoticeFooter />}
        >
          <div className="flex flex-col gap-6 md:gap-8 w-full max-w-[900px] mx-auto">
            {/* Community update video */}
            <YouTubeEmbed videoId="YzecKAp9V8U" />

            {/* Proposal */}
            <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <h2 className="text-lg sm:text-xl font-GoodTimes text-white mb-2 sm:mb-3">
                The Proposal
              </h2>
              <div className="text-gray-300 text-xs sm:text-sm leading-relaxed space-y-3">
                <p>
                  After 30 days of post-fundraising carrier negotiation, we
                  engaged 12 companies across the commercial space tourism
                  industry and collected real quotes, draft contracts, flight
                  profiles, and timelines. The findings below frame the
                  decision. The community now chooses one of three paths:
                  commit to a stratospheric balloon seat for Frank today, keep
                  options open and continue fundraising toward two seats, or
                  activate refunds.
                </p>
                <p>
                  Voting weight is your live $OVERVIEW balance. Your tokens
                  never leave your wallet — only your voting power is
                  recorded. You can change your vote at any time
                  {deadline
                    ? ` until voting closes on ${deadline.toLocaleDateString(
                        undefined,
                        { year: 'numeric', month: 'long', day: 'numeric' }
                      )}`
                    : ' until the vote is closed'}
                  .
                </p>
              </div>

              {/* At a glance */}
              <div className="mt-4 sm:mt-6 bg-black/20 border border-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-white text-xs sm:text-sm font-semibold mb-2 sm:mb-3 uppercase tracking-wide">
                  At a Glance
                </p>
                <dl className="space-y-2">
                  {PATH_VOTE_AT_A_GLANCE.map((item) => (
                    <div
                      key={item.label}
                      className="flex flex-col sm:flex-row sm:gap-4"
                    >
                      <dt className="text-gray-400 text-xs sm:text-sm sm:w-56 flex-shrink-0">
                        {item.label}
                      </dt>
                      <dd className="text-white text-xs sm:text-sm">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Key findings */}
              <details className="mt-3 sm:mt-4 group bg-black/20 border border-white/10 rounded-xl">
                <summary className="cursor-pointer select-none p-3 sm:p-4 text-white text-xs sm:text-sm font-semibold uppercase tracking-wide list-none flex items-center justify-between">
                  Key Findings from the Last 30 Days
                  <span className="text-gray-400 transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
                  {PATH_VOTE_FINDINGS.map((finding, i) => (
                    <div key={finding.title}>
                      <p className="text-white text-xs sm:text-sm font-medium">
                        {i + 1}. {finding.title}
                      </p>
                      <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mt-1">
                        {finding.body}
                      </p>
                    </div>
                  ))}
                  <p className="text-gray-500 text-xs leading-relaxed pt-1">
                    A portion of what we received is under NDA — specific
                    quoted prices, draft contract language, and some technical
                    details are not shared publicly. Provider-by-provider
                    scoring (within NDA limits) will be published as NDAs
                    allow.
                  </p>
                </div>
              </details>

              {/* Diligence framework */}
              <details className="mt-3 sm:mt-4 group bg-black/20 border border-white/10 rounded-xl">
                <summary className="cursor-pointer select-none p-3 sm:p-4 text-white text-xs sm:text-sm font-semibold uppercase tracking-wide list-none flex items-center justify-between">
                  How Providers Are Evaluated
                  <span className="text-gray-400 transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="space-y-2">
                    {PATH_VOTE_DILIGENCE_AXES.map((row) => (
                      <div
                        key={row.axis}
                        className="flex flex-col sm:flex-row sm:gap-4"
                      >
                        <p className="text-white text-xs sm:text-sm font-medium sm:w-56 flex-shrink-0">
                          {row.axis}
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm">
                          {row.criteria}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed mt-3">
                    No provider scores top-of-class on every axis today. The
                    job of the diligence is to surface the trade-offs
                    honestly, not to declare a winner.
                  </p>
                </div>
              </details>

              {/* Candidate seat */}
              <details className="mt-3 sm:mt-4 group bg-black/20 border border-white/10 rounded-xl">
                <summary className="cursor-pointer select-none p-3 sm:p-4 text-white text-xs sm:text-sm font-semibold uppercase tracking-wide list-none flex items-center justify-between">
                  What Happens to the Candidate Seat
                  <span className="text-gray-400 transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2">
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    The original campaign promised a community-selected
                    Candidate flying alongside Frank, chosen through a
                    four-round merit-based process culminating in a $vMOONEY
                    quadratic vote. That process is not cancelled — its status
                    depends on the path chosen:
                  </p>
                  <ul className="text-gray-400 text-xs sm:text-sm leading-relaxed list-disc pl-5 space-y-1">
                    <li>
                      <span className="text-white">Option A:</span> the
                      Candidate seat is deferred — either dropped or contingent
                      on a second fundraise.
                    </li>
                    <li>
                      <span className="text-white">Option B:</span> the
                      Candidate seat remains an active goal.
                    </li>
                    <li>
                      <span className="text-white">Option C:</span> the
                      Candidate process is paused indefinitely.
                    </li>
                  </ul>
                </div>
              </details>
            </div>

            {/* Vote panel */}
            <div className="relative z-10 p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <h2 className="text-lg sm:text-xl font-GoodTimes text-white mb-2 sm:mb-3">
                Cast Your Vote
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
                Select one of the three paths below and submit. Your full
                $OVERVIEW balance is pledged as voting weight — tokens stay in
                your wallet. You can change your vote{' '}
                {deadline
                  ? 'until voting closes'
                  : 'at any time while the vote is open'}
                .
              </p>

              {votingClosed && (
                <div className="mb-4 sm:mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4">
                  <p className="text-amber-300 text-xs sm:text-sm font-medium">
                    Voting closed on{' '}
                    {deadline!.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    . Results below are final.
                  </p>
                </div>
              )}

              {/* Balance */}
              <div className="mb-4 sm:mb-6 bg-black/20 border border-white/10 rounded-lg p-3 sm:p-4">
                <p className="text-gray-400 text-xs sm:text-sm">
                  Your $OVERVIEW Balance
                </p>
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

              {/* Current vote */}
              {previousVote && previousOption && (
                <div className="mb-4 sm:mb-6 bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 sm:p-4">
                  <p className="text-indigo-300 text-xs sm:text-sm font-medium mb-1">
                    Your Current Vote
                  </p>
                  <p className="text-white text-sm sm:text-base font-medium">
                    Option {previousOption.letter} — {previousOption.title}
                  </p>
                  <p className="text-gray-400 text-xs sm:text-sm">
                    {(userBalance != null && Number.isFinite(userBalance)
                      ? userBalance
                      : previousVote.amount
                    ).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{' '}
                    $OVERVIEW pledged
                  </p>
                </div>
              )}

              {/* Option cards */}
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                {PATH_VOTE_OPTIONS.map((option) => {
                  const accents = OPTION_ACCENTS[option.id]
                  const isSelected = selectedOption === option.id
                  const isExpanded = expandedOption === option.id
                  return (
                    <div
                      key={option.id}
                      className={`rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? `${accents.border} ${accents.bg} shadow-lg`
                          : 'border-white/10 bg-black/20'
                      } ${votingClosed ? 'opacity-80' : ''}`}
                    >
                      {/* Selectable row */}
                      <button
                        type="button"
                        onClick={() =>
                          !votingClosed && setSelectedOption(option.id)
                        }
                        disabled={votingClosed}
                        className="w-full text-left p-3 sm:p-5"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${accents.badge}`}
                          >
                            {option.letter}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <h3 className="text-white text-sm sm:text-base font-semibold">
                                {option.title}
                              </h3>
                              <span className="text-gray-400 text-xs sm:text-sm">
                                {option.subtitle}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mt-1.5">
                              {option.summary}
                            </p>
                          </div>
                          <span
                            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-1 flex items-center justify-center ${
                              isSelected
                                ? 'border-white bg-white/90'
                                : 'border-white/30'
                            }`}
                          >
                            {isSelected && (
                              <span className="w-2.5 h-2.5 rounded-full bg-gray-900" />
                            )}
                          </span>
                        </div>
                      </button>

                      {/* Details accordion */}
                      <div className="px-3 sm:px-5 pb-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOption(isExpanded ? null : option.id)
                          }
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors pb-2"
                        >
                          <span
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          >
                            ▶
                          </span>
                          {isExpanded ? 'Hide details' : 'Show details'}
                        </button>
                        {isExpanded && (
                          <div className="pb-3 sm:pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            <p className="text-xs sm:text-sm text-gray-400">
                              <span className="text-gray-300 font-medium">
                                Funds:{' '}
                              </span>
                              {option.fundsImpact}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-400">
                              <span className="text-gray-300 font-medium">
                                Candidate seat:{' '}
                              </span>
                              {option.candidateImpact}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-400">
                              <span className="text-red-300/80 font-medium">
                                Real risk:{' '}
                              </span>
                              {option.realRisk}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-400">
                              <span className="text-emerald-300/80 font-medium">
                                Best case:{' '}
                              </span>
                              {option.bestCase}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Submit */}
              {!votingClosed && (
                <PrivyWeb3Button
                  label={
                    isSubmitting
                      ? 'Submitting...'
                      : previousVote
                        ? 'Update Your Vote'
                        : 'Submit Your Vote'
                  }
                  action={handleSubmit}
                  requiredChain={overviewChain}
                  isDisabled={
                    isSubmitting ||
                    !selectedOption ||
                    !userBalance ||
                    userBalance <= 0
                  }
                  className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border-0 disabled:opacity-50"
                />
              )}
            </div>

            {/* Live results */}
            <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h2 className="text-lg sm:text-xl font-GoodTimes text-white">
                  Live Results
                </h2>
                {isRefreshing && (
                  <div className="flex items-center gap-2 text-indigo-400 text-xs sm:text-sm">
                    <div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    Updating...
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
                {visibleResults.totalVoters > 0 ? (
                  <>
                    {visibleResults.totalVoted.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{' '}
                    $OVERVIEW pledged across {visibleResults.totalVoters}{' '}
                    voter
                    {visibleResults.totalVoters !== 1 ? 's' : ''}. Tallies
                    re-weight to voters&apos; live balances.
                  </>
                ) : (
                  'No votes yet. Be the first to choose a path.'
                )}
              </p>

              <div className="space-y-4 sm:space-y-5">
                {visibleResults.results.map((result) => {
                  const option = getPathVoteOption(result.optionId)
                  if (!option) return null
                  const accents = OPTION_ACCENTS[result.optionId]
                  return (
                    <div key={result.optionId}>
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <p className="text-white text-xs sm:text-sm font-medium truncate">
                          Option {option.letter} — {option.title}
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm flex-shrink-0">
                          {result.totalVoted.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}{' '}
                          $OVERVIEW ({result.percentage}%)
                        </p>
                      </div>
                      <div className="h-2.5 sm:h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${accents.bar}`}
                          style={{
                            width: `${Math.min(100, result.percentage)}%`,
                          }}
                        />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {result.voterCount} voter
                        {result.voterCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}

export async function getStaticProps() {
  let voteResults: PathVoteResults
  try {
    voteResults = await fetchPathVoteResults()
  } catch {
    voteResults = emptyPathVoteResults()
  }
  return {
    props: { voteResults, tokenAddress: OVERVIEW_TOKEN_ADDRESS },
    revalidate: 60,
  }
}
