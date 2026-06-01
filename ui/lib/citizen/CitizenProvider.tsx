import { usePrivy } from '@privy-io/react-auth'
import { CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from 'const/config'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useTablelandQuery } from '../swr/useTablelandQuery'
import { citizenRowToNFT } from '../tableland/convertRow'
import { getChainSlug } from '../thirdweb/chain'
import CitizenContext from './citizen-context'

// Cache configuration
const CACHE_PREFIX = 'moondao_citizen_'
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
// How long to trust an optimistically-seeded citizen (just minted) before
// deferring to Tableland again. Indexing usually catches up within seconds.
const OPTIMISTIC_WINDOW_MS = 2 * 60 * 1000 // 2 minutes
const OPTIMISTIC_POLL_MS = 5000

interface CachedCitizenData {
  data: any
  timestamp: number
  address: string
  chainId: number
}

// BigInt serialization helpers
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'bigint') {
    return { __bigint: obj.toString() }
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }

  if (typeof obj === 'object') {
    const serialized: any = {}
    for (const key in obj) {
      serialized[key] = serializeBigInt(obj[key])
    }
    return serialized
  }

  return obj
}

const deserializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'object' && obj.__bigint) {
    return BigInt(obj.__bigint)
  }

  if (Array.isArray(obj)) {
    return obj.map(deserializeBigInt)
  }

  if (typeof obj === 'object') {
    const deserialized: any = {}
    for (const key in obj) {
      deserialized[key] = deserializeBigInt(obj[key])
    }
    return deserialized
  }

  return obj
}

// Cache utility functions
const getCacheKey = (address: string, chainId: number) =>
  `${CACHE_PREFIX}${address.toLowerCase()}_${chainId}`

const getCachedCitizen = (address: string, chainId: number): any => {
  if (typeof window === 'undefined') return null

  try {
    const cacheKey = getCacheKey(address, chainId)
    const cached = localStorage.getItem(cacheKey)

    if (!cached) {
      return null
    }

    const parsedCache: CachedCitizenData = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is expired
    if (now - parsedCache.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(cacheKey)
      return null
    }

    // Verify cache matches current context (use case-insensitive comparison)
    if (
      parsedCache.address.toLowerCase() !== address.toLowerCase() ||
      parsedCache.chainId !== chainId
    ) {
      localStorage.removeItem(cacheKey)
      return null
    }
    return deserializeBigInt(parsedCache.data)
  } catch (error) {
    console.warn('Failed to load cached citizen data:', error)
    return null
  }
}

const setCachedCitizen = (address: string, chainId: number, data: any) => {
  if (typeof window === 'undefined') return

  try {
    const cacheKey = getCacheKey(address, chainId)
    const cacheData: CachedCitizenData = {
      data: serializeBigInt(data), // Serialize BigInt values
      timestamp: Date.now(),
      address: address.toLowerCase(), // Store normalized address
      chainId,
    }

    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  } catch (error) {
    console.warn('Failed to cache citizen data:', error)
  }
}

const clearExpiredCache = () => {
  if (typeof window === 'undefined') return

  try {
    const now = Date.now()
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            const parsedCache: CachedCitizenData = JSON.parse(cached)
            if (now - parsedCache.timestamp > CACHE_EXPIRY_MS) {
              keysToRemove.push(key)
            }
          }
        } catch {
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear expired cache:', error)
  }
}

// Clear all citizen cache entries (used on logout)
export const clearAllCitizenCache = () => {
  if (typeof window === 'undefined') return

  try {
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear all citizen cache:', error)
  }
}

