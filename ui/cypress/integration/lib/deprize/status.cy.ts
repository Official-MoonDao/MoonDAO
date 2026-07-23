import { MarketStage } from '@/lib/deprize/constants'
import { DePrizeState } from '@/lib/deprize/lifecycle'
import {
  deprizeListBucket,
  formatBettingCloses,
  isMintConfigured,
  reconcileBettingStatus,
} from '@/lib/deprize/status'

describe('deprize status helpers', () => {
  describe('reconcileBettingStatus', () => {
    it('keeps the registry "Accepting bets" copy when trading is Running and mint is wired', () => {
      const view = reconcileBettingStatus({
        bettingOpen: true,
        marketStage: MarketStage.Running,
        mintConfigured: true,
        registryState: DePrizeState.OPEN,
        marketBound: true,
      })
      expect(view.bettingBlockedReason).to.equal(undefined)
      expect(view.statusLabelOverride).to.equal(undefined)
      expect(view.effectiveDescription).to.include('Accepting bets')
    })

    it('surfaces Open · paused when registry is OPEN but LMSR is Paused (DePrize #3)', () => {
      const view = reconcileBettingStatus({
        bettingOpen: true,
        marketStage: MarketStage.Paused,
        mintConfigured: true,
        registryState: DePrizeState.OPEN,
        marketBound: true,
      })
      expect(view.statusLabelOverride).to.equal('Open · paused')
      expect(view.effectiveDescription).to.include('paused')
      expect(view.effectiveDescription).to.not.include('Accepting bets')
    })

    it('does not flash Accepting bets while LMSR stage is still loading', () => {
      const view = reconcileBettingStatus({
        bettingOpen: true,
        marketStage: undefined,
        mintConfigured: true,
        registryState: DePrizeState.OPEN,
        marketBound: true,
      })
      expect(view.effectiveDescription).to.include('Loading market')
      expect(view.effectiveDescription).to.not.include('Accepting bets')
    })

    it('surfaces Open · no market when LMSR is unbound (DePrize #1/#2)', () => {
      const view = reconcileBettingStatus({
        bettingOpen: true,
        marketStage: undefined,
        mintConfigured: true,
        registryState: DePrizeState.OPEN,
        marketBound: false,
      })
      expect(view.statusLabelOverride).to.equal('Open · no market')
      expect(view.effectiveDescription).to.include('No prediction market')
      expect(view.effectiveDescription).to.not.include('Accepting bets')
    })

    it('surfaces Open · market closed when LMSR is Closed', () => {
      const view = reconcileBettingStatus({
        bettingOpen: true,
        marketStage: MarketStage.Closed,
        mintConfigured: true,
        registryState: DePrizeState.OPEN,
        marketBound: true,
      })
      expect(view.statusLabelOverride).to.equal('Open · market closed')
      expect(view.effectiveDescription).to.include('closed')
    })

    it('surfaces Open · betting unavailable when mint router is unwired', () => {
      const view = reconcileBettingStatus({
        bettingOpen: true,
        marketStage: MarketStage.Running,
        mintConfigured: false,
        registryState: DePrizeState.OPEN,
        marketBound: true,
      })
      expect(view.statusLabelOverride).to.equal('Open · betting unavailable')
      expect(view.effectiveDescription).to.include("isn't wired")
    })

    it('does not invent a blocked reason when betting is not open', () => {
      const view = reconcileBettingStatus({
        bettingOpen: false,
        marketStage: MarketStage.Paused,
        mintConfigured: false,
        registryState: DePrizeState.LOCKED,
      })
      expect(view.bettingBlockedReason).to.equal(undefined)
      expect(view.statusLabelOverride).to.equal(undefined)
      expect(view.effectiveDescription).to.include('closed')
    })
  })

  describe('deprizeListBucket', () => {
    const base = {
      mintConfigured: true,
      marketBound: true as boolean | undefined,
      marketStage: MarketStage.Running as number | undefined,
      marketLoading: false,
      isTerminal: false,
    }

    it('puts unbound OPEN shells in Former (closed)', () => {
      expect(
        deprizeListBucket({
          ...base,
          state: DePrizeState.OPEN,
          marketBound: false,
          marketStage: undefined,
        }),
      ).to.equal('closed')
    })

    it('puts SETTLED / winner-declared in Former', () => {
      expect(
        deprizeListBucket({
          ...base,
          state: DePrizeState.SETTLED,
          isTerminal: false,
        }),
      ).to.equal('closed')
    })

    it('keeps paused but bound OPEN markets in Live', () => {
      expect(
        deprizeListBucket({
          ...base,
          state: DePrizeState.OPEN,
          marketStage: MarketStage.Paused,
        }),
      ).to.equal('live')
    })

    it('keeps Running OPEN markets in Live', () => {
      expect(
        deprizeListBucket({
          ...base,
          state: DePrizeState.OPEN,
          marketStage: MarketStage.Running,
        }),
      ).to.equal('live')
    })

    it('returns loading while market binding is unresolved', () => {
      expect(
        deprizeListBucket({
          ...base,
          state: DePrizeState.OPEN,
          marketBound: undefined,
          marketLoading: true,
        }),
      ).to.equal('loading')
    })
  })

  describe('formatBettingCloses', () => {
    it('shows a countdown before sunset', () => {
      const now = Date.UTC(2026, 6, 18, 0, 0, 0)
      const sunsetSec = Math.floor(now / 1000) + 90 * 60 // 1h 30m
      expect(formatBettingCloses(sunsetSec, now)).to.equal('1h 30m')
    })

    it('shows day+hour for multi-day windows', () => {
      const now = Date.UTC(2026, 6, 18, 0, 0, 0)
      const sunsetSec = Math.floor(now / 1000) + 2 * 86400 + 5 * 3600
      expect(formatBettingCloses(sunsetSec, now)).to.equal('2d 5h')
    })

    it('shows Closing soon once sunset has passed', () => {
      const now = Date.UTC(2026, 6, 18, 0, 0, 0)
      const sunsetSec = Math.floor(now / 1000) - 60
      expect(formatBettingCloses(sunsetSec, now)).to.equal('Closing soon')
    })

    it('returns — for missing sunset', () => {
      expect(formatBettingCloses(0n)).to.equal('—')
    })
  })

  describe('isMintConfigured', () => {
    it('accepts a 0x address', () => {
      expect(isMintConfigured('0x299F163705AbBFa1A8DE7670F33171730F828F3D')).to.equal(
        true,
      )
    })

    it('rejects empty / invalid', () => {
      expect(isMintConfigured('')).to.equal(false)
      expect(isMintConfigured(undefined)).to.equal(false)
      expect(isMintConfigured('0xabc')).to.equal(false)
    })
  })
})
