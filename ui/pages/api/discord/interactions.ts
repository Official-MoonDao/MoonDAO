import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  config as interactionsConfig,
  handleDiscordInteraction,
} from '@/lib/discord/handleInteraction'

export const config = interactionsConfig

export { handleDiscordInteraction as handler } from '@/lib/discord/handleInteraction'

async function route(req: NextApiRequest, res: NextApiResponse) {
  return handleDiscordInteraction(req, res)
}

export default withMiddleware(route, rateLimit)
