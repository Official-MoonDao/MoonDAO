import { isEBManager } from 'middleware/isEBManager'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { calculateEBRewards } from '@/lib/treasury/eb-rewards'

let rewardCache: Map<string, { data: any; timestamp: number }> = new Map()

const CACHE_DURATION = 60 * 60 * 1000

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { quarter, year, nocache, clearcache } = req.query

    // Allow clearing the entire cache
    if (clearcache) {
      const cacheSize = rewardCache.size
      rewardCache.clear()
      return res.status(200).json({ message: 'Cache cleared', entriesRemoved: cacheSize })
    }

    if (!quarter || !year) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both quarter and year parameters are required',
        example: '/api/eb/rewards?quarter=1&year=2025',
      })
    }

    const quarterNum = parseInt(quarter as string, 10)
    const yearNum = parseInt(year as string, 10)

    if (isNaN(quarterNum) || quarterNum < 1 || quarterNum > 4) {
      return res.status(400).json({
        error: 'Invalid quarter',
        message: 'Quarter must be a number between 1 and 4',
      })
    }

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2100) {
      return res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2020 and 2100',
      })
    }

    const cacheKey = `${quarterNum}-${yearNum}`
    const now = Date.now()
    const cached = rewardCache.get(cacheKey)

    if (!nocache && cached && now - cached.timestamp < CACHE_DURATION) {
      // Verify cached data matches the request
      if (cached.data.quarter === quarterNum && cached.data.year === yearNum) {
        return res.status(200).json(cached.data)
      } else {
        console.warn(
          `[EB Rewards API] Cache mismatch! Requested Q${quarterNum} ${yearNum} but cached data is Q${cached.data.quarter} ${cached.data.year}. Invalidating cache.`
        )
        rewardCache.delete(cacheKey)
      }
    }

    const result = await calculateEBRewards(quarterNum, yearNum)

    // Verify result matches the request before caching
    if (result.quarter !== quarterNum || result.year !== yearNum) {
      console.error(
        `[EB Rewards API] CRITICAL: Calculation returned wrong quarter! Requested Q${quarterNum} ${yearNum} but got Q${result.quarter} ${result.year}`
      )
      throw new Error(
        `Calculation error: Expected Q${quarterNum} ${yearNum} but got Q${result.quarter} ${result.year}`
      )
    }

    rewardCache.set(cacheKey, {
      data: result,
      timestamp: now,
    })

    if (rewardCache.size > 50) {
      const oldestKey = Array.from(rewardCache.keys())[0]
      rewardCache.delete(oldestKey)
    }

    return res.status(200).json(result)
  } catch (error: any) {
    console.error('EB rewards API error:', error)

    if (error.message?.includes('No data points found')) {
      return res.status(404).json({
        error: 'Data not available',
        message: 'Historical data not available for the requested quarter',
      })
    }

    return res.status(500).json({
      error: 'Failed to calculate EB rewards',
      message: error.message || 'An unexpected error occurred',
    })
  }
}

export default withMiddleware(handler, rateLimit, isEBManager)
