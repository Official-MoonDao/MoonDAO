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

export async function sendContributionThankYouEmail(
  toEmail: string,
  missionName: string
): Promise<void> {
  if (!process.env.NODEMAILER_PASSWORD) {
    console.warn('sendContributionThankYouEmail: NODEMAILER_PASSWORD not set')
    return
  }

  const safeName =
    missionName && missionName.trim().length > 0 ? missionName.trim() : 'this MoonDAO mission'

  await transporter.sendMail({
    from: opEmail,
    to: toEmail.trim(),
    subject: 'Thank you for supporting MoonDAO',
    text: `Thank you for contributing to ${safeName}. Your support helps us build an open, community-led future in space.\n\n— MoonDAO`,
    html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
<p>Thank you for contributing to <strong>${escapeHtml(safeName)}</strong>.</p>
<p>Your support helps us build an open, community-led future in space.</p>
<p style="margin-top:1.5em;color:#444;">— MoonDAO</p>
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
