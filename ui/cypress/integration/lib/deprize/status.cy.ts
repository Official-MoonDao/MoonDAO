import { MarketStage } from '@/lib/deprize/constants'
import { DePrizeState } from '@/lib/deprize/lifecycle'
import {
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
      })
      expect(view.bettingBlockedReason).to.equal(undefined)
      expect(view.statusLabelOverride).to.equal(undefined)
      expect(view.effectiveDescription).to.include('Accepting bets')
    })

    it('surfaces Open · paused when registry is OPEN but LMSR is Paused (DePrize #3)', () => {
      const view = reconcileBettingStatus({
        bettingOpen: true,
        marketStage: MarketStage.Paused,
        mintConfigured: false,
        registryState: DePrizeState.OPEN,
      })
      expect(view.statusLabelOverride).to.equal('Open · paused')
      expect(view.effectiveDescription).to.include('paused')
      expect(view.effectiveDescription).to.not.include('Accepting bets')
    })

    it('surfaces Open · market closed when LMSR is Closed', () => {
      const view = reconcileBettingStatus({
        bettingOpen: true,
        marketStage: MarketStage.Closed,
        mintConfigured: true,
        registryState: DePrizeState.OPEN,
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
