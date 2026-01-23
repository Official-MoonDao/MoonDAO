import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json('Method not allowed')
  }

  try {
    let chainId: number
    let hatId: string

    if (req.method === 'GET') {
      chainId = parseInt(req.query.chainId as string)
      hatId = req.query.hatId as string
    } else {
      ;({ chainId, hatId } = req.body)
    }

    if (!chainId || !hatId) {
      return res.status(400).json('chainId and hatId are required')
    }

    setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding, chainId, hatId')

    const hat = await hatsSubgraphClient.getHat({
      chainId,
      hatId: parseInt(hatId) as any,
      props: {
        subHats: {
          props: {
            details: true,
            wearers: {
              props: {},
            },
            subHats: {
              props: {
                details: true,
                wearers: {
                  props: {},
                },
              },
            },
          },
        },
      },
    })

    const subHatsLevel1: any = hat?.subHats || []
    const subHatsLevel2: any = subHatsLevel1
      ?.map((hat: any) => hat.subHats)
      .flat()
      .filter(Boolean)

    const subHats = subHatsLevel1.concat(subHatsLevel2)
    res.status(200).json(subHats)
  } catch (err: any) {
    console.error(`Error fetching sub hats: ${err.message}`)
    res.status(500).json(`Error fetching sub hats: ${err.message}`)
  }
}

export default withMiddleware(handler, rateLimit)
