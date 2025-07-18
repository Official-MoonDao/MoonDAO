import { ClockIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import React from 'react'
import Container from '@/components/layout/Container'

export default function ComingSoon() {
  const router = useRouter()
  const { from } = router.query

  return (
    <Container>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30">
                <ClockIcon className="w-10 h-10 text-blue-400" />
              </div>
              <div>
                <h1 className="font-GoodTimes text-2xl font-bold text-white mb-2">
                  Coming Soon!
                </h1>
                <p className="text-gray-300 text-sm leading-relaxed">
                  We're working hard to bring you{' '}
                  {from ? `the ${from} page` : 'this feature'}. Stay tuned for
                  updates!
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
              >
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
