import { CITIZENSHIP_GIFT_TAG, EB_TEAM_ID } from '../const/config'
import {
  GiftListingRow,
  priceToWei,
  validateGiftPurchase,
} from '../lib/marketplace/giftPurchase'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

function expectReject(
  result: ReturnType<typeof validateGiftPurchase>,
  expectedMessage: string,
  label: string
) {
  if (result.ok) {
    throw new Error(`${label}: expected rejection, got ok`)
  }
  expectEqual(result.status, 400, `${label} status`)
  expectEqual(result.message, expectedMessage, `${label} message`)
}

// es2016 ts-node target forbids the `n` literal syntax, so build bigints via
// the BigInt() constructor (the runtime is Node 18, which supports BigInt).
const pct = (value: bigint, percent: number) =>
  (value * BigInt(percent)) / BigInt(100)

// A canonical, valid gift listing on the EB team priced at exactly 1 ETH.
const ONE_ETH = BigInt('1000000000000000000')
const validListing: GiftListingRow = {
  id: 7,
  teamId: EB_TEAM_ID,
  tag: CITIZENSHIP_GIFT_TAG,
  currency: 'ETH',
  price: '1',
}

describe('priceToWei', () => {
  it('converts whole ETH to wei', () => {
    expectEqual(priceToWei('1'), ONE_ETH, 'one eth')
  })

  it('strips thousands separators', () => {
    expectEqual(priceToWei('1,000'), ONE_ETH * BigInt(1000), 'one thousand eth')
  })

  it('accepts numeric input', () => {
    expectEqual(priceToWei(2), ONE_ETH * BigInt(2), 'numeric two')
  })

  it('returns null for zero / negative / non-finite / empty', () => {
    expectEqual(priceToWei('0'), null, 'zero')
    expectEqual(priceToWei('-1'), null, 'negative')
    expectEqual(priceToWei('abc'), null, 'non-numeric')
    expectEqual(priceToWei(''), null, 'empty')
    expectEqual(priceToWei(undefined), null, 'undefined')
  })
})

describe('validateGiftPurchase', () => {
  it('accepts a correct gift purchase paying exactly the listing price', () => {
    const result = validateGiftPurchase({
      teamTokenId: EB_TEAM_ID,
      listingId: 7,
      listing: validListing,
      paidValueWei: ONE_ETH,
    })
    expectEqual(result.ok, true, 'ok')
    if (result.ok) {
      expectEqual(result.expectedWei, ONE_ETH, 'expectedWei')
    }
  })

  it('accepts payment at the lower / upper bounds of the tolerance band', () => {
    const minWei = pct(ONE_ETH, 99)
    const maxWei = pct(ONE_ETH, 101)
    expectEqual(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing: validListing,
        paidValueWei: minWei,
      }).ok,
      true,
      'lower bound'
    )
    expectEqual(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing: validListing,
        paidValueWei: maxWei,
      }).ok,
      true,
      'upper bound'
    )
  })

  it('rejects underpayment below the tolerance band', () => {
    const belowMin = pct(ONE_ETH, 99) - BigInt(1)
    expectReject(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing: validListing,
        paidValueWei: belowMin,
      }),
      'Payment does not match the listing price',
      'underpayment'
    )
  })

  // Bugbot High #1: paying for a different, pricier EB-team ETH listing must
  // NOT be redeemable as a (cheaper) gift. The upper bound enforces this.
  it('rejects overpayment from a pricier listing above the tolerance band', () => {
    const wayOver = ONE_ETH * BigInt(5) // paid for a 5 ETH listing, gift costs 1 ETH
    expectReject(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing: validListing,
        paidValueWei: wayOver,
      }),
      'Payment does not match the listing price',
      'overpayment'
    )
  })

  it('rejects purchases that did not land on the EB team', () => {
    expectReject(
      validateGiftPurchase({
        teamTokenId: '42',
        listingId: 7,
        listing: validListing,
        paidValueWei: ONE_ETH,
      }),
      'Gift purchases are only available on the EB team',
      'non-eb team'
    )
    expectReject(
      validateGiftPurchase({
        teamTokenId: undefined,
        listingId: 7,
        listing: validListing,
        paidValueWei: ONE_ETH,
      }),
      'Gift purchases are only available on the EB team',
      'undefined team'
    )
  })

  it('rejects malformed listing ids', () => {
    for (const badId of [-1, 1.5, NaN, 'abc', undefined, null]) {
      expectReject(
        validateGiftPurchase({
          teamTokenId: EB_TEAM_ID,
          listingId: badId,
          listing: validListing,
          paidValueWei: ONE_ETH,
        }),
        'Invalid listing',
        `bad id ${String(badId)}`
      )
    }
  })

  it('rejects a missing listing row', () => {
    expectReject(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing: undefined,
        paidValueWei: ONE_ETH,
      }),
      'Listing is not a gift citizenship listing',
      'missing listing'
    )
  })

  it('rejects a listing that is not tagged as a gift', () => {
    expectReject(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing: { ...validListing, tag: '' },
        paidValueWei: ONE_ETH,
      }),
      'Listing is not a gift citizenship listing',
      'untagged listing'
    )
  })

  it('rejects a row whose id does not match the claimed listing id', () => {
    expectReject(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing: { ...validListing, id: 9 },
        paidValueWei: ONE_ETH,
      }),
      'Invalid listing',
      'id mismatch'
    )
  })

  it('rejects non-ETH gift listings', () => {
    expectReject(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing: { ...validListing, currency: 'USDC' },
        paidValueWei: ONE_ETH,
      }),
      'Gift purchases must be paid in ETH',
      'non-eth currency'
    )
  })

  it('rejects listings with an invalid price', () => {
    for (const badPrice of ['0', '-1', 'abc', '']) {
      expectReject(
        validateGiftPurchase({
          teamTokenId: EB_TEAM_ID,
          listingId: 7,
          listing: { ...validListing, price: badPrice },
          paidValueWei: ONE_ETH,
        }),
        'Listing has an invalid price',
        `price ${badPrice}`
      )
    }
  })

  it('handles fractional (citizen-priced) listings with rounding tolerance', () => {
    const listing: GiftListingRow = { ...validListing, price: '0.0111' }
    const expectedWei = priceToWei('0.0111') as bigint
    // Exactly the (float-derived) expected value passes.
    expectEqual(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing,
        paidValueWei: expectedWei,
      }).ok,
      true,
      'fractional exact'
    )
    // A 2% underpayment is rejected.
    expectReject(
      validateGiftPurchase({
        teamTokenId: EB_TEAM_ID,
        listingId: 7,
        listing,
        paidValueWei: pct(expectedWei, 98),
      }),
      'Payment does not match the listing price',
      'fractional underpay'
    )
  })
})
