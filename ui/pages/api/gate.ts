import type { NextApiRequest, NextApiResponse } from 'next'
import {
  GATE_COOKIE,
  GATE_MAX_AGE_S,
  isPasswordCorrect,
  isTokenConfigured,
} from '@/lib/gate/access'

// Accepts the shared password for the gated routes and, if it is right, hands
// back the session cookie the middleware looks for. See lib/gate/access.ts.
//
// This is the only place a submitted password is ever compared, and it runs on
// the server, so neither the password nor the comparison reaches the client.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const password = process.env.MOONBASE_GATE_PASSWORD
  const token = process.env.MOONBASE_GATE_TOKEN

  // Fail closed, and say so plainly: this is a deployment missing its
  // configuration, not a visitor who mistyped, and the two need different
  // fixes. The message names the variables but of course not their values.
  if (!password || !isTokenConfigured(token)) {
    return res.status(503).json({
      message:
        'The access gate is not configured on this deployment. ' +
        'Set MOONBASE_GATE_PASSWORD and MOONBASE_GATE_TOKEN.',
    })
  }

  const submitted = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!submitted) return res.status(400).json({ message: 'Password required' })

  if (!isPasswordCorrect(submitted, password)) {
    return res.status(401).json({ message: 'That password is not right' })
  }

  // HttpOnly so page scripts cannot read it, SameSite=Lax so it still rides
  // along when someone follows a link in from outside, Secure everywhere but
  // local development (where there is no HTTPS to send it over).
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  res.setHeader(
    'Set-Cookie',
    `${GATE_COOKIE}=${token}; Path=/; HttpOnly;${secure} ` +
      `SameSite=Lax; Max-Age=${GATE_MAX_AGE_S}`
  )
  return res.status(200).json({ ok: true })
}
