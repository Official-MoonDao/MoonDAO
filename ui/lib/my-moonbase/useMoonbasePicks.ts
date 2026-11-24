import { usePrivy } from '@privy-io/react-auth'
import { FORECASTS_TABLE_NAMES } from 'const/config'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Chain } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useDePrizeGoalOdds } from '@/lib/deprize/useDePrizeGoalOdds'
import { readPendingHandoffs } from '@/lib/forecasts/guestHandoff'
import { useForecastWriter } from '@/lib/forecasts/useForecastWriter'
import type { SharedGoal } from '@/lib/lunar-atlas/types'
import { tablelandQueryEndpoint } from '@/lib/tableland/endpoint'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { subscribeRoster } from '@/lib/forecasts/rosterRefresh'
import {
  mergePicks,
  overlayForecastRows,
  picksFromBets,
  picksFromForecastRows,
  raceBooks,
  type ForecastRow,
  type MoonbasePick,
  type PickOverlay,
  type RaceBook,
} from './picks'

export type MoonbasePicksStatus =
  /** The wallet session is still resolving, or the first read is in flight. */
  | 'loading'
  /** Nobody is signed in and no guest has predicted on this device. */
  | 'signed-out'
  /** Predictions are not saved on the selected network. */
  | 'unsupported'
  /** The read failed. Nothing is known about what this visitor backs. */
  | 'error'
  | 'ready'

export type MoonbasePicksState = {
  status: MoonbasePicksStatus
  picks: MoonbasePick[]
  /**
   * The live market's balances are still being read. Until they are, an asset
   * missing from `picks` may yet turn out to be backed by a bet.
   */
  betsPending: boolean
  /** Every race that can be predicted here, with what its predict window needs. */
  races: PredictableRace[]
  /** The DePrize-bound race's market, once read. Predicting it waits on a settled payout. */
  market: { goalId: string; resolved: boolean; payoutPending: boolean } | null
  /** Wallet these predictions are saved from, lower case. The base is saved under it too. */
  address: string | undefined
  /** False while the session is resolving, when a missing `address` does not yet mean signed out. */
  identityReady: boolean
  refresh: () => void
}

export type PredictableRace = RaceBook & {
  /** Outcome names in slot order, the same ones the race panel saves under. */
  labels: string[]
}

const REFOCUS_MIN_MS = 5_000

async function fetchForecastRows(
  chainId: number,
  table: string,
  address: string
): Promise<ForecastRow[]> {
  const statement = `SELECT voteId, vote FROM ${table} WHERE address = '${address}'`
  // `t` keeps the gateway from answering a just-saved prediction from cache.
  const url = `${tablelandQueryEndpoint(chainId)}?statement=${encodeURIComponent(
    statement
  )}&t=${Date.now()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`forecast read failed: ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error('forecast read returned no rows array')
  return rows
    .map((row) => ({ voteId: Number(row?.voteId), vote: row?.vote }))
    .filter((row) => Number.isInteger(row.voteId))
}

/**
 * The hardware this visitor has backed: free predictions saved from the wallet
 * the race panels write with (the active account, or the guest wallet for a
 * signed-out visitor), plus any outcome they hold a bet on in a live DePrize.
 */
