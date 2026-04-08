/**
 * Verifies Gmail SMTP credentials used for contribution thank-you (and other) emails.
 *
 * Usage (from ui/):
 *   node scripts/verify-nodemailer.cjs
 *   node scripts/verify-nodemailer.cjs you@example.com   # optional: send one test message
 *
 * Loads ui/.env.local if present (same vars as Next dev).
 */
const path = require('path')
const fs = require('fs')
const nodemailer = require('nodemailer')

const root = path.join(__dirname, '..')
const envLocal = path.join(root, '.env.local')
if (fs.existsSync(envLocal)) {
  require('dotenv').config({ path: envLocal })
} else {
  require('dotenv').config({ path: path.join(root, '.env') })
}

const opEmail = 'info@moondao.com'
const pass = process.env.NODEMAILER_PASSWORD?.trim()
const user = process.env.NODEMAILER_USER?.trim() || opEmail

async function main() {
  if (!pass) {
    console.error(
      'NODEMAILER_PASSWORD is missing or empty.\n' +
        'Set it in ui/.env.local for local runs and in your deployment environment (e.g. Vercel → Settings → Environment Variables).'
    )
    process.exit(1)
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  try {
    await transport.verify()
    console.log('SMTP verify OK (Gmail accepted credentials for user:', user + ')')
  } catch (err) {
    console.error('SMTP verify failed:', err.message)
    console.error(
      'Typical fixes: use a Google App Password (not your normal password), 2FA on, and auth user matches the mailbox (or set NODEMAILER_USER).'
    )
    process.exit(1)
  }

  const testTo = process.argv[2]
  if (testTo) {
    const info = await transport.sendMail({
      from: opEmail,
      to: testTo,
      subject: '[MoonDAO] Nodemailer verification',
      text: 'If you received this, contribution thank-you mail should work from this environment.',
    })
    console.log('Test message sent. messageId:', info.messageId)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
