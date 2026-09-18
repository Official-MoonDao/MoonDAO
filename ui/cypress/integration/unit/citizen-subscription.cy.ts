import {
  getCachedCitizenExpiry,
  isSubscriptionExpired,
  setCachedCitizenExpiry,
} from '@/lib/citizen/citizenSubscription'

const HOUR = 60 * 60

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

// Minimal localStorage so the cache helpers can run outside a browser.
function stubLocalStorage() {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
  ;(globalThis as any).window = globalThis
  ;(globalThis as any).localStorage = storage
  return store
}

describe('citizen subscription expiration', () => {
  describe('isSubscriptionExpired', () => {
    it('treats a past expiration as expired', () => {
      expect(isSubscriptionExpired(nowSeconds() - HOUR)).to.equal(true)
    })

    it('treats a future expiration as active', () => {
      expect(isSubscriptionExpired(nowSeconds() + HOUR)).to.equal(false)
    })

    // An unreadable expiration must never lock a paid-up citizen out.
    it('fails open on an unknown expiration', () => {
      expect(isSubscriptionExpired(undefined)).to.equal(false)
      expect(isSubscriptionExpired(null)).to.equal(false)
      expect(isSubscriptionExpired(NaN)).to.equal(false)
    })
  })

  describe('expiration cache', () => {
    let store: Map<string, string>
    const originalWindow = (globalThis as any).window
    const originalLocalStorage = (globalThis as any).localStorage

    beforeEach(() => {
      store = stubLocalStorage()
    })

    // Leaving the stubs in place would make later specs in this Mocha process
    // think they're running in a browser.
    afterEach(() => {
      ;(globalThis as any).window = originalWindow
      ;(globalThis as any).localStorage = originalLocalStorage
    })

    it('round-trips an active expiration', () => {
      const expiresAt = nowSeconds() + HOUR
      setCachedCitizenExpiry('42', expiresAt)
      expect(getCachedCitizenExpiry('42')).to.equal(expiresAt)
    })

    // Caching an expired verdict would mask a renewal until the entry aged out.
    it('never caches an expiration that has already passed', () => {
      setCachedCitizenExpiry('42', nowSeconds() - HOUR)
      expect(store.size).to.equal(0)
      expect(getCachedCitizenExpiry('42')).to.equal(undefined)
    })

    it('drops a cached expiration once it lapses', () => {
      const expiresAt = nowSeconds() + 1
      setCachedCitizenExpiry('42', expiresAt)

      const key = Array.from(store.keys())[0]
      store.set(key, JSON.stringify({ data: nowSeconds() - 1, timestamp: Date.now() }))

      expect(getCachedCitizenExpiry('42')).to.equal(undefined)
      expect(store.size).to.equal(0)
    })

    it('returns undefined for an unknown token', () => {
      expect(getCachedCitizenExpiry('999')).to.equal(undefined)
      expect(getCachedCitizenExpiry('')).to.equal(undefined)
    })
  })
})
