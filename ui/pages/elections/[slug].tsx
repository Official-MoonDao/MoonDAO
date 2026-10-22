import confetti from 'canvas-confetti'
import VotesTableABI from 'const/abis/Votes.json'
import {
  DEFAULT_CHAIN_V5,
  TABLELAND_ENDPOINT,
  VOTES_TABLE_ADDRESSES,
  VOTES_TABLE_NAMES,
} from 'const/config'
import fs from 'fs'
import { GetStaticPaths, GetStaticProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import path from 'path'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendTransaction, waitForReceipt } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import {
  ballotChoices,
  Election,
  electionPhase,
  getElection,
  listBuildableElections,
} from '@/lib/elections/elections'
import {
  emptyElectionResults,
  ElectionResults,
  ElectionVoter,
  fetchElectionResults,
  sealElectionResults,
} from '@/lib/elections/fetchElectionResults'
import { parseRankedBallot } from '@/lib/elections/rankedChoice'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { formatNumberUSStyle } from '@/lib/nance'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import RankedBallot, { BallotChoice, ordinal } from '@/components/elections/RankedBallot'
import RankedChoiceResults from '@/components/elections/RankedChoiceResults'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Votes, { VoteItem, VoteItemHeader } from '@/components/layout/Votes'
import { ShortAddressLink } from '@/components/nance/AddressLink'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

type ElectionPageProps = {
  slug: string
  results: ElectionResults
  // Whether `results` is the committed final snapshot.
  isFinal: boolean
  // False while ballots are sealed server-side.
  revealed: boolean
}

const CARD =
  'p-4 sm:p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl'

const SIDE_CARD =
  'p-4 sm:p-5 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl'

const SECTION_TITLE = 'text-lg sm:text-xl font-heading font-semibold text-white'

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function timeUntil(iso: string | null, now: number) {
  if (!iso) return null
  const minutes = Math.round((Date.parse(iso) - now) / 60_000)
  if (minutes <= 0) return null
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return days <= 60 ? `${days} days` : null
}

