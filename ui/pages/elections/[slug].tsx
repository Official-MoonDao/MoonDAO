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
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
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
  fetchElectionResults,
  sealElectionResults,
} from '@/lib/elections/fetchElectionResults'
import { parseRankedBallot } from '@/lib/elections/rankedChoice'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { formatNumberUSStyle } from '@/lib/nance'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVMOONEY } from '@/lib/tokens/hooks/useTotalVMOONEY'
import RankedBallot from '@/components/elections/RankedBallot'
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

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
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

  const { totalVMOONEY, isLoading: vpLoading } = useTotalVMOONEY(userAddress)
  const votingPower = Math.sqrt(totalVMOONEY) || 0

  const votesContract = useContract({
    address: VOTES_TABLE_ADDRESSES[chainSlug],
    chain,
    abi: VotesTableABI.abi as any,
  })
  const votesTableName = VOTES_TABLE_NAMES[chainSlug]

  const [ranking, setRanking] = useState<number[]>([])
  const [savedBallot, setSavedBallot] = useState<number[] | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      await sendAndConfirmTransaction({ transaction: tx, account })
      setSavedBallot(ranking)
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        shapes: ['circle', 'star'],
        colors: ['#ffffff', '#FFD700', '#00FFFF', '#ff69b4', '#8A2BE2'],
      })
      toast.success(exists ? 'Ballot updated.' : 'Ballot submitted.', { style: toastStyle })
      setTimeout(() => router.replace(router.asPath), 8000)
    } catch (error: any) {
      console.error('[election] submit failed:', error)
      const raw: string =
        error?.shortMessage || error?.cause?.shortMessage || error?.message || ''
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
    }
  }

  const ballotChanged =
    savedBallot === null ||
    savedBallot.length !== ranking.length ||
    savedBallot.some((k, i) => k !== ranking[i])

  const opensLabel = formatDate(election.opensAt)
  const closesLabel = formatDate(election.closesAt)

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
          maxWidth="900px"
          description={`Ranked-choice vote for ${election.seat}, weighted by √vMOONEY.`}
          preFooter={<NoticeFooter />}
        >
          <div className="flex w-full flex-col gap-6 md:gap-8">
            {resultsRevealed && (
              <div className={CARD}>
                {!isFinal && (
                  <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                    Preliminary · awaiting final snapshot
                  </p>
                )}
                <RankedChoiceResults outcome={results.tally} voterCount={results.totalVoters} />
              </div>
            )}

            <div className={CARD}>
              <h2 className="text-lg sm:text-xl font-heading font-semibold text-white mb-2 sm:mb-3">
                About this election
              </h2>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">{election.summary}</p>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
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

            <div className={CARD}>
              <h2 className="text-lg sm:text-xl font-heading font-semibold text-white mb-2 sm:mb-3">
                Candidates
              </h2>
              {candidates.length === 0 ? (
                <p className="text-gray-400 text-xs sm:text-sm">
                  Candidates will be announced soon.
                </p>
              ) : (
                <ul className="space-y-3">
                  {candidates.map((c) => (
                    <li key={c.id} className="bg-black/20 border border-white/10 rounded-xl p-3 sm:p-4">
                      <p className="text-white text-sm sm:text-base font-semibold">
                        {c.name}
                        {c.handle && (
                          <span className="ml-2 text-gray-400 font-normal">{c.handle}</span>
                        )}
                      </p>
                      {c.bio && (
                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mt-1.5">
                          {c.bio}
                        </p>
                      )}
                      {c.platformUrl && (
                        <a
                          href={c.platformUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-block text-xs sm:text-sm text-indigo-300 hover:underline"
                        >
                          Read platform
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={CARD}>
              <h2 className="text-lg sm:text-xl font-heading font-semibold text-white mb-2">
                Voters
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm mb-4 leading-relaxed">
                {!resultsRevealed && (
                  <span className="inline-flex items-center gap-1.5 mr-1 text-indigo-300">
                    <span aria-hidden>🔒</span> Ballots and the tally stay hidden until voting
                    closes.
                  </span>
                )}
                {results.totalVoters > 0
                  ? `${results.totalVoters} voter${results.totalVoters !== 1 ? 's' : ''}, ${formatNumberUSStyle(
                      results.totalVP,
                      true
                    )} VP.`
                  : 'No ballots yet.'}
              </p>
              <Votes
                emptyStateMessage="No ballots yet."
                voteItems={results.voters.map((voter) => (
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
                              1st: {labelFor(voter.ballot[0])}
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

            <div className={`relative z-10 ${CARD}`}>
              <h2 className="text-lg sm:text-xl font-heading font-semibold text-white mb-2 sm:mb-3">
                Your ballot
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm mb-4 leading-relaxed">
                Rank as many choices as you like. If your top choice is eliminated, your ballot
                moves to your next choice. Your voting power is the square root of your vMOONEY
                at the moment voting closes. You can change your ballot until then.
              </p>

              {phase !== 'open' && (
                <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4">
                  <p className="text-amber-300 text-xs sm:text-sm font-medium">
                    {phase === 'unscheduled' && 'Voting dates have not been announced yet.'}
                    {phase === 'upcoming' && `Voting opens ${opensLabel}.`}
                    {(phase === 'counting' || phase === 'closed') && `Voting closed ${closesLabel}.`}
                  </p>
                </div>
              )}

              <div className="mb-4 bg-black/20 border border-white/10 rounded-lg p-3 sm:p-4">
                <p className="text-gray-400 text-xs sm:text-sm">Your voting power</p>
                <p className="text-white text-xl sm:text-2xl font-semibold">
                  {userAddress
                    ? vpLoading
                      ? '...'
                      : `${formatNumberUSStyle(votingPower, true)} VP`
                    : 'Connect wallet'}
                </p>
              </div>

              {savedBallot && savedBallot.length > 0 && (
                <p className="mb-4 text-indigo-300 text-xs sm:text-sm">
                  Your ballot is recorded: {savedBallot.map(labelFor).join(' → ')}
                </p>
              )}

              {choices.length > 0 && (
                <RankedBallot
                  choices={choices}
                  value={ranking}
                  onChange={setRanking}
                  disabled={phase !== 'open'}
                />
              )}

              {phase === 'open' && (
                <div className="mt-6">
                  <PrivyWeb3Button
                    label={
                      isSubmitting
                        ? 'Submitting...'
                        : savedBallot
                        ? 'Update your ballot'
                        : 'Submit your ballot'
                    }
                    action={handleSubmit}
                    requiredChain={chain}
                    isDisabled={
                      isSubmitting || ranking.length === 0 || votingPower <= 0 || !ballotChanged
                    }
                    className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border-0 disabled:opacity-50"
                  />
                  {userAddress && !vpLoading && votingPower <= 0 && (
                    <p className="mt-2 text-xs text-gray-400">
                      You need vMOONEY to vote.{' '}
                      <Link href="/lock" className="text-indigo-300 hover:underline">
                        Lock MOONEY
                      </Link>
                    </p>
                  )}
                </div>
              )}
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
