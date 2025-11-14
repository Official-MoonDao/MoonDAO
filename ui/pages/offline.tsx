import { useEffect, useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <>
      <Head>
        <title>Offline - MoonDAO</title>
        <meta name="description" content="You are currently offline" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
        <div className="max-w-md w-full bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-32 h-32 relative">
              <Image
                src="/assets/MoonDAO-Loading-Animation.svg"
                alt="MoonDAO Logo"
                width={128}
                height={128}
                className="animate-pulse"
              />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">
            {isOnline ? 'Back Online!' : 'You\'re Offline'}
          </h1>

          <p className="text-gray-300 mb-6">
            {isOnline
              ? 'Your connection has been restored. Reloading...'
              : 'It looks like you\'re not connected to the internet. Please check your connection and try again.'}
          </p>

          {!isOnline && (
            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                Try Again
              </button>

              <button
                onClick={() => window.history.back()}
                className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all duration-200"
              >
                Go Back
              </button>
            </div>
          )}

          {isOnline && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Some features may be available offline
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

