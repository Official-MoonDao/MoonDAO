import {
  DePrizeState,
  DEPRIZE_STATE_META,
  deriveDePrizeFlags,
  isRefundableState,
  shouldSurfaceResolution,
  isTerminalState,
  positionRedeemValue,
  resolvePayoutVector,
} from '@/lib/deprize/lifecycle'

const ETH = 10n ** 18n

describe('deprize lifecycle derivations', () => {
  describe('deriveDePrizeFlags (mirrors DePrizeRegistry views)', () => {
    it('bettingOpen only in OPEN with no cancellation pending', () => {
      expect(deriveDePrizeFlags(DePrizeState.OPEN, 0n).bettingOpen).to.equal(true)
      // Announced cancellation forces betting closed immediately (M1 doc §Cancellation).
      expect(deriveDePrizeFlags(DePrizeState.OPEN, 12345n).bettingOpen).to.equal(false)
      for (const s of [
        DePrizeState.NONE,
        DePrizeState.DRAFT,
        DePrizeState.LOCKED,
        DePrizeState.VOTING,
        DePrizeState.SETTLED,
        DePrizeState.M1_RELEASED,
        DePrizeState.M2_COMPLETE,
        DePrizeState.M2_FAILED,
        DePrizeState.CANCELLED,
        DePrizeState.NO_WINNER,
      ]) {
        expect(deriveDePrizeFlags(s, 0n).bettingOpen, `state ${s}`).to.equal(false)
      }
    })

    it('refundable terminals are exactly CANCELLED / NO_WINNER / M2_FAILED', () => {
      const refundable = [
        DePrizeState.CANCELLED,
        DePrizeState.NO_WINNER,
        DePrizeState.M2_FAILED,
      ]
      for (let s = 0; s <= 10; s++) {
        const expected = refundable.includes(s)
        expect(deriveDePrizeFlags(s, 0n).isRefundable, `state ${s}`).to.equal(expected)
        expect(isRefundableState(s), `helper state ${s}`).to.equal(expected)
      }
    })

    it('terminal states are the refundables plus M2_COMPLETE', () => {
      const terminal = [
        DePrizeState.M2_COMPLETE,
        DePrizeState.M2_FAILED,
        DePrizeState.CANCELLED,
        DePrizeState.NO_WINNER,
      ]
      for (let s = 0; s <= 10; s++) {
        const expected = terminal.includes(s)
        expect(deriveDePrizeFlags(s, 0n).isTerminal, `state ${s}`).to.equal(expected)
        expect(isTerminalState(s), `helper state ${s}`).to.equal(expected)
      }
    })

    it('cancellationPending follows the notice timestamp', () => {
      expect(deriveDePrizeFlags(DePrizeState.OPEN, 0n).cancellationPending).to.equal(false)
      expect(deriveDePrizeFlags(DePrizeState.OPEN, 1n).cancellationPending).to.equal(true)
    })

    it('has display metadata for every state', () => {
      for (let s = 0; s <= 10; s++) {
        const meta = DEPRIZE_STATE_META[s as DePrizeState]
        expect(meta, `state ${s}`).to.not.equal(undefined)
        expect(meta.label.length).to.be.greaterThan(0)
        expect(meta.description.length).to.be.greaterThan(0)
      }
    })
  })

  describe('resolvePayoutVector (CTF payout interpretation)', () => {
    it('unresolved while payoutDenominator is 0 or unknown', () => {
      expect(resolvePayoutVector([0n, 0n, 0n], 0n)).to.deep.equal({
        resolved: false,
        winningIndex: -1,
        isRefundVector: false,
      })
      expect(resolvePayoutVector([1n, 0n, 0n], undefined).resolved).to.equal(false)
    })

    it('single-winner vector picks the winning slot', () => {
      expect(resolvePayoutVector([0n, 1n, 0n], 1n)).to.deep.equal({
        resolved: true,
        winningIndex: 1,
        isRefundVector: false,
      })
    })

    it('equal-payout vector [1,1,...,1] is the refund case (M4b)', () => {
      const r = resolvePayoutVector([1n, 1n, 1n], 3n)
      expect(r.resolved).to.equal(true)
      expect(r.isRefundVector).to.equal(true)
      expect(r.winningIndex).to.equal(-1)
    })

    it('multi-positive but unequal vectors resolve without a single winner', () => {
      const r = resolvePayoutVector([2n, 1n, 0n], 3n)
      expect(r.resolved).to.equal(true)
      expect(r.winningIndex).to.equal(-1)
      expect(r.isRefundVector).to.equal(false)
    })
  })

  describe('shouldSurfaceResolution (registry + market gate)', () => {
    it('ignores a CTF refund vector while registry is still OPEN and market not Closed', () => {
      expect(
        shouldSurfaceResolution({
          ctfResolved: true,
          registryState: DePrizeState.OPEN,
          marketClosed: false,
        }),
      ).to.equal(false)
    })

    it('surfaces when registry is settled / refundable', () => {
      expect(
        shouldSurfaceResolution({
          ctfResolved: true,
          registryState: DePrizeState.SETTLED,
          marketClosed: false,
        }),
      ).to.equal(true)
      expect(
        shouldSurfaceResolution({
          ctfResolved: true,
          registryState: DePrizeState.NO_WINNER,
          marketClosed: false,
        }),
      ).to.equal(true)
    })

    it('surfaces when the LMSR is Closed with a reported vector', () => {
      expect(
        shouldSurfaceResolution({
          ctfResolved: true,
          registryState: DePrizeState.OPEN,
          marketClosed: true,
        }),
      ).to.equal(true)
    })

    it('stays hidden when CTF has not reported', () => {
      expect(
        shouldSurfaceResolution({
          ctfResolved: false,
          registryState: DePrizeState.SETTLED,
          marketClosed: true,
        }),
      ).to.equal(false)
    })
  })

  describe('positionRedeemValue (CTF integer math)', () => {
    it('winner redeems 1:1', () => {
      expect(positionRedeemValue(5n * ETH, 1n, 1n)).to.equal(5n * ETH)
    })

    it('loser redeems 0', () => {
      expect(positionRedeemValue(5n * ETH, 0n, 1n)).to.equal(0n)
    })

    it('refund vector pays floor(balance / N) per position', () => {
      // 1 ETH position, 3 outcomes: floor(1e18 / 3), matching the CTF.
      expect(positionRedeemValue(ETH, 1n, 3n)).to.equal(ETH / 3n)
      // Indivisible amounts floor (this is the parimutuel rounding bettors see).
      expect(positionRedeemValue(10n, 1n, 3n)).to.equal(3n)
    })

    it('guards zero denominator and empty balances', () => {
      expect(positionRedeemValue(ETH, 1n, 0n)).to.equal(0n)
      expect(positionRedeemValue(0n, 1n, 3n)).to.equal(0n)
    })
  })
})
