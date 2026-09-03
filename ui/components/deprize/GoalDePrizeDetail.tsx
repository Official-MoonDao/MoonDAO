import { useLogin } from '@privy-io/react-auth'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import {
  ROSTER_DISCLAIMER,
  isCompetitiveRace,
} from '@/lib/deprize/competitions'
import { OUTCOME_COLORS } from '@/lib/deprize/constants'
import { fmt, fmtPrizeEth } from '@/lib/deprize/format'
import { exitMockPosition, useMockMarket } from '@/lib/deprize/mockMarket'
import type { Outcome } from '@/lib/deprize/useDePrizeMarket'
import { orgById, projectById, SEED_ATLAS } from '@/lib/lunar-atlas'
import {
  orgColor,
  PROJECT_TYPE_COLOR,
  PROJECT_TYPE_LABEL,
} from '@/lib/lunar-atlas/display'
import type { SharedGoal } from '@/lib/lunar-atlas/types'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import Container from '@/components/layout/Container'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import CategoryIcon from '@/components/deprize/CategoryIcon'
import DemoBetModal from '@/components/deprize/DemoBetModal'
import DePrizeTeamCard from '@/components/deprize/DePrizeTeamCard'

/**
 * Prize detail for a Moon Base Zero capability race that is not (yet) bound
 * to an on-chain DePrize on the selected chain. Same page chrome as
 * `/deprize/{id}` so every index card has a real destination — not moonbase.
 */
