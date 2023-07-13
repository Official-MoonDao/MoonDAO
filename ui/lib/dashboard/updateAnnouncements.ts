export const updateAnnouncements = async (
  id: string | number,
  announcements: any,
  setAnnouncements: Function,
  setUpdating: Function,
  setUpdatingError: Function
) => {
  setUpdating(true)
  setUpdatingError(false)
  const NEXT_ANNOUNCEMENTS_URL =
    process.env.NEXT_PUBLIC_ANNOUNCEMENTS_API_URL + `?before=${id}`

  const response = await fetch(NEXT_ANNOUNCEMENTS_URL)
  if (response.status >= 400 && response.status < 600) {
    setUpdatingError(true)
    setUpdating(false)
    return
  }
  const nextAnnouncements = await response.json()

  setAnnouncements([...announcements, ...nextAnnouncements])
  setUpdating(false)
}
