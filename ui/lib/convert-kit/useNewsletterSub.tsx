//Subscribe an email to the convert kit newsletter

const NEWSLETTER_FORM_ID = '1111'

export function useNewsletterSub() {
  const convertKitEndpoint = `https://api.convertkit.com/v3/forms/${NEWSLETTER_FORM_ID}/subscribe`

  async function subscribe(userEmail: string) {
    const res = await fetch(convertKitEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.NEXT_PUBLIC_CONVERT_KIT_API_KEY,
        email: userEmail,
      }),
    })
    return res
  }

  return subscribe
}