export default function GoalDePrizeDetail({ goal }: { goal: SharedGoal }) {
  const account = useActiveAccount()
  const userAddress = account?.address
  const { login } = useLogin()
  const [betProjectId, setBetProjectId] = useState<string | null>(null)

  const competitors = useMemo(
    () =>
      goal.projectIds
        .map((id) => {
          const project = projectById(SEED_ATLAS, id)
          if (!project) return undefined
          return { project, organization: orgById(SEED_ATLAS, project.orgId) }
        })
        .filter(
          (c): c is { project: NonNullable<typeof c>['project']; organization: ReturnType<typeof orgById> } =>
            !!c,
        ),
    [goal.projectIds],
  )

  const projectIds = useMemo(
    () => competitors.map((c) => c.project.id),
    [competitors],
  )
  const hasRace = isCompetitiveRace(competitors.length)
  const market = useMockMarket(
    goal.id,
    projectIds,
    goal.market?.impliedOdds,
    userAddress,
  )

  const category = goal.category ?? 'other'
  const categoryLabel = PROJECT_TYPE_LABEL[category]
  const categoryColor = PROJECT_TYPE_COLOR[category]

  const outcomes: { projectId: string; outcome: Outcome; name: string }[] =
    useMemo(
      () =>
        competitors.map((c, i) => {
          const pos = market.positions[c.project.id]
          return {
            projectId: c.project.id,
            name: c.organization?.name || c.project.name,
            outcome: {
              index: i,
              probability: hasRace ? (market.odds[c.project.id] ?? 0) : Number.NaN,
              balance: pos && pos.qty > 0 ? pos.qty : 0,
              positionId: 0n,
            },
          }
        }),
      [competitors, hasRace, market.odds, market.positions],
    )

  const betRow = betProjectId
    ? outcomes.find((o) => o.projectId === betProjectId)
    : undefined

  const handleBet = (projectId: string) => {
    if (!userAddress) {
      login()
      return
    }
    setBetProjectId(projectId)
  }

  const handleCashOut = (projectId: string, name: string) => {
    const valueEth = exitMockPosition(goal.id, projectId, userAddress)
    toast.success(`Cashed out ${name} (demo) for ≈ ${fmt(valueEth)} ETH.`, {
      style: toastStyle,
    })
  }

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title={goal.title}
        description={goal.description.slice(0, 160)}
      />
      <Container>
        <div className="w-full max-w-[860px] mx-auto pt-6 sm:pt-8 pb-10 px-4 sm:px-5 md:px-0">
          <div className="flex flex-col gap-4 w-full">
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${categoryColor}22`,
                      border: `1px solid ${categoryColor}55`,
                      color: categoryColor,
                    }}
                  >
                    <CategoryIcon category={category} className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-white font-GoodTimes text-lg sm:text-xl leading-snug">
                      {goal.title}
                    </h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                      <span>{categoryLabel}</span>
                      {goal.targetWindow && (
                        <>
                          <span className="text-gray-600">·</span>
                          <span>
                            {goal.targetWindow.from ?? '?'}–{goal.targetWindow.to ?? '?'}
                          </span>
                        </>
                      )}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          hasRace
                            ? 'text-fuchsia-200 border-fuchsia-400/30 bg-fuchsia-500/10'
                            : 'text-gray-400 border-white/15 bg-white/5'
                        }`}
                      >
                        {hasRace ? 'Demo' : 'No developer yet'}
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href="/deprize"
                  className="shrink-0 text-sm text-indigo-300/90 hover:text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 rounded"
                >
                  ← All prizes
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Prize pool</p>
                  <p className="text-sm font-semibold text-white">
                    {hasRace ? `${fmtPrizeEth(market.pool)} ETH` : '—'}
                    {hasRace && (
                      <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        demo
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Providers</p>
                  <p className="text-sm font-semibold text-white">
                    {competitors.length || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Target window</p>
                  <p className="text-sm font-semibold text-white">
                    {goal.targetWindow
                      ? `${goal.targetWindow.from ?? '?'}–${goal.targetWindow.to ?? '?'}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {hasRace && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg">
                <p className="text-white font-semibold mb-3">Predictions</p>
                <div className="flex w-full h-2 rounded-full overflow-hidden bg-white/5 mb-3">
                  {outcomes.map((o) => (
                    <div
                      key={o.projectId}
                      style={{
                        width: `${Math.max(0, Math.min(100, o.outcome.probability))}%`,
                        background:
                          OUTCOME_COLORS[o.outcome.index % OUTCOME_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {outcomes.map((o) => (
                    <div key={o.projectId} className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{
                          background:
                            OUTCOME_COLORS[o.outcome.index % OUTCOME_COLORS.length],
                        }}
                      />
                      <span className="text-gray-300 text-xs">
                        {o.name}
                        {Number.isFinite(o.outcome.probability)
                          ? ` · ${fmt(o.outcome.probability, 0)}%`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <h3 className="title-text-colors text-lg font-GoodTimes">
                Competitors
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 -mt-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-1 rounded-full bg-zinc-400" />
                  Unofficial — not confirmed
                </span>
              </div>
              {outcomes.map((o) => {
                const competitor = competitors[o.outcome.index]
                const org = competitor?.organization
                return (
                  <DePrizeTeamCard
                    key={o.projectId}
                    outcome={o.outcome}
                    teamId={0n}
                    teamContract={undefined}
                    color={orgColor(org)}
                    loading={false}
                    resolved={false}
                    isRefundVector={false}
                    isWinningSlot={false}
                    investedEth={market.positions[o.projectId]?.costEth ?? 0}
                    bettingOpen={hasRace}
                    tradingHalted={false}
                    busy={false}
                    userConnected={!!userAddress}
                    onBet={() => handleBet(o.projectId)}
                    onCashOut={() => handleCashOut(o.projectId, o.name)}
                    hrefOverride={`/moonbase/${o.projectId}`}
                    nameOverride={o.name}
                    unclaimed
                    participation="unofficial"
                  />
                )
              })}
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg">
              <p className="text-gray-300 text-sm">{goal.description}</p>
              {goal.regionLabel && (
                <p className="text-gray-500 text-xs mt-2">{goal.regionLabel}</p>
              )}
              {hasRace && (
                <p className="text-gray-500 text-xs leading-relaxed mt-3">
                  {ROSTER_DISCLAIMER}
                </p>
              )}
              <p className="text-gray-500 text-xs mt-3">
                {hasRace
                  ? 'Switch to Sepolia to view the live on-chain market for this race. '
                  : 'No funded developer has entered this capability yet, so there is no market. '}
                <Link
                  href={`/moonbase?race=${goal.id}`}
                  className="text-indigo-300/90 underline-offset-2 hover:underline"
                >
                  See this race on Moon Base Zero
                </Link>
                .
              </p>
            </div>

            {goal.criteria && goal.criteria.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg">
                <h3 className="text-white font-semibold text-sm mb-3">
                  Capability criteria (draft)
                </h3>
                <ol className="flex flex-col gap-2.5">
                  {goal.criteria.map((c, i) => (
                    <li key={c.id} className="text-sm text-gray-300">
                      <span className="text-gray-500 mr-2">{i + 1}</span>
                      {c.statement}
                      {c.threshold && (
                        <p className="text-xs text-gray-500 mt-0.5 pl-5">
                          {c.threshold}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {goal.sources.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg">
                <h3 className="text-white font-semibold text-sm mb-3">Sources</h3>
                <ul className="flex flex-col gap-1.5">
                  {goal.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-300/90 hover:text-indigo-200 text-sm underline-offset-2 hover:underline"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <NoticeFooter />
      </Container>

      {betRow && (
        <DemoBetModal
          sharedGoalId={goal.id}
          projectIds={projectIds}
          impliedOdds={goal.market?.impliedOdds}
          projectId={betRow.projectId}
          teamName={betRow.name}
          probability={betRow.outcome.probability}
          address={userAddress}
          onClose={() => setBetProjectId(null)}
          onDone={() => {
            setBetProjectId(null)
          }}
        />
      )}
    </div>
  )
}
