import { XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import Container from '@/components/layout/Container'

export default function Page451() {
  return (
    <Container>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-red-900/30 to-orange-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/30">
                <XMarkIcon className="w-10 h-10 text-red-400" />
              </div>
              <div>
                <h1 className="font-GoodTimes text-2xl font-bold text-white mb-2">
                  {`We're Sorry, Access is Restricted`}
                </h1>
                <p className="text-gray-300 text-sm leading-relaxed">
                  It looks like the location you’re visiting from is currently
                  restricted, so we can’t provide access right now. We’re
                  working to expand availability while staying compliant. If
                  you’d like updates, please join our Discord server at
                  https://discord.gg/moondao. Thank you for your understanding.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
