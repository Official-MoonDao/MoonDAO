interface IncrementalCacheEntry<T> {
  data: T[]
  lastFetchTimestamp: number
  lastBlockNumber?: number
  lastTransactionHash?: string
  metadata: {
    totalItems: number
    firstTimestamp: number
    lastTimestamp: number
  }
}

interface CacheConfig {
  maxAge: number
}

const minutes = 60 * 1000
const hours = 60 * minutes
const days = 24 * hours

const CACHE_CONFIG: Record<string, CacheConfig> = {
  internalTransactions: { maxAge: 6 * hours },
  validatorIndices: { maxAge: 7 * days }, // rarely changes
  validatorPerformance: { maxAge: 1 * hours },
  uniswapPoolData: { maxAge: 1 * hours },
}

interface SimpleCacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const simpleCache = new Map<string, SimpleCacheEntry<any>>()

const SIMPLE_CACHE_TTL = {
  ethPrice: 1 * minutes,
}

// In-memory incremental cache
const incrementalCache = new Map<string, IncrementalCacheEntry<any>>()

export const getIncrementalCacheKey = {
  internalTransactions: (chain: string, fromAddr: string, toAddr: string) =>
    `incremental_txs_${chain}_${fromAddr}_${toAddr}`,
  validatorIndices: (pubKeysHash: string) =>
    `incremental_validators_${pubKeysHash}`,
  validatorPerformance: (indicesHash: string) =>
    `incremental_performance_${indicesHash}`,
  uniswapPoolData: (poolsHash: string, days: number) =>
    `incremental_pools_${poolsHash}_${days}d`,
}

export const getSimpleCacheKey = {
  ethPrice: () => 'current_eth_price',
}

export function hashObject(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64').slice(0, 16)
}

export function getIncrementalCache<T>(
  cacheKey: string,
  cacheType: keyof typeof CACHE_CONFIG
): {
  data: T[]
  shouldRefresh: boolean
  lastFetchTimestamp: number
  lastBlockNumber?: number
  lastTransactionHash?: string
} | null {
  try {
    const cached = incrementalCache.get(cacheKey)
    if (!cached) {
      return null
    }

    const config = CACHE_CONFIG[cacheType]
    const shouldRefresh = Date.now() - cached.lastFetchTimestamp > config.maxAge

    console.log(
      `Incremental cache: ${cacheKey} - ${cached.data.length} items, ` +
        `last fetch: ${Math.round(
          (Date.now() - cached.lastFetchTimestamp) / 1000 / 60
        )}min ago, ` +
        `should refresh: ${shouldRefresh}`
    )

    return {
      data: cached.data,
      shouldRefresh,
      lastFetchTimestamp: cached.lastFetchTimestamp,
      lastBlockNumber: cached.lastBlockNumber,
      lastTransactionHash: cached.lastTransactionHash,
    }
  } catch (error) {
    console.warn(`Incremental cache read error for ${cacheKey}:`, error)
    return null
  }
}

export function updateIncrementalCache<T>(
  cacheKey: string,
  newData: T[],
  options: {
    replace?: boolean // If true, replace all data. If false, append new data
    lastBlockNumber?: number
    lastTransactionHash?: string
    getTimestamp?: (item: T) => number
  } = {}
): void {
  try {
    const {
      replace = false,
      lastBlockNumber,
      lastTransactionHash,
      getTimestamp,
    } = options

    const existing = incrementalCache.get(cacheKey)
    let finalData: T[]
    let metadata: IncrementalCacheEntry<T>['metadata']

    if (replace || !existing) {
      finalData = newData

      if (getTimestamp && newData.length > 0) {
        const timestamps = newData.map(getTimestamp).filter(Boolean)
        metadata = {
          totalItems: newData.length,
          firstTimestamp: Math.min(...timestamps),
          lastTimestamp: Math.max(...timestamps),
        }
      } else {
        metadata = {
          totalItems: newData.length,
          firstTimestamp: Date.now(),
          lastTimestamp: Date.now(),
        }
      }

      console.log(
        `💾 Incremental cache: ${cacheKey} - stored ${newData.length} items (${
          replace ? 'replaced' : 'initial'
        })`
      )
    } else {
      // Append new data to existing
      const existingData = existing.data

      const newItems = newData.filter((newItem) => {
        return !existingData.some(
          (existingItem) =>
            JSON.stringify(existingItem) === JSON.stringify(newItem)
        )
      })

      finalData = [...existingData, ...newItems]

      if (getTimestamp && finalData.length > 0) {
        const timestamps = finalData.map(getTimestamp).filter(Boolean)
        metadata = {
          totalItems: finalData.length,
          firstTimestamp: Math.min(...timestamps),
          lastTimestamp: Math.max(...timestamps),
        }
      } else {
        metadata = existing.metadata
        metadata.totalItems = finalData.length
      }

      console.log(
        `Incremental cache: ${cacheKey} - appended ${newItems.length} new items (total: ${finalData.length})`
      )
    }

    const entry: IncrementalCacheEntry<T> = {
      data: finalData,
      lastFetchTimestamp: Date.now(),
      lastBlockNumber,
      lastTransactionHash,
      metadata,
    }

    incrementalCache.set(cacheKey, entry)
  } catch (error) {
    console.warn(`Incremental cache write error for ${cacheKey}:`, error)
  }
}

