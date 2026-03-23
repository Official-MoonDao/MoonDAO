import { CK_NEWSLETTER_FORM_ID } from 'const/config'
import { opEmail, transporter } from '@/lib/nodemailer/nodemailer'

export async function subscribeContributorToNewsletter(email: string): Promise<void> {
  const apiKey = process.env.CONVERT_KIT_API_KEY
  if (!apiKey) {
    console.warn('subscribeContributorToNewsletter: CONVERT_KIT_API_KEY not set')
    return
  }

  const formResultEndpoint = `https://api.convertkit.com/v3/forms/${CK_NEWSLETTER_FORM_ID}/subscribe`
  const response = await fetch(formResultEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, email: email.trim() }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.error('ConvertKit subscribe failed:', response.status, text)
  }
}

const CONTRIBUTION_THANK_YOU_BODY = `Hello,

Thank you so much for supporting the campaign to "Send Frank to Space."

Of course, it will be the fulfillment of a lifelong dream, but the larger purpose is to share the
Overview Effect to a much wider audience.

You don't have to be a rocket scientist to see that the crew of Spaceship Earth is not
steering us in the right direction. The Overview Effect, which focuses on seeing our planet
as a whole system, recognizing the fragility of our existence, and understanding that "We're
all in this together" can help to make the world a better place.

Thank you for giving me the opportunity to have this profound experience myself; I
promise that I won't let you down!

All the best,
Frank`

export async function sendContributionThankYouEmail(toEmail: string): Promise<void> {
  if (!process.env.NODEMAILER_PASSWORD) {
    console.warn('sendContributionThankYouEmail: NODEMAILER_PASSWORD not set')
    return
  }

  await transporter.sendMail({
    from: opEmail,
    to: toEmail.trim(),
    subject: 'Thank you for supporting Send Frank to Space',
    text: CONTRIBUTION_THANK_YOU_BODY,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;">
<div style="white-space:pre-wrap;max-width:40rem;">${escapeHtml(CONTRIBUTION_THANK_YOU_BODY)}</div>
</body></html>`,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
