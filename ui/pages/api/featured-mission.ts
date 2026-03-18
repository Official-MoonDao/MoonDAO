import type { NextApiRequest, NextApiResponse } from 'next'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import {
  DEFAULT_CHAIN_V5,
  JBV5_CONTROLLER_ADDRESS,
  MISSION_TABLE_ADDRESSES,
} from 'const/config'
import { fetchFeaturedMissionData } from '@/lib/launchpad/fetchFeaturedMission'
import { fetchMissions } from '@/lib/launchpad/fetchMissions'
import { getChainSlug } from '@/lib/thirdweb/chain'

/** Returns missions + featured mission data for dashboard client-side fallback when getStaticProps returns empty. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const missions = await fetchMissions(
      chain,
      chainSlug,
      MISSION_TABLE_ADDRESSES[chainSlug],
      JBV5_CONTROLLER_ADDRESS
    )

    const featuredMissionData = await fetchFeaturedMissionData(
      missions,
      chain,
      chainSlug,
      JBV5_CONTROLLER_ADDRESS,
      JBV5Controller.abi as any
    )

    return res.status(200).json({
      missions: missions || [],
      featuredMissionData,
    })
  } catch (error) {
    console.error('[featured-mission] Error:', error)
    return res.status(200).json({
      missions: [],
      featuredMissionData: null,
    })
  }
}
