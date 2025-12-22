import { useEffect, useCallback, useRef } from 'react'
import { useLocalStorage } from 'react-use'

export interface FormCacheData<T = any> {
  stage?: number
  formData: T
  timestamp: number
  contextId?: string
}

export interface UseFormCacheReturn<T = any> {
  cache: FormCacheData<T> | undefined
  setCache: (data: Partial<T>, stage?: number) => void
  clearCache: () => void
  restoreCache: (addressOverride?: string) => FormCacheData<T> | null
}

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

export function useFormCache<T = any>(
  cacheKey: string,
  address?: string,
  contextId?: string
): UseFormCacheReturn<T> {
  const fullCacheKey = address
    ? `${cacheKey}_${address.toLowerCase()}${contextId ? `_${contextId}` : ''}`
    : cacheKey

  const [cache, setCacheValue, removeCache] = useLocalStorage<FormCacheData<T>>(
    fullCacheKey,
    undefined
  )

  const cacheRef = useRef<FormCacheData<T> | undefined>(cache)
  useEffect(() => {
    cacheRef.current = cache
  }, [cache])

  const setCache = useCallback(
    (formData: Partial<T>, stage?: number) => {
      const cacheData: FormCacheData<T> = {
        stage,
        formData: formData as T,
        timestamp: Date.now(),
        contextId,
      }
      console.log('[useFormCache] Setting cache with key:', fullCacheKey, 'stage:', stage)
      setCacheValue(cacheData)
    },
    [setCacheValue, contextId, fullCacheKey]
  )

  const clearCache = useCallback(() => {
    removeCache()
  }, [removeCache])

  const restoreCache = useCallback(
    (addressOverride?: string): FormCacheData<T> | null => {
      // If an address override is provided (from JWT), use it to construct the cache key
      const keyToUse = addressOverride
        ? `${cacheKey}_${addressOverride.toLowerCase()}${contextId ? `_${contextId}` : ''}`
        : fullCacheKey

      console.log('[useFormCache] Restoring cache with key:', keyToUse)

      let currentCache = addressOverride ? undefined : cacheRef.current

      if (!currentCache) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const stored = window.localStorage.getItem(keyToUse)
            console.log('[useFormCache] Raw localStorage value:', stored ? stored.substring(0, 200) + '...' : 'null')
            if (stored) {
              currentCache = JSON.parse(stored)
              if (!addressOverride) {
                cacheRef.current = currentCache
              }
              console.log('[useFormCache] Parsed cache:', currentCache)
            }
          }
        } catch (e) {
          console.error('Error reading cache from localStorage:', e)
        }
      }

      if (!currentCache) {
        console.log('[useFormCache] No cache found')
        return null
      }

      const now = Date.now()
      const age = now - currentCache.timestamp

      if (age > CACHE_EXPIRY_MS) {
        console.log('[useFormCache] Cache expired')
        clearCache()
        return null
      }

      console.log('[useFormCache] Returning valid cache, age:', age, 'ms')
      return currentCache
    },
    [clearCache, fullCacheKey, cacheKey, contextId]
  )

  useEffect(() => {
    if (cache) {
      const now = Date.now()
      if (now - cache.timestamp > CACHE_EXPIRY_MS) {
        clearCache()
      }
    }
  }, [cache, clearCache])

  return {
    cache,
    setCache,
    clearCache,
    restoreCache,
  }
}
