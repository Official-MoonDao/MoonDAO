import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function GetMooney() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to /mooney#buy
    router.replace('/mooney#buy')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to buy MOONEY section...</p>
      </div>
    </div>
  )
}
