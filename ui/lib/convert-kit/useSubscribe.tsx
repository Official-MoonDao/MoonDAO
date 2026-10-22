import { buildKitSignupFields } from '@/lib/analytics/attribution'

export type SubscribeGuard = {
  company?: string
  formStartedAt?: number
}

// Subscribe an email to a Kit form. First-touch fields are included when present.
// The API returns Kit's real result. A filtered signup still looks successful.
export default function useSubscribe(formId: string) {
  async function subscribe(userEmail: string, guard?: SubscribeGuard) {
    const fields = buildKitSignupFields()
    const res = await fetch('/api/convertkit/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        formId,
        company: guard?.company || '',
        formStartedAt: guard?.formStartedAt,
        ...(fields ? { fields } : {}),
      }),
    })
    return res
  }

  return subscribe
}