// Clear expired entries
// Track last cleanup time to avoid excessive cleanup calls
let lastCleanupTime = 0
const CLEANUP_INTERVAL = 1 * hours // 1 hour

export function clearExpiredIncrementalCache(force = false): void {
  const now = Date.now()

  // Only cleanup if it's been more than an hour since last cleanup (or forced)
  if (!force && now - lastCleanupTime < CLEANUP_INTERVAL) {
    return
  }

  lastCleanupTime = now
  let cleared = 0

  for (const [key, entry] of incrementalCache.entries()) {
    const maxAgeForKey = Math.max(
      ...Object.values(CACHE_CONFIG).map((c) => c.maxAge)
    )
    if (now - entry.lastFetchTimestamp > maxAgeForKey * 7) {
      incrementalCache.delete(key)
      cleared++
    }
  }

  if (cleared > 0) {
    console.log(`Cleared ${cleared} very old incremental cache entries`)
  }
}

export function getIncrementalCacheStats(): {
  entries: number
  totalItems: number
  memorySize: number
  entriesDetail: Array<{
    key: string
    itemCount: number
    age: number
    sizeKB: number
    firstTimestamp?: string
    lastTimestamp?: string
  }>
} {
  const now = Date.now()
  let totalItems = 0

  const entriesDetail = [...incrementalCache.entries()].map(([key, entry]) => {
    totalItems += entry.metadata.totalItems
    const sizeKB = Math.round(JSON.stringify(entry.data).length / 1024)

    return {
      key,
      itemCount: entry.metadata.totalItems,
      age: Math.round((now - entry.lastFetchTimestamp) / 1000 / 60), // minutes
      sizeKB,
      firstTimestamp: entry.metadata.firstTimestamp
        ? new Date(entry.metadata.firstTimestamp).toISOString().split('T')[0]
        : undefined,
      lastTimestamp: entry.metadata.lastTimestamp
        ? new Date(entry.metadata.lastTimestamp).toISOString().split('T')[0]
        : undefined,
    }
  })

  return {
    entries: incrementalCache.size,
    totalItems,
    memorySize: JSON.stringify([...incrementalCache.entries()]).length,
    entriesDetail,
  }
}

