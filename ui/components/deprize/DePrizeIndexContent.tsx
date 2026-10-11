import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { useLogin } from '@privy-io/react-auth'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import { CAPABILITY_LADDER } from '@/lib/deprize/capabilityLadder'
import { getFeaturedLiveDePrizeId, isDePrizeGoalMarketBound } from '@/lib/deprize/competitions'
import {
  DEPRIZE_RESTRICTED_PREDICT_COPY,
  deprizeOgDescription,
  UNIT,
} from '@/lib/deprize/constants'
import { spendableFromBalanceEth } from '@/lib/deprize/gas-reserve'
import { resetMockData } from '@/lib/deprize/mockMarket'
import type { DePrizePageProps } from '@/lib/deprize/pageEligibility'
import { deprizeReadChain, deprizeReadClient } from '@/lib/deprize/read'
import { orgById, projectById, SEED_ATLAS } from '@/lib/lunar-atlas'
import {
  goalIndexCategory,
  PROJECT_TYPE_COLOR,
  PROJECT_TYPE_LABEL,
} from '@/lib/lunar-atlas/display'
import type { ProjectType } from '@/lib/lunar-atlas/types'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import CategoryIcon from '@/components/deprize/CategoryIcon'
import HeroCarousel, { type HeroSlide } from '@/components/deprize/HeroCarousel'
import LiveDePrizeHero from '@/components/deprize/LiveDePrizeHero'
import RaceMarketCard, { type IndexTab } from '@/components/deprize/RaceMarketCard'
import { TOUCH } from '@/components/deprize/detail/primitives'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

/** Horizontally scrolling row of cards with paging arrows, like Polymarket's "Popular". */
function ScrollRow({
  heading,
  headingId,
  children,
}: {
  heading: string
  headingId: string
  children: ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const page = (dir: 1 | -1) => {
    const row = rowRef.current
    if (row) row.scrollBy({ left: dir * row.clientWidth * 0.9, behavior: 'smooth' })
  }
  const arrow = `grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white ${TOUCH}`
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-lg font-semibold text-white">
          {heading}
        </h2>
        <div className="hidden items-center gap-1 sm:flex">
          <button type="button" aria-label="Scroll left" onClick={() => page(-1)} className={arrow}>
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Scroll right" onClick={() => page(1)} className={arrow}>
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={rowRef}
        className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 scrollbar-hide"
      >
        {children}
      </div>
    </section>
  )
}

