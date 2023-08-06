import { useEffect, useState } from 'react'

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<any>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>()

  async function getAnnouncements(id?: string) {
    setIsLoading(true)
    console.log('Fetching announcements...')
    try {
      const response = await fetch(
        `/api/discord/announcements${id ? `?before=${id}` : ''}`
      )
      const announcements = await response.json()
      setAnnouncements((prev: any) => [...prev, ...announcements])
    } catch (error) {
      console.error('Error fetching announcements:', error)
    }

    setIsLoading(false)
  }
  useEffect(() => {
    getAnnouncements()
  }, [])

  return {
    announcements,
    isLoading,
    error,
    updateAnnouncements: getAnnouncements,
  }
}
