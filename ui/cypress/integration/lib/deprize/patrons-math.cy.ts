import { DEPRIZE_FEE_ROUTER_ADDRESSES, DEPRIZE_MINT_ADDRESSES } from 'const/config'
import { aggregatePatrons, applyPatronSuppression, isDirectPatronPay } from '@/lib/deprize/patrons-math'
import {
  PATRONS_MAX_PAGES,
  buildPatronPayEventsQuery,
  dedupeEventsById,
  validatePatronsRequest,
} from '@/lib/deprize/patrons-query'
import { buildJBPayParams } from '@/lib/juicebox/payProject'

const ALICE = '0x1111111111111111111111111111111111111111'
const VITALIK = '0x2222222222222222222222222222222222222222'
const ATTACKER = '0x3333333333333333333333333333333333333333'
const SAFE = '0x4444444444444444444444444444444444444444'
const BETTOR = '0x5555555555555555555555555555555555555555'

describe('isDirectPatronPay / aggregatePatrons', () => {
  it('impersonation: from != beneficiary is never credited', () => {
    const result = aggregatePatrons(
      [{ from: ALICE, beneficiary: VITALIK, amount: '1', timestamp: 1, id: '1' }],
      'sepolia'
    )
    expect(result.patrons).to.deep.equal([])
    expect(result.totalDirectWei).to.equal(0n)
    expect(result.otherRoutes.count).to.equal(1)
    expect(result.excluded.mismatchedBeneficiary).to.equal(1)
  })

  it('treasury re-insertion via beneficiary does not appear', () => {
    const result = aggregatePatrons(
      [{ from: ATTACKER, beneficiary: SAFE, amount: '1', timestamp: 1 }],
      'sepolia'
    )
    expect(result.patronCount).to.equal(0)
    expect(result.otherRoutes.count).to.equal(1)
  })

  it('empty list is zero', () => {
    const result = aggregatePatrons([], 'sepolia')
    expect(result.patronCount).to.equal(0)
    expect(result.totalDirectWei).to.equal(0n)
  })

  it('mint and fee-router pays are protocol exclusions', () => {
    const mint = aggregatePatrons(
      [
        {
          from: DEPRIZE_MINT_ADDRESSES.sepolia,
          beneficiary: BETTOR,
          amount: '10',
          timestamp: 1,
        },
      ],
      'sepolia'
    )
    expect(mint.excluded.protocolPayer).to.equal(1)
    expect(mint.patronCount).to.equal(0)

    const router = aggregatePatrons(
      [
        {
          from: DEPRIZE_FEE_ROUTER_ADDRESSES.sepolia,
          beneficiary: SAFE,
          amount: '10',
          timestamp: 1,
        },
      ],
      'sepolia'
    )
    expect(router.excluded.protocolPayer).to.equal(1)
  })

  it('a protocol payer that pays itself is still excluded', () => {
    const mint = DEPRIZE_MINT_ADDRESSES.sepolia
    expect(isDirectPatronPay({ from: mint, beneficiary: mint, amount: '5' }, 'sepolia')).to.equal(
      false
    )
    expect(
      aggregatePatrons([{ from: mint, beneficiary: mint, amount: '5' }], 'sepolia').excluded
        .protocolPayer
    ).to.equal(1)
  })

  it('direct pays aggregate and sort deterministically', () => {
    const result = aggregatePatrons(
      [
        { from: ALICE, beneficiary: ALICE, amount: '5', timestamp: 20 },
        { from: ALICE, beneficiary: '0x1111111111111111111111111111111111111111', amount: '7', timestamp: 10 },
        { from: VITALIK, beneficiary: VITALIK, amount: '12', timestamp: 5 },
        { from: ATTACKER, beneficiary: ATTACKER, amount: '12', timestamp: 15 },
      ],
      'sepolia'
    )
    expect(result.patronCount).to.equal(3)
    expect(result.patrons[0].payer).to.equal(VITALIK)
    expect(result.patrons[1].payer).to.equal(ALICE)
    expect(result.patrons[1].count).to.equal(2)
    expect(result.patrons[2].payer).to.equal(ATTACKER)
    expect(result.patrons[2].totalWei).to.equal(12n)
  })

  it('checksum / case folds into one row', () => {
    const mixed = ALICE.slice(0, 2) + ALICE.slice(2).toUpperCase()
    const result = aggregatePatrons(
      [
        { from: ALICE, beneficiary: ALICE, amount: '1' },
        { from: mixed, beneficiary: mixed, amount: '2' },
      ],
      'sepolia'
    )
    expect(result.patronCount).to.equal(1)
    expect(result.totalDirectWei).to.equal(3n)
  })

  it('malformed and zero amounts are excluded under the right key', () => {
    const result = aggregatePatrons(
      [
        { from: null, beneficiary: ALICE, amount: '1' },
        { from: ALICE, beneficiary: null, amount: '1' },
        { from: 'not-an-address', beneficiary: ALICE, amount: '1' },
        { from: ALICE, beneficiary: ALICE, amount: '0' },
      ],
      'sepolia'
    )
    expect(result.excluded.malformed).to.equal(3)
    expect(result.excluded.zeroAmount).to.equal(1)
  })

  it('unconfigured chain still applies conditions 1–4', () => {
    const result = aggregatePatrons(
      [{ from: ALICE, beneficiary: ALICE, amount: '3', timestamp: 1 }],
      'arbitrum-sepolia'
    )
    expect(result.patronCount).to.equal(1)
  })

  it('suppressed payers leave patrons and move into otherRoutes', () => {
    const base = aggregatePatrons(
      [{ from: ALICE, beneficiary: ALICE, amount: '4', timestamp: 1 }],
      'sepolia'
    )
    const next = applyPatronSuppression(base, new Set([ALICE]))
    expect(next.patronCount).to.equal(0)
    expect(next.otherRoutes.count).to.equal(1)
    expect(next.otherRoutes.totalWei).to.equal(4n)
  })
})

