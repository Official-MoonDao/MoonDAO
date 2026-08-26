import { CITIZENSHIP_GIFT_TAG } from 'const/config'
import {
  formatListingPrice,
  getListingAvailability,
  getListingHref,
  isGiftListing,
  requiresShipping,
} from '@/lib/marketplace/listing'
import { buildListingJsonLd } from '@/lib/marketplace/listingJsonLd'

const DAY = 86400
const NOW = 1_800_000_000

function listing(overrides: Record<string, any> = {}): any {
  return {
    id: 7,
    teamId: 3,
    teamName: 'LifeShip',
    title: 'Lunar Payload Slot',
    description: 'A slot on the next lander.',
    image: 'ipfs://QmTestImage',
    price: '1000',
    currency: 'USDC',
    startTime: 0,
    endTime: 0,
    timestamp: NOW,
    metadata: '',
    shipping: 'false',
    tag: '',
    ...overrides,
  }
}

describe('getListingHref', () => {
  it('points at the dedicated listing page', () => {
    expect(getListingHref(listing())).to.equal('/marketplace/7')
  })
})

describe('getListingAvailability', () => {
  it('is live and unbounded when both times are zero', () => {
    const availability = getListingAvailability(listing(), NOW)
    expect(availability.status).to.equal('live')
    expect(availability.label).to.equal('Available now')
    expect(availability.isPurchasable).to.equal(true)
  })

  it('is upcoming before the start time', () => {
    const availability = getListingAvailability(
      listing({ startTime: NOW + 5 * DAY, endTime: NOW + 10 * DAY }),
      NOW,
    )
    expect(availability.status).to.equal('upcoming')
    expect(availability.isPurchasable).to.equal(false)
  })

  it('is ended after the end time', () => {
    const availability = getListingAvailability(listing({ endTime: NOW - DAY }), NOW)
    expect(availability.status).to.equal('ended')
    expect(availability.label).to.equal('No longer available')
    expect(availability.isPurchasable).to.equal(false)
  })

  it('counts down a timed window that is still open', () => {
    expect(getListingAvailability(listing({ endTime: NOW + 3 * DAY }), NOW).label).to.equal(
      'Ends in 3 days',
    )
    expect(getListingAvailability(listing({ endTime: NOW + DAY }), NOW).label).to.equal(
      'Ends in 1 day',
    )
    expect(getListingAvailability(listing({ endTime: NOW + 60 }), NOW).label).to.equal(
      'Ends in 1 day',
    )
  })
})

describe('formatListingPrice', () => {
  it('marks up non-citizens by 10%', () => {
    const price = formatListingPrice(listing({ price: '100', currency: 'USDC' }), false)
    expect(price.display).to.equal('110 USDC')
    expect(price.full).to.equal('110 USDC')
    expect(price.savings).to.equal('10 USDC')
  })

  it('gives citizens the flat price with the markup struck through', () => {
    const price = formatListingPrice(listing({ price: '100', currency: 'USDC' }), true)
    expect(price.display).to.equal('100 USDC')
    expect(price.full).to.equal('110 USDC')
  })

  it('tolerates thousands separators', () => {
    expect(
      formatListingPrice(listing({ price: '1,000', currency: 'USDC' }), true).display,
    ).to.equal('1,000 USDC')
  })

  it('never marks up a gifted citizenship', () => {
    const price = formatListingPrice(
      listing({ price: '100', currency: 'ETH', tag: CITIZENSHIP_GIFT_TAG }),
      false,
    )
    expect(price.display).to.equal('100 ETH')
    expect(price.savings).to.equal('')
  })

  it('reports a zero or unparseable price as free', () => {
    expect(formatListingPrice(listing({ price: '0' }), false).isFree).to.equal(true)
    expect(formatListingPrice(listing({ price: '' }), false).isFree).to.equal(true)
  })
})

describe('listing flags', () => {
  it('detects gift listings and shipping', () => {
    expect(isGiftListing(listing({ tag: CITIZENSHIP_GIFT_TAG }))).to.equal(true)
    expect(isGiftListing(listing())).to.equal(false)
    expect(requiresShipping(listing({ shipping: 'true' }))).to.equal(true)
    expect(requiresShipping(listing())).to.equal(false)
  })
})

describe('buildListingJsonLd', () => {
  it('emits a Product with an in-stock offer', () => {
    const jsonLd = buildListingJsonLd({ listing: listing(), teamName: 'LifeShip', now: NOW })
    expect(jsonLd['@type']).to.equal('Product')
    expect(jsonLd.name).to.equal('Lunar Payload Slot')
    expect(jsonLd.sku).to.equal('7')
    expect(jsonLd.offers.availability).to.equal('https://schema.org/InStock')
    expect(jsonLd.offers.seller.name).to.equal('LifeShip')
  })

  it('maps dollar-pegged currencies to an ISO code', () => {
    const jsonLd = buildListingJsonLd({ listing: listing({ currency: 'USDC' }), now: NOW })
    expect(jsonLd.offers.priceCurrency).to.equal('USD')
    expect(jsonLd.offers.price).to.equal(1000)
  })

  it('omits price for currencies with no ISO code rather than emitting an invalid one', () => {
    const jsonLd = buildListingJsonLd({ listing: listing({ currency: 'ETH' }), now: NOW })
    expect(jsonLd.offers.priceCurrency).to.equal(undefined)
    expect(jsonLd.offers.price).to.equal(undefined)
  })

  it('reflects sold-out and pre-order states', () => {
    expect(
      buildListingJsonLd({ listing: listing({ endTime: NOW - DAY }), now: NOW }).offers
        .availability,
    ).to.equal('https://schema.org/SoldOut')
    expect(
      buildListingJsonLd({ listing: listing({ startTime: NOW + DAY }), now: NOW }).offers
        .availability,
    ).to.equal('https://schema.org/PreOrder')
  })
})
