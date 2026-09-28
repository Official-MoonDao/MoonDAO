import { expect } from 'chai'
import {
  nextDeprizeChainPin,
  type DeprizeChainPin,
} from '@/lib/deprize/deprizeChainPin'
import { chainForDeprizePath } from '@/lib/deprize/route-chain'

const ARBITRUM = 42161
const SEPOLIA = 11155111
const ETHEREUM = 1

describe('chainForDeprizePath', () => {
  it('opens /deprize/sep pages on Sepolia', () => {
    expect(chainForDeprizePath('/deprize/sep')?.id).to.equal(11155111)
    expect(chainForDeprizePath('/deprize/sep/[id]')?.id).to.equal(11155111)
    expect(chainForDeprizePath('/deprize/sep/2')?.id).to.equal(11155111)
  })

  it('opens /deprize/arb pages on Arbitrum', () => {
    expect(chainForDeprizePath('/deprize/arb/[id]')?.id).to.equal(42161)
  })

  it('leaves unprefixed DePrize routes on the app default', () => {
    expect(chainForDeprizePath('/deprize')).to.equal(undefined)
    expect(chainForDeprizePath('/deprize/[id]')).to.equal(undefined)
    expect(chainForDeprizePath('/deprize/2')).to.equal(undefined)
  })
})

describe('nextDeprizeChainPin', () => {
  const onArbitrum: DeprizeChainPin = {
    selectedChainId: ARBITRUM,
    pinnedPath: '/',
    restoreChainId: null,
  }

  it('pins Sepolia on /deprize/sep and restores Arbitrum after leaving', () => {
    const pinned = nextDeprizeChainPin(onArbitrum, '/deprize/sep', ARBITRUM)
    expect(pinned).to.deep.equal({
      selectedChainId: SEPOLIA,
      pinnedPath: '/deprize/sep',
      restoreChainId: ARBITRUM,
    })

    const detail = nextDeprizeChainPin(pinned, '/deprize/sep/[id]', ARBITRUM)
    expect(detail.selectedChainId).to.equal(SEPOLIA)
    expect(detail.restoreChainId).to.equal(ARBITRUM)

    const left = nextDeprizeChainPin(detail, '/citizen', ARBITRUM)
    expect(left).to.deep.equal({
      selectedChainId: ARBITRUM,
      pinnedPath: '/citizen',
      restoreChainId: null,
    })
    expect(nextDeprizeChainPin(left, '/dashboard', ARBITRUM)).to.equal(left)
  })

  it('keeps a network the user picked while the prize URL was open', () => {
    const pinned = nextDeprizeChainPin(onArbitrum, '/deprize/sep', ARBITRUM)
    const overridden: DeprizeChainPin = { ...pinned, selectedChainId: ETHEREUM }
    const left = nextDeprizeChainPin(overridden, '/mission', ARBITRUM)
    expect(left.selectedChainId).to.equal(ETHEREUM)
    expect(left.restoreChainId).to.equal(null)
  })

  it('restores the pre-pin chain after moving from Sepolia to Arbitrum prize URLs', () => {
    const onEthereum: DeprizeChainPin = {
      selectedChainId: ETHEREUM,
      pinnedPath: '/swap',
      restoreChainId: null,
    }
    const sep = nextDeprizeChainPin(onEthereum, '/deprize/sep', ARBITRUM)
    const arb = nextDeprizeChainPin(sep, '/deprize/arb', ARBITRUM)
    expect(arb.selectedChainId).to.equal(ARBITRUM)
    expect(arb.restoreChainId).to.equal(ETHEREUM)
    const left = nextDeprizeChainPin(arb, '/', ARBITRUM)
    expect(left.selectedChainId).to.equal(ETHEREUM)
    expect(left.restoreChainId).to.equal(null)
  })

  it('falls back to the app default when a cold load on /deprize/sep has nothing to restore', () => {
    const cold: DeprizeChainPin = {
      selectedChainId: SEPOLIA,
      pinnedPath: '/deprize/sep',
      restoreChainId: null,
    }
    const left = nextDeprizeChainPin(cold, '/', ARBITRUM)
    expect(left.selectedChainId).to.equal(ARBITRUM)
    expect(left.restoreChainId).to.equal(null)
  })
})
