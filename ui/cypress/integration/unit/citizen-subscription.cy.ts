import { DEFAULT_CHAIN_V5 } from 'const/config'
import {
  citizenshipRenewalLabel,
  clearCachedCitizenExpiry,
  daysUntilCitizenshipExpiry,
  getCachedCitizenExpiry,
  isCitizenshipRenewalUrgent,
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

    // fetchCitizenExpiresAt always writes the chain-scoped key. Callers that
    // omit chainId (CitizenProvider's sync read) still need that default-chain
    // entry, and must not pick up some other chain's token.
    it('resolves a default-chain expiration when no chain is passed', () => {
      const expiresAt = nowSeconds() + HOUR
      setCachedCitizenExpiry('42', expiresAt, DEFAULT_CHAIN_V5.id)
      expect(getCachedCitizenExpiry('42')).to.equal(expiresAt)
    })

    it('does not treat another chain as the unscoped expiration', () => {
      const expiresAt = nowSeconds() + HOUR
      const otherChainId = DEFAULT_CHAIN_V5.id === 42161 ? 11155111 : 42161
      setCachedCitizenExpiry('42', expiresAt, otherChainId)
      expect(getCachedCitizenExpiry('42')).to.equal(undefined)
    })

    // An early renewal extends a date that is still in the future. Leaving the
    // old timestamp cached would hide the new expiration until the old one lapsed.
    it('clears a still-valid expiration after renewal', () => {
      const expiresAt = nowSeconds() + HOUR
      setCachedCitizenExpiry('42', expiresAt, DEFAULT_CHAIN_V5.id)
      setCachedCitizenExpiry('7', expiresAt, DEFAULT_CHAIN_V5.id)
      clearCachedCitizenExpiry('42', DEFAULT_CHAIN_V5.id)
      expect(getCachedCitizenExpiry('42')).to.equal(undefined)
      expect(getCachedCitizenExpiry('42', DEFAULT_CHAIN_V5.id)).to.equal(undefined)
      expect(getCachedCitizenExpiry('7', DEFAULT_CHAIN_V5.id)).to.equal(expiresAt)
    })
  })

  describe('renewal alert window', () => {
    const now = 1_700_000_000_000
    const day = 24 * 60 * 60

    it('treats 30 days or fewer as urgent and 31 as not', () => {
      const in30 = now / 1000 + 30 * day
      const justOver30 = now / 1000 + 30 * day + 1
      expect(daysUntilCitizenshipExpiry(in30, now)).to.equal(30)
      expect(isCitizenshipRenewalUrgent(in30, now)).to.equal(true)
      expect(daysUntilCitizenshipExpiry(justOver30, now)).to.equal(31)
      expect(isCitizenshipRenewalUrgent(justOver30, now)).to.equal(false)
    })

    it('counts a partial last day as one day left', () => {
      const inTwelveHours = now / 1000 + 12 * 60 * 60
      expect(daysUntilCitizenshipExpiry(inTwelveHours, now)).to.equal(1)
      expect(isCitizenshipRenewalUrgent(inTwelveHours, now)).to.equal(true)
    })

    it('fails open when the expiration is unknown', () => {
      expect(daysUntilCitizenshipExpiry(undefined, now)).to.equal(null)
      expect(daysUntilCitizenshipExpiry(null, now)).to.equal(null)
      expect(isCitizenshipRenewalUrgent(undefined, now)).to.equal(false)
    })

    it('includes the date, and days left only inside the alert window', () => {
      const expiresAt = Date.UTC(2026, 9, 3, 16, 0, 0) / 1000
      const date = new Date(expiresAt * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const tenDaysBefore = expiresAt * 1000 - 10 * day * 1000
      const fortyDaysBefore = expiresAt * 1000 - 40 * day * 1000
      expect(citizenshipRenewalLabel(expiresAt, tenDaysBefore)).to.equal(`10 days left · ${date}`)
      expect(citizenshipRenewalLabel(expiresAt, fortyDaysBefore)).to.equal(`Expires ${date}`)
    })
  })
})