describe('patrons request validation and pagination helpers', () => {
  it('rejects non-integer, negative, NaN, and Infinity ids before any upstream read', () => {
    for (const bad of [1.5, -1, NaN, Infinity, 'abc', 0]) {
      expect(validatePatronsRequest({ deprizeId: bad, chainId: 11155111 }).ok).to.equal(false)
      expect(validatePatronsRequest({ deprizeId: 22, chainId: bad }).ok).to.equal(false)
    }
    expect(validatePatronsRequest({ deprizeId: 22, chainId: 11155111 })).to.deep.equal({
      ok: true,
      deprizeId: 22,
      chainId: 11155111,
      projectId: 268,
    })
  })

  it('dedupes timestamp-tied pages by id and names MAX_PAGES', () => {
    const page = dedupeEventsById([
      { id: 'a', timestamp: 10 },
      { id: 'b', timestamp: 10 },
      { id: 'a', timestamp: 10 },
    ])
    expect(page.map((e) => e.id)).to.deep.equal(['a', 'b'])
    expect(PATRONS_MAX_PAGES).to.equal(20)
    const q = buildPatronPayEventsQuery({
      projectId: 268,
      chainId: 11155111,
      version: 5,
      timestampCursor: 10,
    })
    expect(q).to.include('from')
    expect(q).to.include('timestamp_lte: 10')
    expect(q).to.not.include('memo')
  })
})

describe('prepareJBPay param construction', () => {
  it('owns terminal, native token, param order, and metadata default', () => {
    const built = buildJBPayParams({
      projectId: 268,
      amountWei: 10n ** 15n,
      beneficiary: ALICE,
      minReturnedTokens: 0n,
      memo: 'DePrize #22: test',
    })
    expect(built.params.projectId).to.equal(268)
    expect(built.params.beneficiary).to.equal(ALICE)
    expect(built.params.metadata).to.equal('0x00')
    expect(built.value).to.equal(10n ** 15n)
    expect(built.terminalAddress.toLowerCase()).to.match(/^0x/)
    expect(built.params.token.toLowerCase()).to.match(/^0x/)
  })
})
