import { useRouter } from 'next/router'

export function useOnrampInitialStage(
  restoreCache: () => any | null,
  defaultStage: number = 0,
  finalStage: number = 2
): number {
  const router = useRouter()
  
  // Only attempt restoration if returning from onramp
  if (router.query.onrampSuccess !== 'true') {
    return defaultStage
  }
  
  // Try to restore stage from cache
  const cached = restoreCache()
  if (cached?.stage !== undefined) {
    return cached.stage
  }
  
  // If cache exists but no stage, assume final stage
  if (cached?.formData) {
    return finalStage
  }
  
  return defaultStage
}

