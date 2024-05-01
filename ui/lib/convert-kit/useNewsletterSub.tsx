//Subscribe an email to the convert kit newsletter

export function useNewsletterSub() {
  async function subscribe(userEmail: string) {
    const res = await fetch('/api/convertkit/newsletter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
      }),
    })
    return res
  }

  return subscribe
}
