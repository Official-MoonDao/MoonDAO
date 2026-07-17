import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  DEPRIZE_MINT_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { useLogin } from '@privy-io/react-auth'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount, useReadContract } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import {
  DePrizeState,
  DEPRIZE_STATE_META,
  GAS_RESERVE_ETH,
  OUTCOME_COLORS,
  UNIT,
} from '@/lib/deprize/constants'
import { fmt } from '@/lib/deprize/format'
import { deprizeReadChain, deprizeReadClient } from '@/lib/deprize/read'
import { useDePrize, useDePrizeCount } from '@/lib/deprize/useDePrize'
import { useDePrizeMarket } from '@/lib/deprize/useDePrizeMarket'
import useRegionRestriction from '@/lib/geo/useRegionRestriction'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { getChainSlug } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import BetModal from '@/components/deprize/BetModal'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import IPFSRenderer from '@/components/layout/IPFSRenderer'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type BetTarget = {
  deprizeId: number
  outcomeIndex: number
  teamName: string
  probability: number
  numOutcomes: number
  marketAddress: string
}

function ProviderOddsRow({
  teamId,
  teamContract,
  probability,
  color,
  bettingOpen,
  onBet,
}: {
  teamId: bigint
  teamContract: any
  probability: number
  color: string
  bettingOpen: boolean
  onBet: (teamName: string) => void
}) {
  const { data: teamNFT } = useReadContract(getNFT, {
    contract: teamContract,
    tokenId: BigInt(teamId),
    queryOptions: { enabled: !!teamContract && teamId > 0n },
  })
  const name = (teamNFT as any)?.metadata?.name || `Team #${teamId.toString()}`
  const image = (teamNFT as any)?.metadata?.image || ''
  const pct = Number.isFinite(probability) ? fmt(probability, 0) : '—'

  return (
    <div className="flex items-center gap-3 min-w-0 py-1">
      {image ? (
        <IPFSRenderer
          className="rounded-full shrink-0"
          src={image}
          width={28}
          height={28}
          alt={name}
        />
      ) : (
        <span
          className="w-7 h-7 rounded-full shrink-0 border border-white/10"
          style={{ background: `${color}33` }}
        />
      )}
      <span className="text-gray-100 text-sm font-medium truncate flex-1">
        {name}
      </span>
      {/* Polymarket-style: the odds themselves are the bet affordance */}
      {bettingOpen ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onBet(name)
          }}
          className="shrink-0 min-w-[72px] px-3 py-1.5 rounded-lg text-sm font-semibold tabular-nums transition-colors
            bg-emerald-500/15 text-emerald-300 border border-emerald-500/30
            hover:bg-emerald-500/25 hover:border-emerald-400/50"
        >
          {pct}%
        </button>
      ) : (
        <span className="shrink-0 min-w-[72px] px-3 py-1.5 rounded-lg text-sm font-semibold tabular-nums text-center text-gray-300 bg-white/5 border border-white/10">
          {pct}%
        </span>
      )}
    </div>
  )
}

