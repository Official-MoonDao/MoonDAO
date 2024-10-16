//Tag a convertkit subscriber

export default function useTag(tagId: string) {
  async function tag(userEmail: string) {
    const res = fetch('/api/convertkit/tag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        tagId,
      }),
    })

    return res
  }

  return tag
}
