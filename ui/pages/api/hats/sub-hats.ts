// Inside your Next.js API route
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import hatsSubgraphClient from '@/lib/hats/hatsSubgraphClient'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { chainId, hatId } = req.body
    try {
      const hat = await hatsSubgraphClient.getHat({
        chainId,
        hatId,
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

      const subHatsLevel1: any = hat?.subHats
      const subHatsLevel2: any = subHatsLevel1
        ?.map((hat: any) => hat.subHats)
        .flat()
      //check lenght of each subHats array and only add the ones that have hats

      const subHats = subHatsLevel1.concat(subHatsLevel2)
      res.status(200).json(subHats)
    } catch (err: any) {
      console.error(`Error fetching sub hats: ${err.message}`)
      res.status(500).json(`Error fetching sub hats: ${err.message}`)
    }
  } else {
    res.status(405).json('Method not allowed')
  }
}

export default withMiddleware(handler, rateLimit)
