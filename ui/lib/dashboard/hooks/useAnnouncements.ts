import { useState, useEffect } from 'react'

export const useAnnouncements = () => {
  const ANNOUNCEMENTS_API_URL = process.env
    .NEXT_PUBLIC_ANNOUNCEMENTS_API_URL as string
  const [announcements, setAnnouncements] = useState<any>([])
  const [announcementsError, setAnnouncementsError] = useState<boolean>()
  const [announcementsLoaded, setAnnouncementsLoaded] = useState<boolean>(false)

  useEffect(() => {
    fetch(ANNOUNCEMENTS_API_URL)
      .then((res) => res.json())
      .then(
        (result) => {
          if (result.message === '401: Unauthorized') {
            setAnnouncementsError(true)
            setAnnouncements(result)
          } else {
            setAnnouncements(result)
            setAnnouncementsLoaded(true)
          }
        },
        (error) => setAnnouncementsError(error)
      )
  }, [])

  return {
    announcements,
    announcementsLoaded,
    announcementsError,
    setAnnouncements,
  }
}
