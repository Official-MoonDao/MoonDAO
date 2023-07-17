import { set } from 'cypress/types/lodash'
import { useState, useEffect } from 'react'

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<any>([])
  const [error, setError] = useState<boolean>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  async function getAnnouncements(id?: string) {
    setIsLoading(true)
    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_ANNOUNCEMENTS_API_URL +
          (id ? `?before=${id}` : '')
      )
      const data = await response.json()
      setAnnouncements(data)
    } catch (err: any) {
      setError(err.message)
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
    update: getAnnouncements,
  }
}
