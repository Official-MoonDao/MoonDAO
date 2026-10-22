import { CheckCircleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'

const CITIZEN_HREF =
  'https://moondao.com/citizen?utm_source=kit&utm_medium=web&utm_campaign=confirm&utm_content=thank-you'

function isNewsletterThankYou(flow: string | string[] | undefined): boolean {
  if (Array.isArray(flow)) return flow.includes('newsletter') || flow.length === 0
  if (!flow) return true
  return flow === 'newsletter'
}

const ThankYou: React.FC = () => {
  const router = useRouter()
  const newsletter = !router.isReady || isNewsletterThankYou(router.query.flow)

  return (
    <>
      <WebsiteHead
        title={newsletter ? "You're confirmed" : 'Thank You'}
        description={
          newsletter
            ? "You're confirmed. Welcome to MoonDAO."
            : "Thank you for your submission. We've received your response and will be in touch soon."
        }
      />
      <Container>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
            <div className="p-6 space-y-6">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-green-500/20 to-blue-500/20 flex items-center justify-center border border-green-500/30">
                  <CheckCircleIcon className="w-10 h-10 text-green-400" />
                </div>
                {newsletter ? (
                  <div>
                    <h1 className="font-heading text-2xl font-bold text-white mb-2">
                      {"You're confirmed. Welcome to MoonDAO."}
                    </h1>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Your newsletter subscription is confirmed.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h1 className="font-heading text-2xl font-bold text-white mb-2">Thank You!</h1>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      We&apos;ve received your response. Our team will review your submission and
                      get back to you soon.
                    </p>
                  </div>
                )}
              </div>

              {newsletter ? (
                <div className="space-y-4 text-center">
                  <Link
                    href={CITIZEN_HREF}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 shadow-lg flex items-center justify-center"
                  >
                    Become a Citizen
                  </Link>
                  <Link
                    href="/"
                    className="inline-block text-sm text-white/70 underline hover:text-white"
                  >
                    Go to the homepage
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/"
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                  >
                    <span>Go to Homepage</span>
                  </Link>
                  <Link
                    href="/network"
                    className="w-full bg-transparent border border-white/20 hover:bg-white/10 text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <span>Explore the Network</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </>
  )
}

export default ThankYou