export async function withIncrementalCache<T>(
  cacheKey: string,
  cacheType: keyof typeof CACHE_CONFIG,
  fetchAllFn: () => Promise<T[]>,
  fetchNewFn?: (since: {
    blockNumber?: number
    timestamp?: number
    transactionHash?: string
  }) => Promise<T[]>,
  options: {
    getTimestamp?: (item: T) => number
    getBlockNumber?: (item: T) => number
    getTransactionHash?: (item: T) => string
    forceRefresh?: boolean
    logPrefix?: string
  } = {}
): Promise<T[]> {
  const {
    getTimestamp,
    getBlockNumber,
    getTransactionHash,
    forceRefresh = false,
    logPrefix = '',
  } = options

  clearExpiredIncrementalCache()

  if (!forceRefresh) {
    const cached = getIncrementalCache<T>(cacheKey, cacheType)

    if (cached && !cached.shouldRefresh) {
      console.log(`${logPrefix}Using cached data: ${cached.data.length} items`)
      return cached.data
    }

    if (cached && cached.shouldRefresh && fetchNewFn) {
      console.log(`${logPrefix}Fetching incremental data since last update...`)

      try {
        const sinceParams: any = {}
        if (cached.lastBlockNumber)
          sinceParams.blockNumber = cached.lastBlockNumber
        if (cached.lastFetchTimestamp)
          sinceParams.timestamp = cached.lastFetchTimestamp
        if (cached.lastTransactionHash)
          sinceParams.transactionHash = cached.lastTransactionHash

        const newData = await fetchNewFn(sinceParams)

        if (newData.length > 0) {
          // Update cache with new data
          const lastItem = newData[newData.length - 1]
          updateIncrementalCache(cacheKey, newData, {
            replace: false,
            lastBlockNumber: getBlockNumber
              ? getBlockNumber(lastItem)
              : undefined,
            lastTransactionHash: getTransactionHash
              ? getTransactionHash(lastItem)
              : undefined,
            getTimestamp,
          })

          return [...cached.data, ...newData]
        } else {
          console.log(`✅ ${logPrefix}No new data since last update`)
          updateIncrementalCache(cacheKey, cached.data, {
            replace: true,
            lastBlockNumber: cached.lastBlockNumber,
            lastTransactionHash: cached.lastTransactionHash,
            getTimestamp,
          })
          return cached.data
        }
      } catch (error) {
        console.warn(
          `${logPrefix}Incremental fetch failed, falling back to full fetch:`,
          error
        )
      }
    }
  }

  console.log(`${logPrefix}Fetching all data...`)
  const allData = await fetchAllFn()

  // Store in cache
  const lastItem = allData.length > 0 ? allData[allData.length - 1] : null
  updateIncrementalCache(cacheKey, allData, {
    replace: true,
    lastBlockNumber:
      lastItem && getBlockNumber ? getBlockNumber(lastItem) : undefined,
    lastTransactionHash:
      lastItem && getTransactionHash ? getTransactionHash(lastItem) : undefined,
    getTimestamp,
  })

  return allData
}

export function getSimpleCache<T>(
  cacheKey: string,
  cacheType: keyof typeof SIMPLE_CACHE_TTL
): T | null {
  try {
    const cached = simpleCache.get(cacheKey)
    if (!cached) {
      return null
    }

    const ttl = SIMPLE_CACHE_TTL[cacheType]
    if (Date.now() - cached.timestamp > ttl) {
      simpleCache.delete(cacheKey)
      return null
    }

    console.log(`🎯 Simple cache hit: ${cacheKey}`)
    return cached.data
  } catch (error) {
    console.warn(`Simple cache read error for ${cacheKey}:`, error)
    return null
  }
}

export function setSimpleCache<T>(
  cacheKey: string,
  data: T,
  cacheType: keyof typeof SIMPLE_CACHE_TTL
): void {
  try {
    const ttl = SIMPLE_CACHE_TTL[cacheType]
    const entry: SimpleCacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }

    simpleCache.set(cacheKey, entry)
    console.log(
      `Simple cache: ${cacheKey} (TTL: ${Math.round(ttl / 1000 / 60)}min)`
    )
  } catch (error) {
    console.warn(`Simple cache write error for ${cacheKey}:`, error)
  }
}

export async function withSimpleCache<T>(
  cacheKey: string,
  cacheType: keyof typeof SIMPLE_CACHE_TTL,
  fetchFn: () => Promise<T>,
  options: {
    forceRefresh?: boolean
    logPrefix?: string
  } = {}
): Promise<T> {
  const { forceRefresh = false, logPrefix = '' } = options

  if (!forceRefresh) {
    const cached = getSimpleCache<T>(cacheKey, cacheType)
    if (cached !== null) {
      return cached
    }
  }

  console.log(`${logPrefix}Fetching fresh data for: ${cacheKey}`)
  const data = await fetchFn()

  setSimpleCache(cacheKey, data, cacheType)
  return data
}
