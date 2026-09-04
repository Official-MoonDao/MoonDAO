import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useLogin } from '@privy-io/react-auth'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import { getFeaturedLiveDePrizeId } from '@/lib/deprize/competitions'
import { UNIT } from '@/lib/deprize/constants'
import { spendableFromBalanceEth } from '@/lib/deprize/gas-reserve'
import { resetMockData } from '@/lib/deprize/mockMarket'
import { deprizeReadChain, deprizeReadClient } from '@/lib/deprize/read'
import useRegionRestriction from '@/lib/geo/useRegionRestriction'
import { orgById, projectById, SEED_ATLAS } from '@/lib/lunar-atlas'
import { PROJECT_TYPE_LABEL } from '@/lib/lunar-atlas/display'
import type { ProjectType } from '@/lib/lunar-atlas/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import CategoryIcon from '@/components/deprize/CategoryIcon'
import LiveDePrizeHero from '@/components/deprize/LiveDePrizeHero'
import RaceMarketCard, { type IndexTab } from '@/components/deprize/RaceMarketCard'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

export default function DePrizeIndexContent() {
  // Follow the app's live selected chain (wallet / header dropdown), not the
  // build-time default — otherwise switching networks never re-queries DePrize.
  const { selectedChain: chain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const userAddress = account?.address
  const { login } = useLogin()
  const region = useRegionRestriction()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ProjectType | 'all'>('all')
  const [activeTab, setActiveTab] = useState<IndexTab>('all')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [spendableEth, setSpendableEth] = useState(0)
  const [positionsMap, setPositionsMap] = useState<Record<string, boolean>>({})

  // Capability races Moon Base Zero tracks, plus any other market-bearing
  // shared goal (Touchdown is a live landing prize, not the lander tech-tree
  // site). The index stays atlas-sourced so it cannot drift into on-chain
  // registry fixtures.
  const races = useMemo(() => {
    return SEED_ATLAS.sharedGoals
      .filter((g) => !!g.category || !!g.market)
      .map((goal) => ({
        goal,
        competitors: goal.projectIds
          .map((id) => {
            const project = projectById(SEED_ATLAS, id)
            if (!project) return undefined
            return { project, organization: orgById(SEED_ATLAS, project.orgId) }
          })
          .filter((c): c is { project: any; organization: any } => !!c),
      }))
      .filter((r) => r.competitors.length > 0)
  }, [])

  const categories = useMemo(() => {
    const set = new Set<ProjectType>()
    races.forEach((r) => {
      if (r.goal.category) set.add(r.goal.category)
    })
    return Array.from(set).sort((a, b) =>
      PROJECT_TYPE_LABEL[a].localeCompare(PROJECT_TYPE_LABEL[b])
    )
  }, [races])

  const filteredRaces = useMemo(() => {
    const q = search.trim().toLowerCase()
    return races.filter((r) => {
      if (category !== 'all' && r.goal.category !== category) return false
      if (!q) return true
      if (r.goal.title.toLowerCase().includes(q)) return true
      return r.competitors.some((c) => c.project.name.toLowerCase().includes(q))
    })
  }, [races, search, category])

  // Live on-chain competitions that aren't bound to a Moon Base Zero race
  // (Arbitrum #1 — The Moon Is A Harsh Mistress) take the hero slot. Atlas
  // race demos fill the grid below; fission no longer steals the featured
  // position when a real market is live on this chain.
  const featuredLiveId = useMemo(() => getFeaturedLiveDePrizeId(chainSlug), [chainSlug])
  const gridRaces = filteredRaces

  const positionsCount = useMemo(
    () => Object.values(positionsMap).filter(Boolean).length,
    [positionsMap]
  )
  const handleHasPosition = (sharedGoalId: string, has: boolean) => {
    setPositionsMap((prev) =>
      prev[sharedGoalId] === has ? prev : { ...prev, [sharedGoalId]: has }
    )
  }

  const readChain = useMemo(() => deprizeReadChain(chain.id), [chain.id])

  // Spendable native ETH for the real BetModal (keep a little back for gas).
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
          setSpendableEth(spendableFromBalanceEth(Number(bal) / Number(UNIT), readChain.id))
        }
      } catch {
        if (!cancelled) setSpendableEth(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [account?.address, readChain, refreshNonce])

  // Default-deny real betting when the region is unresolved: `/api/geo/country`
  // reports restricted=false for a missing geo header, which must not open
  // live betting. Demo markets are unaffected — no real value moves there.
  const bettingBlockedReason = region.isRestricted
    ? "Betting on live on-chain markets isn't available in your region."
    : !region.isLoading && !region.isError && !region.country
    ? "Can't verify your region — live betting is disabled until it resolves. Demo markets still work."
    : region.isLoading
    ? 'Checking your region…'
    : undefined

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="DePrize"
        description="Back a team in open capability races — live odds, growing prize pools, payouts when a winner is declared."
      />
      <Container>
        <ContentLayout
          header="DePrize"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          centerHeaderWidth="72rem"
          description="Open capability races with live odds. Back the team you think will win — every bet grows the prize pool."
          preFooter={<NoticeFooter />}
        >
          <div className="flex flex-col gap-4 w-full max-w-6xl mx-auto">
            {bettingBlockedReason && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                {bettingBlockedReason}
              </div>
            )}

            {/* Search */}
            <div className="relative w-full max-w-md">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search races or teams…"
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
              />
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  category === 'all'
                    ? 'bg-white/15 text-white border-white/20'
                    : 'text-gray-400 border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5 ${
                    category === c
                      ? 'bg-white/15 text-white border-white/20'
                      : 'text-gray-400 border-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  <CategoryIcon category={c} className="w-3.5 h-3.5" />
                  {PROJECT_TYPE_LABEL[c]}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div
              role="tablist"
              aria-label="DePrize view"
              className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 self-start max-w-full"
            >
              {[
                { id: 'all' as const, label: 'Markets', n: filteredRaces.length },
                { id: 'positions' as const, label: 'My Positions', n: positionsCount },
              ].map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                    activeTab === t.id ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t.label}
                  {(t.id !== 'positions' || !!account) && (
                    <span className="ml-1.5 tabular-nums text-xs opacity-70">{t.n}</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'positions' && !account ? (
              <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-3">
                <p>Connect a wallet to see the teams you&apos;ve backed.</p>
                <button
                  onClick={() => login()}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold transition-all"
                >
                  Connect Wallet
                </button>
              </div>
            ) : activeTab === 'all' ? (
              <>
                {featuredLiveId !== undefined && (
                  <LiveDePrizeHero
                    deprizeId={featuredLiveId}
                    chain={chain}
                    chainSlug={chainSlug}
                    account={account}
                    userAddress={userAddress}
                    spendableEth={spendableEth}
                    bettingBlockedReason={bettingBlockedReason}
                    onConnectWallet={() => login()}
                    onDone={() => setRefreshNonce((n) => n + 1)}
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gridRaces.map(({ goal, competitors }) => (
                    <RaceMarketCard
                      key={goal.id}
                      goal={goal}
                      competitors={competitors}
                      chain={chain}
                      chainSlug={chainSlug}
                      account={account}
                      userAddress={userAddress}
                      spendableEth={spendableEth}
                      refreshNonce={refreshNonce}
                      activeTab={activeTab}
                      bettingBlockedReason={bettingBlockedReason}
                      onConnectWallet={() => login()}
                      onHasPosition={handleHasPosition}
                      onDone={() => setRefreshNonce((n) => n + 1)}
                      variant="grid"
                    />
                  ))}
                </div>

                {filteredRaces.length === 0 && (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    No races match your search.
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-4 w-full max-w-[760px] mx-auto">
                {filteredRaces.map(({ goal, competitors }) => (
                  <RaceMarketCard
                    key={goal.id}
                    goal={goal}
                    competitors={competitors}
                    chain={chain}
                    chainSlug={chainSlug}
                    account={account}
                    userAddress={userAddress}
                    spendableEth={spendableEth}
                    refreshNonce={refreshNonce}
                    activeTab={activeTab}
                    bettingBlockedReason={bettingBlockedReason}
                    onConnectWallet={() => login()}
                    onHasPosition={handleHasPosition}
                    onDone={() => setRefreshNonce((n) => n + 1)}
                  />
                ))}

                {positionsCount === 0 && (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    You haven&apos;t backed any teams yet. Pick a race above to place your first
                    bet.
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                resetMockData()
                setRefreshNonce((n) => n + 1)
              }}
              className="self-center mt-2 text-gray-600 hover:text-gray-400 text-[11px] underline-offset-2 hover:underline transition-colors"
            >
              Reset demo data
            </button>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
