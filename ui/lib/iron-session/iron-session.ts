import { SessionOptions } from 'iron-session'

export type SessionData = {
  accessToken: string
  auth: any
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION as string,
  cookieName: 'iron-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NEXT_PUBLIC_ENV === 'prod' ? true : false,
    sameSite: 'strict',
  },
}

export async function createSession(accessToken: string | null) {
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: 'save' }),
  })
}

export async function destroySession(accessToken: string | null) {
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: 'destroy' }),
  })
}