function DePrizeListRow({
  deprizeId,
  teamContract,
  onBet,
}: {
  deprizeId: number
  teamContract: any
  onBet: (target: BetTarget) => void
}) {
  const router = useRouter()
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
  const bettingOpen = !!deprize?.bettingOpen && !!market.marketAddress
  const hasOdds = topProviders.some((p) => Number.isFinite(p.probability))
  const detailHref = `/deprize/${deprizeId}`

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(detailHref)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(detailHref)
        }
      }}
      className="block p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10 hover:border-white/25 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-white font-GoodTimes text-lg">DePrize #{deprizeId}</p>
          <p className="text-gray-400 text-sm mt-1">
            {meta?.description ?? 'Loading…'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              bettingOpen
                ? 'bg-moon-green/20 text-moon-green border-moon-green/40'
                : 'bg-white/10 text-gray-200 border-white/20'
            }`}
          >
            {meta?.label ?? '—'}
          </span>
          <p className="text-white text-lg font-bold tabular-nums">
            {prizeEth !== undefined ? fmt(prizeEth, 2) : '—'}
            <span className="text-sm font-medium text-gray-400 ml-1">ETH</span>
          </p>
          <p className="text-gray-500 text-[11px]">prize pool</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1 min-w-0">
        <p className="text-gray-500 text-[11px] uppercase tracking-wide mb-1">
          {hasOdds ? 'Live odds' : 'Providers'}
          {bettingOpen ? (
            <span className="normal-case tracking-normal text-gray-600 ml-2">
              · tap % to bet
            </span>
          ) : null}
        </p>
        {topProviders.length === 0 ? (
          <p className="text-gray-500 text-sm">Loading providers…</p>
        ) : (
          topProviders.map((p) => (
            <ProviderOddsRow
              key={p.teamId.toString()}
              teamId={p.teamId}
              teamContract={teamContract}
              probability={p.probability}
              color={OUTCOME_COLORS[p.index % OUTCOME_COLORS.length]}
              bettingOpen={bettingOpen}
              onBet={(teamName) => {
                if (!market.marketAddress) return
                onBet({
                  deprizeId,
                  outcomeIndex: p.index,
                  teamName,
                  probability: p.probability,
                  numOutcomes,
                  marketAddress: market.marketAddress,
                })
              }}
            />
          ))
        )}
        {deprize && deprize.teamIds.length > 3 && (
          <p className="text-gray-500 text-xs mt-1">
            +{deprize.teamIds.length - 3} more on the detail page
          </p>
        )}
      </div>
    </div>
  )
}

export default function DePrizeIndexPage() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const { count, loading, registryConfigured } = useDePrizeCount(chain)
  const account = useActiveAccount()
  const { login } = useLogin()
  const region = useRegionRestriction()
  const mintAddress = DEPRIZE_MINT_ADDRESSES[chainSlug] ?? ''

  const [betTarget, setBetTarget] = useState<BetTarget | null>(null)
  const [spendableEth, setSpendableEth] = useState(0)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const readChain = useMemo(() => deprizeReadChain(chain.id), [chain.id])

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

  // Spendable native ETH for the BetModal (keep a little back for gas).
  useEffect(() => {
    if (!account?.address) {
      setSpendableEth(0)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const bal = await eth_getBalance(
          getRpcClient({ client: deprizeReadClient, chain: readChain }),
          { address: account.address }
        )
        if (!cancelled) {
          setSpendableEth(Math.max(0, Number(bal) / Number(UNIT) - GAS_RESERVE_ETH))
        }
      } catch {
        if (!cancelled) setSpendableEth(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account?.address, readChain, refreshNonce])

  const handleBet = useCallback(
    (target: BetTarget) => {
      if (region.isRestricted || region.isLoading) return
      if (!account) {
        login()
        return
      }
      setBetTarget(target)
    },
    [account, login, region.isLoading, region.isRestricted]
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
            {region.isRestricted && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                Betting isn&apos;t available in your region. You can still browse
                live odds and prize pools.
              </div>
            )}
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
                  onBet={handleBet}
                />
              ))
            )}
          </div>
        </ContentLayout>
      </Container>

      {betTarget && account && (
        <BetModal
          deprizeId={betTarget.deprizeId}
          outcomeIndex={betTarget.outcomeIndex}
          teamName={betTarget.teamName}
          probability={betTarget.probability}
          numOutcomes={betTarget.numOutcomes}
          mintAddress={mintAddress}
          marketAddress={betTarget.marketAddress}
          chain={chain}
          account={account}
          spendableEth={spendableEth}
          onClose={() => setBetTarget(null)}
          onDone={() => {
            setRefreshNonce((n) => n + 1)
            setBetTarget(null)
          }}
        />
      )}
    </div>
  )
}
