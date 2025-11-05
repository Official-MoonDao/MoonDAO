export default async function fetcher(url: string) {
  const res = await fetch(url)

  if (!res.ok) {
    const error = new Error(
      `An error occurred while fetching the data: ${res.status} ${res.statusText}`
    )
    try {
      const errorData = await res.json()
      if (errorData.error || errorData.message) {
        ;(error as any).info = errorData
      }
    } catch {
      ;(error as any).status = res.status
    }
    throw error
  }

  return res.json()
}
