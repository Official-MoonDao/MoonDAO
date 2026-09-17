import { useCallback, useEffect, useState } from 'react'
import { UNIT } from './constants'

export type PatronApiRow = {
  payer: string
  displayName?: string
  totalWei: string
  count: number
  firstTs: number
  lastTs: number
}

export type PrizePatronsState = {
  patrons: PatronApiRow[]
  totalDirectEth: number
  patronCount: number
  otherRoutes: { count: number; totalEth: number }
  asOf: number | null
  complete: boolean
  status: 'loading' | 'ready' | 'error'
  refresh: (opts?: { fresh?: boolean }) => void
}

export function usePrizePatrons(opts: {
  deprizeId?: number
  chainId?: number
  refreshNonce?: number
  enabled?: boolean
}): PrizePatronsState {
  const [state, setState] = useState<Omit<PrizePatronsState, 'refresh'>>({
    patrons: [],
    totalDirectEth: 0,
    patronCount: 0,
    otherRoutes: { count: 0, totalEth: 0 },
    asOf: null,
    complete: true,
    status: 'loading',
  })

  const load = useCallback(
    async (fresh?: boolean) => {
      if (!opts.enabled || !opts.deprizeId || !opts.chainId) {
        setState((prev) => ({ ...prev, status: 'ready', patrons: [], patronCount: 0 }))
        return
      }
      setState((prev) => ({ ...prev, status: prev.asOf ? prev.status : 'loading' }))
      try {
        const qs = new URLSearchParams({
          deprizeId: String(opts.deprizeId),
          chainId: String(opts.chainId),
        })
        if (fresh) qs.set('fresh', '1')
        const res = await fetch(`/api/deprize/patrons?${qs}`)
        const body = await res.json()
        if (!res.ok || body.complete === false) {
          setState((prev) => ({ ...prev, status: 'error', complete: false }))
          return
        }
        setState({
          patrons: body.patrons || [],
          totalDirectEth: Number(BigInt(body.totalDirectWei || '0')) / Number(UNIT),
          patronCount: body.patronCount || 0,
          otherRoutes: {
            count: body.otherRoutes?.count || 0,
            totalEth: Number(BigInt(body.otherRoutes?.totalWei || '0')) / Number(UNIT),
          },
          asOf: body.asOf ?? Date.now(),
          complete: true,
          status: 'ready',
        })
      } catch {
        setState((prev) => ({ ...prev, status: 'error' }))
      }
    },
    [opts.enabled, opts.deprizeId, opts.chainId]
  )

  useEffect(() => {
    load(opts.refreshNonce ? true : false)
  }, [load, opts.refreshNonce])

  return {
    ...state,
    refresh: (args) => {
      load(args?.fresh)
    },
  }
}
