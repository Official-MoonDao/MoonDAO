import TeamABI from 'const/abis/Team.json'
import { DEFAULT_CHAIN_V5, TEAM_ADDRESSES } from 'const/config'
import Link from 'next/link'
import { useMemo } from 'react'
import { getContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useReadContract } from 'thirdweb/react'
import {
  DePrizeState,
  DEPRIZE_STATE_META,
  OUTCOME_COLORS,
  UNIT,
} from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import { useDePrize, useDePrizeCount } from '@/lib/deprize/useDePrize'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

function ProviderOddsRow({
  teamId,
  teamContract,
  probability,
  color,
  rank,
}: {
  teamId: bigint
  teamContract: any
  probability: number
  color: string
  rank: number
}) {
  const { data: teamNFT } = useReadContract(getNFT, {
    contract: teamContract,
    tokenId: BigInt(teamId),
    queryOptions: { enabled: !!teamContract && teamId > 0n },
  })
  const name = (teamNFT as any)?.metadata?.name || `Team #${teamId.toString()}`
  const image = (teamNFT as any)?.metadata?.image || ''

  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-gray-500 text-xs w-4 shrink-0">{rank}</span>
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ background: color }}
      />
      {image ? (
        <IPFSRenderer
          className="rounded-full shrink-0"
          src={image}
          width={24}
          height={24}
          alt={name}
        />
      ) : (
        <span className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
      )}
      <span className="text-gray-200 text-sm truncate flex-1">{name}</span>
      <span className="text-white text-sm font-semibold tabular-nums shrink-0">
        {Number.isFinite(probability) ? `${fmt(probability, 0)}%` : '—'}
      </span>
    </div>
  )
}

function DePrizeListRow({
  deprizeId,
  teamContract,
}: {
  deprizeId: number
  teamContract: any
}) {
  const chain = DEFAULT_CHAIN_V5
  const { deprize } = useDePrize(deprizeId, chain)
  const numOutcomes = deprize?.teamIds.length ?? 0

  const market = useDePrizeMarket({
    deprizeId,
    conditionId: deprize?.conditionId,
    numOutcomes,
    chain,
  })

  const { totalFunding } = useTotalFunding(
    deprize && deprize.jbProjectId > 0n ? Number(deprize.jbProjectId) : undefined
  )
  const prizeEth =
    totalFunding !== undefined ? Number(totalFunding) / Number(UNIT) : undefined

  // Top 3 providers by live implied odds (desc). Fall back to registry order
  // while prices are still loading so the card still previews the field.
  const topProviders = useMemo(() => {
    if (!deprize?.teamIds.length) return []
    const rows = deprize.teamIds.map((teamId, index) => ({
      index,
      teamId,
      probability: market.outcomes[index]?.probability ?? NaN,
    }))
    const ranked = [...rows].sort((a, b) => {
      const ap = Number.isFinite(a.probability) ? a.probability : -1
      const bp = Number.isFinite(b.probability) ? b.probability : -1
      return bp - ap
    })
    return ranked.slice(0, 3)
  }, [deprize?.teamIds, market.outcomes])

  if (deprize && deprize.state === DePrizeState.NONE) return null

  const meta = deprize ? DEPRIZE_STATE_META[deprize.state] : undefined
  const isOpen = deprize?.state === DePrizeState.OPEN
  const hasOdds = topProviders.some((p) => Number.isFinite(p.probability))

  return (
    <Link
      href={`/deprize/${deprizeId}`}
      className="block p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10 hover:border-white/25 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-white font-GoodTimes text-lg">DePrize #{deprizeId}</p>
          <p className="text-gray-400 text-sm mt-1">
            {meta?.description ?? 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              isOpen
                ? 'bg-moon-green/20 text-moon-green border-moon-green/40'
                : 'bg-white/10 text-gray-200 border-white/20'
            }`}
          >
            {meta?.label ?? '—'}
          </span>
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-4 items-start">
        {/* Top providers + live odds */}
        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-gray-500 text-[11px] uppercase tracking-wide">
            {hasOdds ? 'Live odds' : 'Providers'}
          </p>
          {topProviders.length === 0 ? (
            <p className="text-gray-500 text-sm">Loading providers…</p>
          ) : (
            topProviders.map((p, rank) => (
              <ProviderOddsRow
                key={p.teamId.toString()}
                teamId={p.teamId}
                teamContract={teamContract}
                probability={p.probability}
                color={OUTCOME_COLORS[p.index % OUTCOME_COLORS.length]}
                rank={rank + 1}
              />
            ))
          )}
          {deprize && deprize.teamIds.length > 3 && (
            <p className="text-gray-500 text-xs mt-0.5">
              +{deprize.teamIds.length - 3} more
            </p>
          )}
        </div>

        {/* Prize pool */}
        <div className="sm:text-right shrink-0">
          <p className="text-gray-500 text-[11px] uppercase tracking-wide">
            Prize pool
          </p>
          <p className="text-white text-2xl font-bold leading-tight mt-1 tabular-nums">
            {prizeEth !== undefined ? fmt(prizeEth, 2) : '—'}
            <span className="text-base font-medium text-gray-400 ml-1">ETH</span>
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function DePrizeIndexPage() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const { count, loading, registryConfigured } = useDePrizeCount(chain)

  const teamContract = useMemo(
    () =>
      TEAM_ADDRESSES[chainSlug]
        ? getContract({
            client,
            chain,
            address: TEAM_ADDRESSES[chainSlug],
            abi: TeamABI as any,
          })
        : undefined,
    [chain, chainSlug]
  )

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="DePrize"
        description="Back a team in open challenges — live odds, growing prize pools, payouts when a winner is declared."
      />
      <Container>
        <ContentLayout
          header="DePrize"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          centerHeaderWidth="760px"
          description="Open challenges with live odds. Back the team you think will win — every bet grows the prize pool."
          preFooter={<NoticeFooter />}
        >
          <div className="flex flex-col gap-4 w-full max-w-[760px] mx-auto">
            {!registryConfigured ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                The DePrize registry isn&apos;t configured on{' '}
                <span className="font-mono">{chainSlug}</span> yet.
              </div>
            ) : loading && count === undefined ? (
              <div className="p-8 text-center text-gray-400">Loading DePrizes…</div>
            ) : !count || count === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No DePrizes have been registered yet.
              </div>
            ) : (
              Array.from({ length: count }, (_, i) => (
                <DePrizeListRow
                  key={i + 1}
                  deprizeId={i + 1}
                  teamContract={teamContract}
                />
              ))
            )}
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