const PHASE_BADGE: Record<string, { label: string; cls: string; dot: string }> = {
  unscheduled: { label: 'Dates to be announced', cls: 'text-gray-300', dot: 'bg-gray-400' },
  upcoming: { label: 'Opening soon', cls: 'text-blue-200', dot: 'bg-blue-400' },
  open: { label: 'Voting open', cls: 'text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  counting: { label: 'Voting closed', cls: 'text-amber-200', dot: 'bg-amber-400' },
  closed: { label: 'Final results', cls: 'text-gray-200', dot: 'bg-gray-300' },
}

export default function ElectionPage({ slug, results, isFinal, revealed }: ElectionPageProps) {
  const election = useMemo(() => getElection(slug) as Election, [slug])
  const router = useRouter()
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const userAddress = account?.address

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const phase = electionPhase(election, now)
  const resultsRevealed = revealed && (phase === 'counting' || phase === 'closed')

  const candidates = election.candidates
  const choices = useMemo(() => ballotChoices(election), [election])
  const choiceKeys = useMemo(() => choices.map((c) => c.key), [choices])
  const ballotItems: BallotChoice[] = useMemo(
    () =>
      choices.map((c) => {
        const candidate = candidates.find((x) => x.id === c.key)
        return candidate
          ? {
              ...c,
              handle: candidate.handle,
              bio: candidate.bio,
              platformUrl: candidate.platformUrl,
            }
          : c
      }),
    [choices, candidates]
  )

  // Ballots are weighted by vMOONEY at close, so show that rather than today's.
  const closeTimestamp =
    phase === 'open' && election.closesAt
      ? Math.floor(Date.parse(election.closesAt) / 1000)
      : undefined
  const { totalVMOONEY, isLoading: vpLoading } = useTotalVMOONEY(
    userAddress,
    undefined,
    closeTimestamp
  )
  const { totalVMOONEY: currentVMOONEY } = useTotalVMOONEY(userAddress)
  const votingPower = Math.sqrt(totalVMOONEY) || 0
  const lockEndsBeforeClose = !vpLoading && votingPower <= 0 && currentVMOONEY > 0

  const votesContract = useContract({
    address: VOTES_TABLE_ADDRESSES[chainSlug],
    chain,
    abi: VotesTableABI.abi as any,
  })
  const votesTableName = VOTES_TABLE_NAMES[chainSlug]

  const [ranking, setRanking] = useState<number[]>([])
  const [savedBallot, setSavedBallot] = useState<number[] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStage, setSubmitStage] = useState<'wallet' | 'recording' | null>(null)
  const [justVoted, setJustVoted] = useState(false)

  const lookupExisting = async (address: string) => {
    const stmt = `SELECT * FROM ${votesTableName} WHERE voteId = ${
      election.voteId
    } AND address = '${address.toLowerCase()}'`
    const res = await fetch(`${TABLELAND_ENDPOINT}?statement=${encodeURIComponent(stmt)}`)
    if (!res.ok) throw new Error(`Tableland lookup failed (${res.status})`)
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? data[0] : null
  }

  useEffect(() => {
    if (!userAddress || !votesTableName) {
      setSavedBallot(null)
      return
    }
    lookupExisting(userAddress)
      .then((row) => {
        if (!row) {
          setSavedBallot(null)
          return
        }
        const ballot = parseRankedBallot(row.vote, choiceKeys)
        setSavedBallot(ballot)
        setRanking(ballot)
      })
      .catch(() => setSavedBallot(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddress, votesTableName, choiceKeys])

  const labelFor = (key: number) => choices.find((c) => c.key === key)?.label ?? `Choice ${key}`

  const handleSubmit = async () => {
    if (!account || !userAddress) return
    if (electionPhase(election) !== 'open') {
      toast.error('Voting is not open.', { style: toastStyle })
      return
    }
    if (ranking.length === 0) {
      toast.error('Rank at least one choice.', { style: toastStyle })
      return
    }
    if (votingPower <= 0) {
      toast.error('You need vMOONEY to vote in this election.', { style: toastStyle })
      return
    }
    if (!votesContract) {
      toast.error('Voting contract is not ready yet. Please try again in a moment.', {
        style: toastStyle,
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Re-check right before submitting: inserting twice violates
      // unique(address, voteId), and updating a missing row silently no-ops.
      let exists = savedBallot !== null
      try {
        exists = Boolean(await lookupExisting(userAddress))
      } catch (lookupErr) {
        console.warn('[election] pre-submit lookup failed; using cached value', lookupErr)
      }
      const tx = prepareContractCall({
        contract: votesContract,
        method: (exists ? 'updateTableCol' : 'insertIntoTable') as string,
        params: [BigInt(election.voteId), JSON.stringify(ranking)],
      })
      setSubmitStage('wallet')
      const { transactionHash } = await sendTransaction({ transaction: tx, account })
      setSubmitStage('recording')
      await waitForReceipt({ client, chain, transactionHash })
      const submitted = [...ranking]
      setSavedBallot(submitted)
      setJustVoted(true)
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
      })
      toast.success(exists ? 'Ballot updated!' : 'Ballot recorded!', { style: toastStyle })
      refreshAfterVote(userAddress, submitted)
    } catch (error: any) {
      console.error('[election] submit failed:', error)
      const raw: string = error?.shortMessage || error?.cause?.shortMessage || error?.message || ''
      const lower = raw.toLowerCase()
      let message = 'Failed to submit your ballot. Please try again.'
      if (lower.includes('user rejected') || lower.includes('user denied')) {
        message = 'Transaction cancelled in your wallet.'
      } else if (lower.includes('insufficient funds')) {
        message = `Not enough ETH on ${chain.name ?? 'Arbitrum'} to cover gas.`
      } else if (raw) {
        message = `Failed to submit your ballot: ${raw.slice(0, 160)}`
      }
      toast.error(message, { style: toastStyle, duration: 8000 })
    } finally {
      setIsSubmitting(false)
      setSubmitStage(null)
    }
  }

  // The tx confirms before Tableland indexes it, and the page is ISR-cached,
  // so wait for the row to show up, then regenerate and reload the props.
  const refreshAfterVote = async (address: string, submitted: number[]) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const expected = JSON.stringify(submitted)
    for (let i = 0; i < 20; i++) {
      try {
        const row = await lookupExisting(address)
        if (row && JSON.stringify(parseRankedBallot(row.vote, choiceKeys)) === expected) break
      } catch {}
      await sleep(2000)
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch('/api/elections/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      }).catch(() => null)
      if (res?.status !== 429) break
      await sleep(6000)
    }
    router.replace(router.asPath, undefined, { scroll: false })
  }

  const ballotChanged =
    savedBallot === null ||
    savedBallot.length !== ranking.length ||
    savedBallot.some((k, i) => k !== ranking[i])

  const voters = useMemo(() => {
    const me = userAddress?.toLowerCase()
    if (!justVoted || !me || results.voters.some((v) => v.address === me)) return results.voters
    return [...results.voters, { address: me, votingPower, ballot: [] }].sort(
      (a, b) => b.votingPower - a.votingPower
    )
  }, [results.voters, justVoted, userAddress, votingPower])
  const voterTotalVP = voters.reduce((sum, v) => sum + v.votingPower, 0)

  const opensLabel = formatDate(election.opensAt)
  const closesLabel = formatDate(election.closesAt)
  const countdown = timeUntil(phase === 'upcoming' ? election.opensAt : election.closesAt, now)

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head title={election.title} description={election.summary} />
      <Container>
        <ContentLayout
          header={election.title}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          maxWidth="1200px"
          description={`Ranked-choice vote for ${election.seat}, weighted by √vMOONEY.`}
          preFooter={<NoticeFooter />}
        >
          <div className="grid w-full gap-5 md:gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:items-start">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 sm:px-6 sm:py-4 lg:col-start-2 lg:row-start-1 lg:flex-col lg:items-start lg:gap-y-2 lg:p-5">
              <span
                className={`inline-flex items-center gap-2 text-sm font-semibold ${PHASE_BADGE[phase].cls}`}
              >
                <span className={`h-2 w-2 rounded-full ${PHASE_BADGE[phase].dot}`} />
                {PHASE_BADGE[phase].label}
              </span>
              {phase === 'open' && closesLabel && (
                <div className="text-xs sm:text-sm">
                  <span className="text-gray-400">Closes </span>
                  <span className="text-white">{closesLabel}</span>
                  {countdown && <span className="text-gray-400"> · in {countdown}</span>}
                </div>
              )}
              {phase === 'upcoming' && opensLabel && (
                <div className="text-xs sm:text-sm">
                  <span className="text-gray-400">Opens </span>
                  <span className="text-white">{opensLabel}</span>
                  {countdown && <span className="text-gray-400"> · in {countdown}</span>}
                </div>
              )}
              {(phase === 'counting' || phase === 'closed') && closesLabel && (
                <div className="text-xs sm:text-sm">
                  <span className="text-gray-400">Closed </span>
                  <span className="text-white">{closesLabel}</span>
                </div>
              )}
              <div className="text-xs sm:text-sm sm:ml-auto lg:ml-0">
                <span className="text-white font-semibold">{voters.length}</span>
                <span className="text-gray-400"> voter{voters.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-5 md:gap-6 lg:col-start-1 lg:row-start-1 lg:row-span-2">
              {resultsRevealed ? (
                <div className={CARD}>
                  {!isFinal && (
                    <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                      Preliminary · awaiting final count
                    </p>
                  )}
                  <RankedChoiceResults outcome={results.tally} voterCount={results.totalVoters} />
                  {savedBallot && savedBallot.length > 0 && (
                    <p className="mt-6 pt-4 border-t border-white/10 text-xs sm:text-sm text-gray-400">
                      Your ballot:{' '}
                      <span className="text-white">{savedBallot.map(labelFor).join(' → ')}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className={`relative z-10 ${CARD}`}>
                  <h2 className={SECTION_TITLE}>
                    {phase === 'open' ? 'Cast your ballot' : 'Candidates'}
                  </h2>
                  <p className="mt-1 mb-5 text-gray-400 text-xs sm:text-sm leading-relaxed">
                    {phase === 'open'
                      ? 'Rank as many choices as you like, starting with your favorite. If your top choice is knocked out, your vote moves to your next one.'
                      : phase === 'upcoming'
                      ? `You can rank these candidates once voting opens${
                          opensLabel ? ` on ${opensLabel}` : ''
                        }.`
                      : 'Voting dates will be announced soon.'}
                  </p>

                  {candidates.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-gray-400 text-xs sm:text-sm">
                      Candidates will be announced soon.
                    </p>
                  ) : (
                    <RankedBallot
                      choices={ballotItems}
                      value={ranking}
                      onChange={setRanking}
                      disabled={phase !== 'open'}
                    />
                  )}

                  {phase === 'open' && candidates.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="sm:flex-1 min-w-0">
                        <p className="text-xs text-gray-400">Your voting power at close</p>
                        <p className="text-white text-lg font-semibold">
                          {userAddress
                            ? vpLoading
                              ? '…'
                              : `${formatNumberUSStyle(votingPower, true)} VP`
                            : 'Sign in to see'}
                        </p>
                        {userAddress && lockEndsBeforeClose ? (
                          <p className="mt-1 text-xs text-amber-300">
                            Your lock ends before voting closes, so your ballot would not count.{' '}
                            <Link href="/lock" className="text-indigo-300 hover:underline">
                              Extend your lock
                            </Link>
                          </p>
                        ) : userAddress && !vpLoading && votingPower <= 0 ? (
                          <p className="mt-1 text-xs text-gray-400">
                            You need vMOONEY to vote.{' '}
                            <Link href="/lock" className="text-indigo-300 hover:underline">
                              Lock MOONEY
                            </Link>
                          </p>
                        ) : savedBallot ? (
                          <p className="mt-1 text-xs text-emerald-300">
                            ✓ Ballot recorded. You can change it until voting closes.
                          </p>
                        ) : null}
                      </div>
                      <div className="sm:w-64 shrink-0">
                        <PrivyWeb3Button
                          label={
                            isSubmitting
                              ? 'Submitting…'
                              : savedBallot
                              ? ballotChanged
                                ? 'Update ballot'
                                : 'Ballot submitted'
                              : ranking.length === 0
                              ? 'Rank a choice to vote'
                              : 'Submit ballot'
                          }
                          signInLabel="Sign in to vote"
                          loadingLabel={
                            submitStage === 'wallet'
                              ? 'Confirm in your wallet…'
                              : submitStage === 'recording'
                              ? 'Recording your ballot…'
                              : 'Preparing…'
                          }
                          action={handleSubmit}
                          requiredChain={chain}
                          actionDisabled={
                            isSubmitting ||
                            ranking.length === 0 ||
                            votingPower <= 0 ||
                            !ballotChanged
                          }
                          className="w-full px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border-0 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={CARD}>
                <h2 className={`${SECTION_TITLE} mb-3`}>How this election works</h2>
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                  {election.summary}
                </p>
                <ol className="mt-4 space-y-2.5 text-xs sm:text-sm text-gray-300">
                  {[
                    'Rank the candidates in order of preference. You don’t have to rank everyone.',
                    'Each vote is weighted by the square root of the voter’s vMOONEY at the moment voting closes.',
                    'If no one has more than half the votes, the last-place choice is knocked out and those ballots move to each voter’s next choice. This repeats until someone wins.',
                    'Nothing is counted until voting closes. Ballots stay hidden until then, and voters can change theirs. Once everyone has voted, the runoff runs once on all ballots.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-white/10 text-[11px] font-semibold text-white flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
                <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                    <dt className="text-gray-400">Voting opens</dt>
                    <dd className="text-white">{opensLabel ?? 'To be announced'}</dd>
                  </div>
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                    <dt className="text-gray-400">Voting closes</dt>
                    <dd className="text-white">{closesLabel ?? 'To be announced'}</dd>
                  </div>
                </dl>
                {election.links && election.links.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm">
                    {election.links.map((link) => (
                      <li key={link.url}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-300 hover:underline"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className={`${SIDE_CARD} lg:col-start-2 lg:row-start-2`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h2 className={SECTION_TITLE}>Voters</h2>
                {voters.length > 0 && (
                  <p className="text-xs sm:text-sm text-gray-400">
                    {formatNumberUSStyle(voterTotalVP, true)} VP total
                  </p>
                )}
              </div>
              {!resultsRevealed && (
                <p className="text-gray-400 text-xs sm:text-sm mb-4">
                  Choices stay hidden until voting closes.
                </p>
              )}
              <div className={resultsRevealed ? 'mt-3' : ''}>
                <Votes
                  emptyStateMessage="No ballots yet."
                  voteItems={voters.map((voter: ElectionVoter) => (
                    <VoteItem key={voter.address}>
                      <VoteItemHeader
                        leftContent={
                          voter.citizenName && voter.citizenId != null ? (
                            <Link
                              href={`/citizen/${generatePrettyLinkWithId(
                                voter.citizenName,
                                String(voter.citizenId)
                              )}`}
                              className="text-white hover:underline break-all"
                            >
                              {voter.citizenName}
                            </Link>
                          ) : (
                            <span className="text-gray-300">
                              <ShortAddressLink address={voter.address} />
                            </span>
                          )
                        }
                        rightContent={
                          <span className="flex items-center gap-2">
                            {resultsRevealed && voter.ballot.length > 0 && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold bg-blue-500/20 text-blue-200">
                                {ordinal(1)}: {labelFor(voter.ballot[0])}
                              </span>
                            )}
                            <span className="text-gray-400">
                              {formatNumberUSStyle(voter.votingPower, true)} VP
                            </span>
                          </span>
                        }
                      />
                    </VoteItem>
                  ))}
                />
              </div>
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: listBuildableElections().map((e) => ({ params: { slug: e.slug } })),
  fallback: false,
})

export const getStaticProps: GetStaticProps<ElectionPageProps> = async ({ params }) => {
  const slug = String(params?.slug ?? '')
  const election = getElection(slug)
  if (!election || !listBuildableElections().includes(election)) return { notFound: true }

  if (election.closed) {
    const snapshotPath = path.join(process.cwd(), 'lib/elections/snapshots', `${slug}.json`)
    if (fs.existsSync(snapshotPath)) {
      const results = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as ElectionResults
      return { props: { slug, results, isFinal: true, revealed: true }, revalidate: false }
    }
  }

  let results: ElectionResults
  try {
    results = await fetchElectionResults(election)
  } catch (error) {
    console.error(`[election] failed to load results for ${slug}:`, error)
    results = emptyElectionResults(election)
  }
  const phase = electionPhase(election)
  const revealed = phase === 'counting' || phase === 'closed'
  if (!revealed) results = sealElectionResults(election, results)
  return { props: { slug, results, isFinal: false, revealed }, revalidate: 60 }
}
