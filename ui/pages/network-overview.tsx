import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function NetworkOverview() {
  const router = useRouter()

  // Redirect to join page since that now contains all the sales content
  useEffect(() => {
    router.replace('/join')
  }, [router])

  return null // Return null while redirecting
}
