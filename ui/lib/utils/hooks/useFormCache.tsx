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
  restoreCache: () => FormCacheData<T> | null
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
    [setCacheValue, contextId]
  )

  const clearCache = useCallback(() => {
    removeCache()
  }, [removeCache])

  const restoreCache = useCallback((): FormCacheData<T> | null => {
    // Try ref first (fast path)
    let currentCache = cacheRef.current

    // If ref is stale or empty, read directly from localStorage
    if (!currentCache) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const stored = window.localStorage.getItem(fullCacheKey)
          if (stored) {
            currentCache = JSON.parse(stored)
            // Update ref for next time
            cacheRef.current = currentCache
          }
        }
      } catch (e) {
        console.error('Error reading cache from localStorage:', e)
      }
    }

    if (!currentCache) {
      return null
    }

    const now = Date.now()
    if (now - currentCache.timestamp > CACHE_EXPIRY_MS) {
      clearCache()
      return null
    }

    return currentCache
  }, [clearCache, fullCacheKey])

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
