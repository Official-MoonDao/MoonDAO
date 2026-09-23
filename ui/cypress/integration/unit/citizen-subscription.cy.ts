import {
  getCachedCitizenExpiry,
  isSubscriptionExpired,
  setCachedCitizenExpiry,
} from '@/lib/citizen/citizenSubscription'

const HOUR = 60 * 60
const EXPIRY_KEY_PREFIX = 'moondao_citizen_expiry_'

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

// The cache helpers no-op unless they can see a browser, so the Mocha (Node)
// pass needs a stand-in. Cypress already runs in a real browser, where
// `localStorage` is a getter-only property of Window — assigning to it from a
// module throws, so the stub is installed only when it is actually missing.
function installStorageStub() {
  const store = new Map<string, string>()
  const storage = {
    get length() {
      return store.size
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
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
}

// Leaving the stubs in place would make later specs in this Mocha process think
// they're running in a browser.
function removeStorageStub() {
  delete (globalThis as any).localStorage
  delete (globalThis as any).window
}

function expiryKeys() {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(EXPIRY_KEY_PREFIX)) keys.push(key)
  }
  return keys
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
    let storageStubbed = false

    before(() => {
      storageStubbed = typeof localStorage === 'undefined'
      if (storageStubbed) installStorageStub()
    })

    after(() => {
      if (storageStubbed) removeStorageStub()
    })

    // Only our own entries are touched — in the browser this is the shared
    // localStorage of the spec frame.
    beforeEach(() => {
      expiryKeys().forEach((key) => localStorage.removeItem(key))
    })

    it('round-trips an active expiration', () => {
      const expiresAt = nowSeconds() + HOUR
      setCachedCitizenExpiry('42', expiresAt)
      expect(getCachedCitizenExpiry('42')).to.equal(expiresAt)
    })

    // Caching an expired verdict would mask a renewal until the entry aged out.
    it('never caches an expiration that has already passed', () => {
      setCachedCitizenExpiry('42', nowSeconds() - HOUR)
      expect(expiryKeys()).to.have.length(0)
      expect(getCachedCitizenExpiry('42')).to.equal(undefined)
    })

    it('drops a cached expiration once it lapses', () => {
      setCachedCitizenExpiry('42', nowSeconds() + 1)

      const key = expiryKeys()[0]
      localStorage.setItem(
        key,
        JSON.stringify({ data: nowSeconds() - 1, timestamp: Date.now() })
      )

      expect(getCachedCitizenExpiry('42')).to.equal(undefined)
      expect(expiryKeys()).to.have.length(0)
    })

    it('returns undefined for an unknown token', () => {
      expect(getCachedCitizenExpiry('999')).to.equal(undefined)
      expect(getCachedCitizenExpiry('')).to.equal(undefined)
    })

    it('does not apply an expiration cached for one chain to another', () => {
      const expiresAt = nowSeconds() + HOUR
      setCachedCitizenExpiry('42', expiresAt, 42161)
      expect(getCachedCitizenExpiry('42', 42161)).to.equal(expiresAt)
      expect(getCachedCitizenExpiry('42', 11155111)).to.equal(undefined)
    })
  })
})
