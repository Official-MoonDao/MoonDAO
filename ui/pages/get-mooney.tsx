import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function GetMooney() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new mooney page
    router.replace('/mooney')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to MOONEY page...</p>
      </div>
    </div>
  )
}
