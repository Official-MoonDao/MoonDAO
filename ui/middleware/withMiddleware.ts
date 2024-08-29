// middleware/withMiddleware.ts
import { NextApiRequest, NextApiResponse } from 'next'

type NextApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void> | void
type MiddlewareFunction = (
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) => Promise<void> | void

export default function withMiddleware(
  handler: NextApiHandler,
  ...middlewares: MiddlewareFunction[]
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    for (const middleware of middlewares) {
      let nextCalled = false
      const next = (): void => {
        nextCalled = true
      }

      await middleware(req, res, next)

      if (!nextCalled) {
        return
      }
    }

    return handler(req, res)
  }
}
