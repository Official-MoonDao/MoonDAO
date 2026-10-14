import { getAttribution, kitFieldsFromAttribution } from '@/lib/analytics/attribution'

// Subscribe an email to a Kit form. Campaign fields are included when present.
// The API drops unknown Kit fields and retries the email signup without them.
export default function useSubscribe(formId: string) {
  async function subscribe(userEmail: string) {
    const fields = kitFieldsFromAttribution(getAttribution())
    const res = await fetch('/api/convertkit/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        formId,
        ...(fields ? { fields } : {}),
      }),
    })
    return res
  }

  return subscribe
}
