import { useState, useCallback, useRef, useEffect } from 'react'

export interface OnrampJwtPayload {
  address: string
  chainSlug: string
  usdAmount?: string
  agreed?: boolean
  message?: string
  selectedWallet?: number
  missionId?: string
  context?: string
  timestamp: number
}

export interface UseOnrampJWTReturn {
  generateJWT: (payload: Omit<OnrampJwtPayload, 'timestamp'>) => Promise<string | null>
  verifyJWT: (
    token: string,
    expectedAddress: string,
    expectedMissionId?: string,
    expectedContext?: string
  ) => Promise<OnrampJwtPayload | null>
  clearJWT: () => void
  getStoredJWT: () => string | null
  getAddressFromJWT: (token?: string) => string | null
  storedJWT: string | null
  isGenerating: boolean
  isVerifying: boolean
  error: string | null
}

export default function useOnrampJWT(): UseOnrampJWTReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storedJWT, setStoredJWT] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const STORAGE_KEY = 'onrampJWT'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setStoredJWT(localStorage.getItem(STORAGE_KEY))
    }
  }, [])

  const generateJWT = useCallback(async (payload: Omit<OnrampJwtPayload, 'timestamp'>) => {
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
        setStoredJWT(jwt)
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
  }, [])

  const verifyJWT = useCallback(
    async (
      token: string,
      expectedAddress: string,
      expectedMissionId?: string,
      expectedContext?: string
    ): Promise<OnrampJwtPayload | null> => {
      setIsVerifying(true)
      setError(null)

      try {
        const response = await fetch('/api/coinbase/verify-onramp-jwt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (!response.ok || !data.valid) {
          setError(data.error || 'Invalid or expired JWT')
          return null
        }

        const payload = data.payload as OnrampJwtPayload

        // Verify address matches
        if (payload.address.toLowerCase() !== expectedAddress.toLowerCase()) {
          setError('Wallet address mismatch')
          return null
        }

        // Verify missionId matches if expected
        if (expectedMissionId && payload.missionId !== expectedMissionId) {
          setError('Mission ID mismatch')
          return null
        }

        // Verify context matches if expected
        if (expectedContext && payload.context !== expectedContext) {
          setError('Context mismatch')
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
    setStoredJWT(null)
    setError(null)
  }, [])

  const getStoredJWT = useCallback(() => {
    if (typeof window === 'undefined') return null
    return storedJWT
  }, [storedJWT])

  const getAddressFromJWT = useCallback((token?: string) => {
    try {
      const jwtToUse = token || storedJWT
      if (!jwtToUse) {
        return null
      }

      const parts = jwtToUse.split('.')
      if (parts.length !== 3) {
        console.error('Invalid JWT format')
        return null
      }

      const payload = JSON.parse(atob(parts[1]))
      return payload.address || null
    } catch (error) {
      console.error('Error extracting address from JWT:', error)
      return null
    }
  }, [storedJWT])

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
    getAddressFromJWT,
    storedJWT,
    isGenerating,
    isVerifying,
    error,
  }
}