export default function CitizenProvider({ selectedChain, children, mock = false }: any) {
  const [citizen, setCitizen] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  // While true, a freshly-minted citizen is being trusted optimistically and we
  // poll Tableland until the real record shows up (see OPTIMISTIC_WINDOW_MS).
  const [optimisticActive, setOptimisticActive] = useState(false)
  const optimisticUntilRef = useRef(0)
  const account = useActiveAccount()
  const { authenticated, user } = usePrivy()
  const hasLoadedNonDefaultCache = useRef(false)

  const address = account?.address
  const chainId = selectedChain?.id
  const chainSlug = getChainSlug(selectedChain)
  const isDefaultChain = chainId === DEFAULT_CHAIN_V5.id

  // Reset cache loading flag when address or chain changes
  useEffect(() => {
    hasLoadedNonDefaultCache.current = false
    optimisticUntilRef.current = 0
    setOptimisticActive(false)
  }, [address, chainId])

  // Load cached data immediately when address/chain are available
  useEffect(() => {
    if (mock) {
      setCitizen(mock)
      return
    }

    // Only need address for cache loading
    if (!address) {
      return
    }

    // Clear expired cache on load
    clearExpiredCache()

    const cacheChainId = isDefaultChain ? chainId : DEFAULT_CHAIN_V5.id
    const cachedData = getCachedCitizen(address, cacheChainId)

    if (cachedData) {
      setCitizen(cachedData)
    } else {
      if (authenticated && user && isDefaultChain) {
        setIsLoading(true)
      } else if (authenticated && user && !isDefaultChain) {
        setIsLoading(false)
      }
    }
  }, [address, chainId, mock, isDefaultChain, authenticated, user])

  // Only query for citizens on DEFAULT_CHAIN
  const statement =
    mock || !authenticated || !user || !address || !chainId || !isDefaultChain
      ? null
      : `SELECT * FROM ${CITIZEN_TABLE_NAMES[chainSlug]} WHERE owner = '${address?.toLowerCase()}'`

  const { data: citizenData, isLoading: isLoadingQuery, mutate } = useTablelandQuery(
    statement,
    {
      revalidateOnFocus: false,
      // Poll while we're optimistically trusting a just-minted citizen so the
      // real Tableland row replaces the seed as soon as it's indexed.
      refreshInterval: optimisticActive ? OPTIMISTIC_POLL_MS : 0,
    }
  )

  // Optimistically mark the wallet as a citizen right after minting. Updates
  // state + cache immediately and kicks off a refetch; the empty-result branch
  // below won't clobber this until OPTIMISTIC_WINDOW_MS elapses.
  const seedCitizen = useCallback(
    (nft: any) => {
      if (!nft) return
      optimisticUntilRef.current = Date.now() + OPTIMISTIC_WINDOW_MS
      setOptimisticActive(true)
      setCitizen(nft)
      if (address) {
        setCachedCitizen(address, DEFAULT_CHAIN_V5.id, nft)
      }
      mutate()
    },
    [address, mutate]
  )

  // Update citizen state when data changes
  useEffect(() => {
    if (mock) return
    if (!authenticated || !user || !address || !chainId) {
      setIsLoading(false)
      hasLoadedNonDefaultCache.current = false
      return
    }

    if (!isDefaultChain) {
      // Only load from cache once per address/chain change
      if (!hasLoadedNonDefaultCache.current) {
        const defaultChainCache = getCachedCitizen(address, DEFAULT_CHAIN_V5.id)
        if (defaultChainCache) {
          setCitizen(defaultChainCache)
        }
        hasLoadedNonDefaultCache.current = true
      }
      setIsLoading(false)
      return
    }

    // Reset the flag when switching to default chain
    hasLoadedNonDefaultCache.current = false

    if (isLoadingQuery) {
      setIsLoading(true)
      return
    }

    setIsLoading(false)

    if (!citizenData || citizenData.length === 0) {
      // A freshly-minted citizen may not be indexed by Tableland yet — keep the
      // optimistic seed (and keep polling) until the window elapses.
      if (optimisticActive) {
        if (Date.now() < optimisticUntilRef.current) {
          return
        }
        setOptimisticActive(false)
        optimisticUntilRef.current = 0
      }
      setCitizen(undefined)
      setCachedCitizen(address || '', chainId, undefined)
      return
    }

    const nft = citizenRowToNFT(citizenData?.[0])
    setCitizen(nft)
    setCachedCitizen(address || '', chainId, nft)
    if (optimisticActive) {
      setOptimisticActive(false)
      optimisticUntilRef.current = 0
    }
  }, [
    citizenData,
    isLoadingQuery,
    authenticated,
    user,
    address,
    chainId,
    chainSlug,
    mock,
    isDefaultChain,
    optimisticActive,
  ])

  useEffect(() => {
    if (mock) return

    if (!authenticated) {
      setCitizen(undefined)
      setIsLoading(false)
      hasLoadedNonDefaultCache.current = false
    }
  }, [authenticated, mock])

  return (
    <CitizenContext.Provider value={{ citizen, setCitizen, seedCitizen, isLoading }}>
      {children}
    </CitizenContext.Provider>
  )
}
