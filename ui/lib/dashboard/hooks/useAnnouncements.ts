import { useEffect, useState } from 'react'

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<any>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>()

  async function getAnnouncements(id?: string) {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/discord/messages?type=announcements${id ? `&before=${id}` : ''}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch announcements')
      }
      const announcements = await response.json()
      if (Array.isArray(announcements)) {
        setAnnouncements((prev: any) => [...prev, ...announcements])
      }
    } catch (error) {
      console.error('Error fetching announcements:', error)
      setError(error)
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
