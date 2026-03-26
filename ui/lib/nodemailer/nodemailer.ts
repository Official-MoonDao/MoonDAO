import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

export const opEmail = 'info@moondao.com'

const emailList = [
  process.env.NODEMAILER_MOONDAO_PRIMARY_EMAIL,
  process.env.NODEMAILER_MOONDAO_SECONDARY_EMAIL,
  process.env.NODEMAILER_SFBW_PRIMARY_EMAIL,
]

/**
 * Creates a Gmail transporter using env read at call time (not at module import).
 * API routes and serverless bundles can otherwise see an empty NODEMAILER_PASSWORD on first load.
 */
export function createMoonDaoGmailTransport(): Transporter {
  const pass = process.env.NODEMAILER_PASSWORD?.trim()
  if (!pass) {
    throw new Error(
      'NODEMAILER_PASSWORD is not set or is empty — add it to .env.local (dev) and to your host env (e.g. Vercel)'
    )
  }
  const user = process.env.NODEMAILER_USER?.trim() || opEmail
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  })
}

let moonDaoGmailTransport: Transporter | null = null

/**
 * Lazily builds and reuses one Gmail transporter per process so env is read on first use, not at import.
 */
export function getMoonDaoGmailTransport(): Transporter {
  if (!moonDaoGmailTransport) {
    moonDaoGmailTransport = createMoonDaoGmailTransport()
  }
  return moonDaoGmailTransport
}

export const zeroGMailOptions = {
  from: opEmail,
  to: emailList,
}
