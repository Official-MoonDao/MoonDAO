import { XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import Container from '@/components/layout/Container'

export default function FourOhFour() {
  return (
    <Container>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-red-500/20 to-pink-500/20 flex items-center justify-center border border-red-500/30">
                <XMarkIcon className="w-10 h-10 text-red-400" />
              </div>
              <div>
                <h1 className="font-GoodTimes text-2xl font-bold text-white mb-2">
                  This page could not be found
                </h1>
                <p className="text-gray-300 text-sm leading-relaxed">
                  The page you're looking for doesn't exist or has been moved.
                  Check the URL or navigate back to our homepage.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Link
                href="/"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
              >
                <span>Go to Homepage</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
