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

      let currentCache = addressOverride ? undefined : cacheRef.current

      if (!currentCache) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const stored = window.localStorage.getItem(keyToUse)
            if (stored) {
              const parsed = JSON.parse(stored)
              
              // Normalize cache structure: handle old format where data was at top level
              if (parsed && !parsed.formData && (parsed.citizenData || parsed.stage !== undefined)) {
                // Old format detected - wrap in formData
                const { stage, timestamp, contextId: oldContextId, ...formData } = parsed
                currentCache = {
                  stage,
                  formData: formData as T,
                  timestamp: timestamp || Date.now(),
                  contextId: oldContextId || contextId,
                }
              } else {
                currentCache = parsed
              }
              
              if (!addressOverride) {
                cacheRef.current = currentCache
              }
            }
          }
        } catch (e) {
          console.error('Error reading cache from localStorage:', e)
        }
      }

      if (!currentCache) {
        return null
      }

      // Ensure cache has required structure
      if (!currentCache.formData) {
        const { stage, timestamp, contextId: oldContextId, ...formData } = currentCache
        if (Object.keys(formData).length > 0) {
          currentCache = {
            stage,
            formData: formData as T,
            timestamp: timestamp || Date.now(),
            contextId: oldContextId || contextId,
          }
        } else {
          return null
        }
      }

      const now = Date.now()
      const age = now - (currentCache.timestamp || now)

      if (age > CACHE_EXPIRY_MS) {
        clearCache()
        return null
      }

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
