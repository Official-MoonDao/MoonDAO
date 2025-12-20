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
    console.log('[useFormCache] restoreCache called for key:', fullCacheKey)
    
    // Try ref first (fast path)
    let currentCache = cacheRef.current

    // If ref is stale or empty, read directly from localStorage
    if (!currentCache) {
      console.log('[useFormCache] Cache ref empty, reading from localStorage')
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const stored = window.localStorage.getItem(fullCacheKey)
          if (stored) {
            currentCache = JSON.parse(stored)
            // Update ref for next time
            cacheRef.current = currentCache
            console.log('[useFormCache] Cache loaded from localStorage:', {
              stage: currentCache.stage,
              timestamp: currentCache.timestamp,
              hasFormData: !!currentCache.formData
            })
          } else {
            console.log('[useFormCache] No cache found in localStorage')
          }
        }
      } catch (e) {
        console.error('[useFormCache] Error reading cache from localStorage:', e)
      }
    } else {
      console.log('[useFormCache] Using cache from ref:', {
        stage: currentCache.stage,
        timestamp: currentCache.timestamp,
        hasFormData: !!currentCache.formData
      })
    }

    if (!currentCache) {
      console.log('[useFormCache] No cache available')
      return null
    }

    const now = Date.now()
    const age = now - currentCache.timestamp
    console.log('[useFormCache] Cache age:', age, 'ms (expires at', CACHE_EXPIRY_MS, 'ms)')
    
    if (age > CACHE_EXPIRY_MS) {
      console.log('[useFormCache] Cache expired, clearing')
      clearCache()
      return null
    }

    console.log('[useFormCache] Returning valid cache')
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
