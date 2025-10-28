import { useState, useCallback, useRef, useEffect } from 'react'

export interface OnrampJwtPayload {
  address: string
  chainSlug: string
  usdAmount?: string
  agreed?: boolean
  message?: string
  selectedWallet?: number
  timestamp: number
}

export interface UseOnrampJWTReturn {
  generateJWT: (
    payload: Omit<OnrampJwtPayload, 'timestamp'>
  ) => Promise<string | null>
  verifyJWT: (
    token: string,
    expectedAddress: string
  ) => Promise<OnrampJwtPayload | null>
  clearJWT: () => void
  getStoredJWT: () => string | null
  isGenerating: boolean
  isVerifying: boolean
  error: string | null
}

export default function useOnrampJWT(): UseOnrampJWTReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const STORAGE_KEY = 'onrampJWT'

  const generateJWT = useCallback(
    async (payload: Omit<OnrampJwtPayload, 'timestamp'>) => {
      setIsGenerating(true)
      setError(null)

      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        const response = await fetch('/api/coinbase/onramp-jwt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate JWT')
        }

        const data = await response.json()
        const jwt = data.jwt

        if (jwt) {
          localStorage.setItem(STORAGE_KEY, jwt)
        }

        return jwt
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return null
        }
        const errorMessage = err.message || 'Failed to generate JWT'
        setError(errorMessage)
        console.error('Error generating onramp JWT:', errorMessage)
        return null
      } finally {
        setIsGenerating(false)
      }
    },
    []
  )

  const verifyJWT = useCallback(
    async (
      token: string,
      expectedAddress: string
    ): Promise<OnrampJwtPayload | null> => {
      setIsVerifying(true)
      setError(null)

      try {
        const response = await fetch('/api/coinbase/verify-onramp-jwt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        if (!response.ok) {
          throw new Error('Failed to verify JWT')
        }

        const data = await response.json()

        if (!data.valid) {
          setError(data.error || 'Invalid or expired JWT')
          return null
        }

        const payload = data.payload as OnrampJwtPayload

        // Verify address matches
        if (payload.address.toLowerCase() !== expectedAddress.toLowerCase()) {
          setError('Wallet address mismatch')
          return null
        }

        return payload
      } catch (err: any) {
        const errorMessage = err.message || 'JWT verification failed'
        setError(errorMessage)
        console.error('Error verifying onramp JWT:', errorMessage)
        return null
      } finally {
        setIsVerifying(false)
      }
    },
    []
  )

  const clearJWT = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setError(null)
  }, [])

  const getStoredJWT = useCallback(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(STORAGE_KEY)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    generateJWT,
    verifyJWT,
    clearJWT,
    getStoredJWT,
    isGenerating,
    isVerifying,
    error,
  }
}
