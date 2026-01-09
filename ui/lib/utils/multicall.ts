/**
 * Multicall utilities for efficient batch RPC operations
 *
 * These utilities help reduce RPC calls by batching operations and handling
 * concurrent requests with rate limiting.
 */

/**
 * Split an array into chunks of a specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Process batches with controlled concurrency to avoid overwhelming RPC endpoints
 */
export async function processBatchesConcurrently<T, R>(
  batches: T[][],
  processBatch: (batch: T[]) => Promise<R[]>,
  options: {
    maxConcurrentBatches?: number
    onBatchComplete?: (batchIndex: number, total: number) => void
  } = {}
): Promise<R[]> {
  const { maxConcurrentBatches = 3, onBatchComplete } = options

  const results: R[] = []
  const batchGroups = chunk(batches, maxConcurrentBatches)

  for (let groupIndex = 0; groupIndex < batchGroups.length; groupIndex++) {
    const group = batchGroups[groupIndex]
    const groupResults = await Promise.allSettled(group.map(async (batch) => processBatch(batch)))

    for (const result of groupResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value)
      } else {
        console.error('Batch processing failed:', result.reason)
      }
    }

    if (onBatchComplete) {
      const completedBatches = (groupIndex + 1) * maxConcurrentBatches
      onBatchComplete(Math.min(completedBatches, batches.length), batches.length)
    }
  }

  return results
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
    backoffMultiplier?: number
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options

  let lastError: Error | undefined
  let delayMs = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt < maxRetries) {
        const jitter = Math.random() * 0.3 * delayMs
        const totalDelay = Math.min(delayMs + jitter, maxDelayMs)

        console.warn(
          `Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(
            totalDelay
          )}ms...`,
          error
        )

        await new Promise((resolve) => setTimeout(resolve, totalDelay))
        delayMs *= backoffMultiplier
      }
    }
  }

  throw lastError
}

/**
 * Batch process items with a processing function
 * Returns a Map of input keys to results, handling failures gracefully
 */
export async function batchProcessWithResults<K extends string | number, T, R>(
  items: Array<{ key: K; data: T }>,
  processBatch: (batch: T[]) => Promise<R[]>,
  options: {
    batchSize?: number
    maxConcurrentBatches?: number
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<Map<K, R>> {
  const { batchSize = 50, maxConcurrentBatches = 3, onProgress } = options

  const resultMap = new Map<K, R>()

  if (items.length === 0) {
    return resultMap
  }

  const batches = chunk(items, batchSize)

  const processOneBatch = async (batch: Array<{ key: K; data: T }>) => {
    const batchData = batch.map((item) => item.data)
    const results = await processBatch(batchData)

    // Map results back to their keys
    return batch.map((item, index) => ({
      key: item.key,
      result: results[index],
    }))
  }

  const allResults = await processBatchesConcurrently(batches, processOneBatch, {
    maxConcurrentBatches,
    onBatchComplete: onProgress,
  })

  for (const { key, result } of allResults) {
    if (result !== null && result !== undefined) {
      resultMap.set(key, result)
    }
  }

  return resultMap
}
