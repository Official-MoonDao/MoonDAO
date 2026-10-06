/**
 * CitizenCheckout liveness must not stick on a miss. The pricing batch
 * deploys the checkout and closes direct mintTo in one transaction.
 */
import { expect } from 'chai'
import { rememberCheckoutLiveness } from '../../../lib/subscription/checkoutLivenessCache'

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('rememberCheckoutLiveness', () => {
  it('drops a miss so the next read is not the cached failure', async () => {
    const cache = new Map<string, Promise<boolean>>()
    const pending = Promise.resolve(false)
    rememberCheckoutLiveness(cache, 'arbitrum', pending)
    expect(cache.get('arbitrum')).to.equal(pending)
    await pending
    await flush()
    expect(cache.has('arbitrum')).to.equal(false)
  })

  it('keeps a hit', async () => {
    const cache = new Map<string, Promise<boolean>>()
    const pending = Promise.resolve(true)
    rememberCheckoutLiveness(cache, 'arbitrum', pending)
    await pending
    await flush()
    expect(cache.get('arbitrum')).to.equal(pending)
    expect(await cache.get('arbitrum')).to.equal(true)
  })

  it('shares one in-flight read', () => {
    const cache = new Map<string, Promise<boolean>>()
    let resolveRead: (live: boolean) => void = () => {}
    const pending = new Promise<boolean>((resolve) => {
      resolveRead = resolve
    })
    const first = rememberCheckoutLiveness(cache, 'arbitrum', pending)
    const second = cache.get('arbitrum')
    expect(second).to.equal(first)
    resolveRead(true)
  })

  it('drops a rejected read', async () => {
    const cache = new Map<string, Promise<boolean>>()
    const pending = Promise.reject(new Error('rpc'))
    rememberCheckoutLiveness(cache, 'arbitrum', pending)
    await pending.catch(() => undefined)
    await flush()
    expect(cache.has('arbitrum')).to.equal(false)
  })

  it('does not let a stale miss erase a later hit', async () => {
    const cache = new Map<string, Promise<boolean>>()
    let resolveFirst: (live: boolean) => void = () => {}
    const first = new Promise<boolean>((resolve) => {
      resolveFirst = resolve
    })
    rememberCheckoutLiveness(cache, 'arbitrum', first)
    const second = Promise.resolve(true)
    rememberCheckoutLiveness(cache, 'arbitrum', second)
    resolveFirst(false)
    await first
    await second
    await flush()
    expect(cache.get('arbitrum')).to.equal(second)
    expect(await cache.get('arbitrum')).to.equal(true)
  })
})