export function useMoonbasePicks(
  chain: Chain,
  goals: readonly SharedGoal[],
  nameOf: (projectId: string) => string | undefined
): MoonbasePicksState {
  const chainSlug = getChainSlug(chain)
  const { ready, authenticated } = usePrivy()
  const { writer } = useForecastWriter()
  const account = useActiveAccount()
  const address = writer?.address?.toLowerCase()
  const table = FORECASTS_TABLE_NAMES[chainSlug] as string | undefined

  const books = useMemo(() => raceBooks(chainSlug, goals), [chainSlug, goals])
  const nameRef = useRef(nameOf)
  nameRef.current = nameOf
  const races = useMemo<PredictableRace[]>(
    () =>
      books.map((book) => ({
        ...book,
        labels: book.outcomeIds.map((projectId, index) =>
          projectId
            ? nameRef.current(projectId) ?? `Team #${index + 1}`
            : book.deprizeId !== undefined
            ? 'Open Field'
            : `Team #${index + 1}`
        ),
      })),
    [books]
  )

  // One live market at most. Bets come from the signed-in account; a guest
  // wallet cannot hold one.
  const betBook = useMemo(() => books.find((book) => book.deprizeId !== undefined), [books])
  const odds = useDePrizeGoalOdds(chain, betBook?.goalId, account?.address)

  const [rows, setRows] = useState<ForecastRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  // Predictions saved from this page, by the wallet that saved them.
  const [overlays, setOverlays] = useState<(PickOverlay & { address: string })[]>([])

  useEffect(() => {
    setRows(null)
    setFailed(false)
  }, [address, chainSlug])

  useEffect(() => setOverlays([]), [chainSlug])

  // The predict window announces every save and removal. The gateway will not
  // show the new row for a while, and the hardware should unlock now.
  useEffect(
    () =>
      subscribeRoster((notice) => {
        if (notice.chain !== chainSlug) return
        const race = races.find((r) => r.voteId === notice.deprizeId)
        if (!race) return
        const index = notice.removed
          ? null
          : notice.pick === undefined
          ? -1
          : race.labels.indexOf(notice.pick)
        if (index === -1) return
        const from = notice.address.toLowerCase()
        setOverlays((prev) => [
          ...prev.filter((o) => !(o.voteId === race.voteId && o.address === from)),
          { voteId: race.voteId, index, address: from },
        ])
      }),
    [chainSlug, races]
  )

  useEffect(() => {
    if (!address || !table) return
    let cancelled = false
    fetchForecastRows(chain.id, table, address)
      .then((next) => {
        if (cancelled) return
        setRows(next)
        setFailed(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[my-moonbase] could not read predictions', err)
        // A failed refresh keeps the last good read rather than emptying the base.
        setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [address, table, chain.id, nonce])

  // A prediction made in another tab, or on Moon Base Zero. Read again on the way back.
  const lastFocus = useRef(0)
  useEffect(() => {
    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocus.current < REFOCUS_MIN_MS) return
      lastFocus.current = now
      refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const picks = useMemo(() => {
    // A guest who signed in to an existing account has their predictions held
    // on this device until the prize page writes them again from the account.
    const handoffs: ForecastRow[] = readPendingHandoffs()
      .filter((row) => row.chainSlug === chainSlug)
      .map((row) => ({ voteId: row.deprizeId, vote: row.vote }))
    const mine = overlays.filter((o) => o.address === address)
    return mergePicks([
      ...picksFromForecastRows(overlayForecastRows([...(rows ?? []), ...handoffs], mine, books), books),
      ...picksFromBets(betBook, account ? odds.outcomes : []),
    ])
    // `nonce` re-reads the handoff store, which is not React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, overlays, address, books, betBook, account, odds.outcomes, chainSlug, nonce])

  const market = useMemo(
    () =>
      betBook
        ? {
            goalId: betBook.goalId,
            resolved: odds.resolved,
            payoutPending: odds.market.marketConfigured && !odds.market.payoutSettled,
          }
        : null,
    [betBook, odds.resolved, odds.market.marketConfigured, odds.market.payoutSettled]
  )

  let status: MoonbasePicksStatus
  if (!table) status = 'unsupported'
  else if (!ready || (authenticated && !address)) status = 'loading'
  else if (!address) status = 'signed-out'
  else if (rows === null) status = failed ? 'error' : 'loading'
  else status = 'ready'

  return {
    status,
    picks,
    betsPending: !!account && !!betBook && odds.loading,
    races,
    market,
    address,
    identityReady: ready && !(authenticated && !address),
    refresh,
  }
}
