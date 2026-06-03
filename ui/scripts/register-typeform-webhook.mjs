// Register (or update) the Typeform webhook that powers the fast onboarding
// "Processing your profile" step. The webhook delivers submissions to our API
// almost instantly, so we can read answers from Redis instead of waiting on
// Typeform's slow /responses indexing.
//
// Usage:
//   TYPEFORM_PERSONAL_ACCESS_TOKEN=... \
//   TYPEFORM_WEBHOOK_SECRET=... \
//   node ui/scripts/register-typeform-webhook.mjs <formId> <https://your-domain>
//
// Example:
//   node ui/scripts/register-typeform-webhook.mjs pJj0vUae https://app.moondao.com
//
// The formId for citizen onboarding is NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID.
// Re-run for the team form id too if you want team onboarding to be just as fast.

const TAG = 'moondao-onboarding'

async function main() {
  const [, , formId, baseUrl] = process.argv
  const token = process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN
  const secret = process.env.TYPEFORM_WEBHOOK_SECRET

  if (!formId || !baseUrl) {
    console.error(
      'Usage: node ui/scripts/register-typeform-webhook.mjs <formId> <baseUrl>'
    )
    process.exit(1)
  }
  if (!token) {
    console.error('TYPEFORM_PERSONAL_ACCESS_TOKEN is required')
    process.exit(1)
  }
  if (!secret) {
    console.error(
      'TYPEFORM_WEBHOOK_SECRET is required (must match the app env var)'
    )
    process.exit(1)
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/typeform/webhook`
  const endpoint = `https://api.typeform.com/forms/${formId}/webhooks/${TAG}`

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      secret,
      verify_ssl: true,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`Failed (${res.status}):`, body)
    process.exit(1)
  }

  console.log('Webhook registered:')
  console.log(`  form:   ${formId}`)
  console.log(`  url:    ${webhookUrl}`)
  console.log(`  tag:    ${TAG}`)
  console.log(`  status: ${body.enabled ? 'enabled' : 'disabled'}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
