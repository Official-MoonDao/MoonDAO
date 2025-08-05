import { usePrivy } from '@privy-io/react-auth'
import { CITIZEN_TABLE_NAMES } from 'const/config'
import { useEffect, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { citizenRowToNFT } from '../tableland/convertRow'
import { getChainSlug } from '../thirdweb/chain'
import CitizenContext from './citizen-context'

// Cache configuration
const CACHE_PREFIX = 'moondao_citizen_'
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

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

    console.log('Cache hit! Loading data:', parsedCache.data)
    // Deserialize BigInt values
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
    console.log('Cached citizen data with key:', cacheKey, 'data:', data)
    console.log('localStorage now contains:', localStorage.getItem(cacheKey))
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

export default function CitizenProvider({
  selectedChain,
  children,
  mock = false,
}: any) {
  const [citizen, setCitizen] = useState<any>()
  const account = useActiveAccount()
  const { authenticated, user } = usePrivy()

  const address = account?.address
  const chainId = selectedChain?.id
  const chainSlug = getChainSlug(selectedChain)

  // Load cached data immediately when address/chain are available
  useEffect(() => {
    if (mock) {
      setCitizen(mock)
      return
    }

    // Only need address and chainId for cache loading
    if (!address || !chainId) {
      return
    }

    // Clear expired cache on load
    clearExpiredCache()

    // Try to load from cache immediately
    console.log(
      'Loading cached citizen data for:',
      address,
      'on chain:',
      chainId
    )
    const cachedData = getCachedCitizen(address, chainId)
    if (cachedData) {
      console.log('Found cached data, setting citizen state:', cachedData)
      setCitizen(cachedData)
    } else {
      console.log('No cached data found')
    }
  }, [address, chainId, mock])

  // Always fetch fresh data when authenticated and address/chain are available
  useEffect(() => {
    if (mock) return
    if (!authenticated || !user || !address || !chainId) return

    async function fetchCitizenData() {
      console.log(
        'Fetching fresh citizen data for:',
        address,
        'on chain:',
        chainId
      )
      try {
        const statement = `SELECT * FROM ${
          CITIZEN_TABLE_NAMES[chainSlug]
        } WHERE owner = '${address?.toLocaleLowerCase()}'`
        const citizenRes = await fetch(
          `/api/tableland/query?statement=${statement}`
        )
        const citizen = await citizenRes.json()

        if (!citizen || citizen.length === 0) {
          setCitizen(undefined)
          setCachedCitizen(address || '', chainId, undefined)
          return
        }

        const nft = citizenRowToNFT(citizen?.[0])

        console.log('Fresh citizen data fetched:', nft)
        setCitizen(nft)
        setCachedCitizen(address || '', chainId, nft)
        console.log('Updated citizen state and cache')
      } catch (err: any) {
        console.log('Error fetching citizen:', err)
        if (err.reason === 'No token owned') {
          console.log('No token owned, setting citizen to undefined')
          setCitizen(undefined)
          setCachedCitizen(address || '', chainId, undefined)
        }
      }
    }

    fetchCitizenData()
  }, [authenticated, user, address, chainId, chainSlug, selectedChain, mock])

  useEffect(() => {
    if (mock) return

    if (!authenticated) {
      setCitizen(undefined)
    }
  }, [authenticated, mock])

  return (
    <CitizenContext.Provider value={{ citizen, setCitizen }}>
      {children}
    </CitizenContext.Provider>
  )
}
