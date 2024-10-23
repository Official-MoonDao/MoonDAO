//Subscribe an email to a convert kit newsletter

export default function useSubscribe(formId: string) {
  async function subscribe(userEmail: string) {
    const res = await fetch('/api/convertkit/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        formId,
      }),
    })
    return res
  }

  return subscribe
}
