import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function GetMooney() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/mooney#buy')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-cool text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p className="text-gray-300">Taking you to the MOONEY token page...</p>
      </div>
    </div>
  )
}