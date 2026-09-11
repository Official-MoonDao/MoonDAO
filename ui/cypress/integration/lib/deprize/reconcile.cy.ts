import { getAddress } from 'viem'
import { complianceAlertPayload } from '@/lib/deprize/complianceAlerts'
import { PERMIT_MATCH_CLOCK_SKEW_SECONDS, permitCoversBet } from '@/lib/deprize/permitLog'
import {
  authorizeCronRequest,
  betHasMatchingPermit,
  classifyLmsrTrade,
  nextReconcileCursor,
  parseReconcileStartBlock,
  parseStoredCursor,
  reconcileCursorKey,
  resolveReconcileWindow,
} from '@/lib/deprize/reconcile'

const mint = getAddress('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
const user = getAddress('0x1234567890123456789012345678901234567890')
const other = getAddress('0x1111111111111111111111111111111111111111')

describe('deprize LMSR trade classification', () => {
  it('ignores a buy routed through DePrizeMint', () => {
    expect(
      classifyLmsrTrade({
        transactor: mint,
        mintAddress: mint.toLowerCase(),
        outcomeTokenAmounts: [1n, 0n, 0n],
      })
    ).to.equal('ignored-mint')
  })

  it('ignores a user negative-only trade (direct sell)', () => {
    expect(
      classifyLmsrTrade({
        transactor: user,
        mintAddress: mint,
        outcomeTokenAmounts: [0n, -5n, 0n],
      })
    ).to.equal('ignored-sell')
  })

  it('alerts on a non-Mint trade with any positive outcome amount', () => {
    expect(
      classifyLmsrTrade({
        transactor: user,
        mintAddress: mint,
        outcomeTokenAmounts: [10n, 0n, 0n],
      })
    ).to.equal('direct-buy-review-required')
  })

  it('alerts on a mixed positive/negative trade', () => {
    expect(
      classifyLmsrTrade({
        transactor: user,
        mintAddress: mint,
        outcomeTokenAmounts: [4n, -2n, 0n],
      })
    ).to.equal('direct-buy-review-required')
  })
})

describe('deprize bet permit matching', () => {
  const issuedAt = '2026-09-11T18:00:00.000Z'
  const issuedAtSec = Math.floor(Date.parse(issuedAt) / 1000)
  const record = {
    wallet: user,
    deprizeId: 1,
    chainId: 42161,
    issuedAt,
    deadline: String(issuedAtSec + 120),
  }

  it('reconciles a bet inside the matching permit window', () => {
    expect(
      betHasMatchingPermit([record], {
        wallet: user,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec + 30,
      })
    ).to.equal(true)
    expect(
      permitCoversBet({
        record,
        wallet: user,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec + 30,
      })
    ).to.equal(true)
    expect(
      betHasMatchingPermit([record], {
        wallet: user,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec - 30,
      })
    ).to.equal(true)
    expect(
      betHasMatchingPermit([record], {
        wallet: user,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec - PERMIT_MATCH_CLOCK_SKEW_SECONDS - 1,
      })
    ).to.equal(false)
  })

  it('leaves a bet unmatched when wallet, DePrize, chain, or window disagree', () => {
    expect(
      betHasMatchingPermit([record], {
        wallet: other,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec + 30,
      })
    ).to.equal(false)
    expect(
      betHasMatchingPermit([record], {
        wallet: user,
        deprizeId: 2,
        chainId: 42161,
        blockTimestampSec: issuedAtSec + 30,
      })
    ).to.equal(false)
    expect(
      betHasMatchingPermit([record], {
        wallet: user,
        deprizeId: 1,
        chainId: 1,
        blockTimestampSec: issuedAtSec + 30,
      })
    ).to.equal(false)
    expect(
      betHasMatchingPermit([record], {
        wallet: user,
        deprizeId: 1,
        chainId: 42161,
        blockTimestampSec: issuedAtSec + 121,
      })
    ).to.equal(false)
  })
})

describe('deprize reconcile cursor', () => {
  it('requires a start block on the first run', () => {
    expect(
      resolveReconcileWindow({
        lastProcessedBlock: null,
        startBlock: parseReconcileStartBlock(undefined),
        latestBlock: 100,
      })
    ).to.deep.equal({
      ok: false,
      error: 'DEPRIZE_RECONCILE_START_BLOCK is required on the first run',
    })
  })

  it('opens from the start block, then from the last processed block + 1', () => {
    expect(
      resolveReconcileWindow({
        lastProcessedBlock: null,
        startBlock: 50,
        latestBlock: 80,
      })
    ).to.deep.equal({ ok: true, empty: false, fromBlock: 50, toBlock: 80 })
    expect(
      resolveReconcileWindow({
        lastProcessedBlock: 80,
        startBlock: 50,
        latestBlock: 90,
      })
    ).to.deep.equal({ ok: true, empty: false, fromBlock: 81, toBlock: 90 })
  })

  it('leaves the cursor unchanged when the job fails', () => {
    expect(
      nextReconcileCursor({
        lastProcessedBlock: 80,
        succeeded: false,
        processedThrough: 90,
      })
    ).to.equal(80)
    expect(
      nextReconcileCursor({
        lastProcessedBlock: null,
        succeeded: false,
        processedThrough: 90,
      })
    ).to.equal(null)
    expect(
      nextReconcileCursor({
        lastProcessedBlock: 80,
        succeeded: true,
        processedThrough: 90,
      })
    ).to.equal(90)
  })

  it('parses the stored cursor and names the Redis key by chain', () => {
    expect(parseStoredCursor('495964196')).to.equal(495964196)
    expect(parseStoredCursor(null)).to.equal(null)
    expect(reconcileCursorKey(42161)).to.equal('deprize:reconcile:last-block:42161')
  })
})

describe('deprize cron authorization', () => {
  it('returns 503 in production when CRON_SECRET is unset', () => {
    expect(
      authorizeCronRequest({
        production: true,
        expectedSecret: undefined,
        providedSecret: 'anything',
      })
    ).to.deep.equal({ ok: false, status: 503, message: 'CRON_SECRET is not configured' })
  })

  it('rejects a mismatched secret and allows a matching one', () => {
    expect(
      authorizeCronRequest({
        production: true,
        expectedSecret: 's3cret',
        providedSecret: 'nope',
      })
    ).to.deep.equal({ ok: false, status: 401, message: 'Unauthorized' })
    expect(
      authorizeCronRequest({
        production: true,
        expectedSecret: 's3cret',
        providedSecret: 's3cret',
      })
    ).to.deep.equal({ ok: true })
  })
})

describe('deprize compliance alert payload', () => {
  it('never includes a raw IP field', () => {
    const payload = complianceAlertPayload({
      kind: 'wallet-denied',
      wallet: user,
      country: 'US',
      connectionKind: 'clear',
      reason: 'restricted-jurisdiction',
      timestamp: '2026-09-11T18:00:00.000Z',
    })
    expect(payload).to.not.have.property('ip')
    expect(payload).to.not.have.property('ipHash')
    expect(Object.keys(payload).sort()).to.deep.equal(
      ['connectionKind', 'country', 'kind', 'reason', 'timestamp', 'wallet'].sort()
    )
  })
})