export default function DePrizeIndexContent({ restricted }: DePrizePageProps) {
  // Follow the app's live selected chain (wallet / header dropdown), not the
  // build-time default — otherwise switching networks never re-queries DePrize.
  const { selectedChain: chain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const userAddress = account?.address
  const { login } = useLogin()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ProjectType | 'all'>('all')
  const [activeTab, setActiveTab] = useState<IndexTab>('all')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [spendableEth, setSpendableEth] = useState(0)
  const [positionsMap, setPositionsMap] = useState<Record<string, boolean>>({})

  // Capability races Moon Base Zero tracks, plus any other market-bearing
  // shared goal (Touchdown is a live landing prize; Night Shift is a chamber
  // night-power prize — neither is a tech-tree site). The index stays
  // atlas-sourced so it cannot drift into on-chain registry fixtures.
  const races = useMemo(() => {
    return (
      SEED_ATLAS.sharedGoals
        // Crewed HLS is the same landing question as Touchdown. Keep Touchdown.
        // The crewed terrain vehicle was registered as Sepolia id 4 by mistake
        // and is withdrawn; First Tracks is the rover prize.
        .filter((g) => g.id !== 'shared-crewed-lander' && g.id !== 'shared-lunar-rover')
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
    )
  }, [])

  const categories = useMemo(() => {
    const set = new Set<ProjectType>()
    races.forEach((r) => {
      const listed = goalIndexCategory(r.goal)
      if (listed) set.add(listed)
    })
    return Array.from(set).sort((a, b) =>
      PROJECT_TYPE_LABEL[a].localeCompare(PROJECT_TYPE_LABEL[b])
    )
  }, [races])

  const filteredRaces = useMemo(() => {
    const q = search.trim().toLowerCase()
    return races
      .filter((r) => {
        if (category !== 'all' && goalIndexCategory(r.goal) !== category) return false
        if (!q) return true
        if (r.goal.title.toLowerCase().includes(q)) return true
        return r.competitors.some((c) => c.project.name.toLowerCase().includes(q))
      })
      .sort((a, b) => {
        const aLive = isDePrizeGoalMarketBound(chainSlug, a.goal.id)
        const bLive = isDePrizeGoalMarketBound(chainSlug, b.goal.id)
        if (aLive === bLive) return 0
        return aLive ? -1 : 1
      })
  }, [races, search, category, chainSlug])

  const liveRaces = useMemo(
    () => filteredRaces.filter((r) => isDePrizeGoalMarketBound(chainSlug, r.goal.id)),
    [filteredRaces, chainSlug]
  )
  // Touchdown is the live prize with a real pool. It takes the full row;
  // the other live races sit on the row under it.
  const featuredLiveRace = useMemo(
    () => liveRaces.find((race) => race.goal.id === 'shared-next-landing'),
    [liveRaces]
  )
  const otherLiveRaces = useMemo(
    () => liveRaces.filter((race) => race.goal.id !== 'shared-next-landing'),
    [liveRaces]
  )
  const plannedRaces = useMemo(
    () => filteredRaces.filter((r) => !isDePrizeGoalMarketBound(chainSlug, r.goal.id)),
    [filteredRaces, chainSlug]
  )

  // Live on-chain competitions that aren't bound to a Moon Base Zero race
  // (Arbitrum #1 — The Moon Is A Harsh Mistress) take the hero slot. Atlas
  // race demos fill the grid below; fission no longer steals the featured
  // position when a real market is live on this chain.
  const featuredLiveId = useMemo(() => getFeaturedLiveDePrizeId(chainSlug), [chainSlug])

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

  // Default-deny real betting from the SSR DePrize verdict. Unknown country
  // arrives as restricted=true (getDePrizePageEligibility). Demo markets are
  // unaffected — RaceMarketCard never gates them on this reason.
  const bettingBlockedReason = restricted ? DEPRIZE_RESTRICTED_PREDICT_COPY : undefined

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ProjectType, number>> = {}
    races.forEach((r) => {
      const listed = goalIndexCategory(r.goal)
      if (listed) counts[listed] = (counts[listed] ?? 0) + 1
    })
    return counts
  }, [races])

  // "/" jumps to search, as on Polymarket.
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selectCategory = useCallback((c: ProjectType | 'all') => {
    setCategory(c)
    setActiveTab('all')
  }, [])

  const raceCardProps = {
    chain,
    chainSlug,
    account,
    userAddress,
    spendableEth,
    refreshNonce,
    activeTab,
    bettingBlockedReason,
    onConnectWallet: () => login(),
    onHasPosition: handleHasPosition,
    onDone: () => setRefreshNonce((n) => n + 1),
  }

  const heroSlides: HeroSlide[] = []
  if (featuredLiveId !== undefined) {
    heroSlides.push({
      key: `live-${featuredLiveId}`,
      render: (shown) => (
        <LiveDePrizeHero
          deprizeId={featuredLiveId}
          chain={chain}
          chainSlug={chainSlug}
          account={account}
          userAddress={userAddress}
          spendableEth={spendableEth}
          bettingBlockedReason={bettingBlockedReason}
          onDone={() => setRefreshNonce((n) => n + 1)}
          active={shown}
        />
      ),
    })
  }
  if (featuredLiveRace) {
    heroSlides.push({
      key: featuredLiveRace.goal.id,
      render: (shown) => (
        <RaceMarketCard
          goal={featuredLiveRace.goal}
          competitors={featuredLiveRace.competitors}
          {...raceCardProps}
          variant="featured"
          active={shown}
        />
      ),
    })
  }

  const navTab = (active: boolean) =>
    `-mb-px shrink-0 flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-white ${TOUCH} ${
      active ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-white'
    }`

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="DePrize"
        description={deprizeOgDescription(
          'Back a team in open capability races — live odds, growing prize pools, payouts when a winner is declared.'
        )}
      />
      <Container>
        <ContentLayout
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          preFooter={<NoticeFooter />}
        >
          <div className="flex w-full flex-col gap-6">
            {/* Top bar: title + search, then category tabs. */}
            <div className="flex flex-col gap-3 pt-6 sm:pt-8">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <h1 className="font-heading text-2xl font-semibold text-white">DePrize</h1>
                {/* 16px text on phones: iOS Safari zooms the page when a
                    focused input is any smaller. */}
                <div className="relative w-full sm:max-w-md sm:flex-1">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search races or teams…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-10 text-base text-white placeholder-gray-500 focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 sm:text-sm"
                  />
                  <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 text-[11px] text-gray-500 sm:block">
                    /
                  </kbd>
                </div>
              </div>

              <nav
                aria-label="DePrize categories"
                className="flex items-end gap-5 overflow-x-auto border-b border-white/[0.08] scrollbar-hide"
              >
                <button
                  type="button"
                  aria-pressed={activeTab === 'all' && category === 'all'}
                  onClick={() => selectCategory('all')}
                  className={navTab(activeTab === 'all' && category === 'all')}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={activeTab === 'all' && category === c}
                    onClick={() => selectCategory(c)}
                    className={navTab(activeTab === 'all' && category === c)}
                  >
                    {PROJECT_TYPE_LABEL[c]}
                  </button>
                ))}
                <span className="ml-auto" />
                <button
                  type="button"
                  aria-pressed={activeTab === 'positions'}
                  onClick={() => setActiveTab('positions')}
                  className={navTab(activeTab === 'positions')}
                >
                  My Positions
                  {!!account && (
                    <span className="tabular-nums text-xs opacity-70">{positionsCount}</span>
                  )}
                </button>
              </nav>
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-w-0 flex-col gap-8">
                {restricted && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                    {DEPRIZE_RESTRICTED_PREDICT_COPY}
                  </div>
                )}

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
                    {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}

                    {otherLiveRaces.length > 0 && (
                      <ScrollRow heading="Live" headingId="deprize-live-heading">
                        {otherLiveRaces.map(({ goal, competitors }) => (
                          <div key={goal.id} className="w-[min(320px,85vw)] shrink-0 snap-start">
                            <RaceMarketCard
                              goal={goal}
                              competitors={competitors}
                              {...raceCardProps}
                              variant="grid"
                            />
                          </div>
                        ))}
                      </ScrollRow>
                    )}

                    {plannedRaces.length > 0 && (
                      <section
                        aria-labelledby="deprize-planned-heading"
                        className="flex flex-col gap-3"
                      >
                        <h2
                          id="deprize-planned-heading"
                          className="text-lg font-semibold text-white"
                        >
                          Planned
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                          {plannedRaces.map(({ goal, competitors }) => (
                            <RaceMarketCard
                              key={goal.id}
                              goal={goal}
                              competitors={competitors}
                              {...raceCardProps}
                              variant="grid"
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {filteredRaces.length === 0 && featuredLiveId === undefined && (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        No races match your search.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex w-full max-w-[760px] flex-col gap-4">
                    {filteredRaces.map(({ goal, competitors }) => (
                      <RaceMarketCard
                        key={goal.id}
                        goal={goal}
                        competitors={competitors}
                        {...raceCardProps}
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
              </div>

              <aside className="flex min-w-0 flex-col gap-4">
                <button
                  type="button"
                  onClick={() => (account ? setActiveTab('positions') : login())}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/50 bg-indigo-500/[0.06] py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500/15 ${TOUCH}`}
                >
                  {account ? 'My positions' : 'Connect wallet'}
                  {!!account && (
                    <span className="rounded-md bg-white/10 px-1.5 text-xs tabular-nums">
                      {positionsCount}
                    </span>
                  )}
                </button>

                <a
                  href="/moonbase"
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white"
                >
                  <GlobeAltIcon className="absolute -bottom-6 -right-6 h-32 w-32 text-white/15 transition-transform group-hover:scale-110" />
                  <p className="text-xs text-blue-100/90">Moonbase</p>
                  <p className="mt-1 max-w-[12rem] font-heading text-xl font-bold uppercase italic leading-tight">
                    See every race on the Moon.
                  </p>
                  <span className="mt-4 inline-flex rounded-lg bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur group-hover:bg-white/25">
                    Open Moonbase
                  </span>
                </a>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <p className="text-xs text-gray-500">How it works</p>
                  <p id="deprize-intro" className="mt-1.5 text-sm leading-relaxed text-gray-300">
                    A DePrize is a market on who reaches a lunar capability first. You back a
                    competitor, and every bet grows the prize. See each one in Moonbase:{' '}
                    {CAPABILITY_LADDER.filter((rung) => rung.sharedGoalId).map((rung, i, list) => (
                      <span key={rung.key}>
                        <a
                          href={`/moonbase?race=${rung.sharedGoalId}`}
                          className="text-indigo-300 hover:text-indigo-200"
                        >
                          {rung.label}
                        </a>
                        {i < list.length - 1 ? ', ' : '.'}
                      </span>
                    ))}
                  </p>
                </div>

                <div className="hidden lg:block">
                  <p className="mb-2 px-1 text-sm font-semibold text-white">Categories</p>
                  <ul className="flex flex-col">
                    {categories.map((c) => (
                      <li key={c}>
                        <button
                          type="button"
                          onClick={() => selectCategory(c)}
                          className={`flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-white/[0.04] ${TOUCH} ${
                            activeTab === 'all' && category === c ? 'bg-white/[0.06]' : ''
                          }`}
                        >
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                            style={{
                              background: `${PROJECT_TYPE_COLOR[c]}1f`,
                              color: PROJECT_TYPE_COLOR[c],
                            }}
                          >
                            <CategoryIcon category={c} className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-white">
                            {PROJECT_TYPE_LABEL[c]}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-gray-500">
                            {categoryCounts[c] ?? 0} {categoryCounts[c] === 1 ? 'race' : 'races'}
                          </span>
                          <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-gray-600" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetMockData()
                    setRefreshNonce((n) => n + 1)
                  }}
                  className="self-start px-1 text-[11px] text-gray-600 underline-offset-2 transition-colors hover:text-gray-400 hover:underline"
                >
                  Reset demo data
                </button>
              </aside>
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
